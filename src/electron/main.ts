import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { fork, ChildProcess, ForkOptions } from 'child_process';
import { SerialPort } from 'serialport';

// --- ESM Polyfills  ---
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Handle Squirrel Startup ---
if (require('electron-squirrel-startup')) {
    app.quit();
}

// --- Global process references ---
let backendProcess: ChildProcess | null = null; // The backend server process
let flasherProcess: ChildProcess | null = null; // The flasher worker
let mainWindow: BrowserWindow | null = null; // Global window reference

// --- Paths ---
const LOBSTER_DEV_SERVER_URL = process.env['LOBSTER_DEV_SERVER_URL'];
const IS_DEV = !!LOBSTER_DEV_SERVER_URL;

const preloadScriptPath = IS_DEV
    ? path.join(__dirname, 'preload.cts')
    : path.join(__dirname, 'preload.cjs');

// --- startBackend ---
const startBackend = (mainWindow: BrowserWindow) => {
    if (IS_DEV) {
        console.log(
            '[Electron] Dev mode: Not starting backend (already running).'
        );
        mainWindow.webContents.send('backend-ready');
        return;
    }

    const backendPath = path.join(__dirname, '..', 'backend', 'index.cjs');
    console.log(`[Electron] Starting backend at: ${backendPath}`);

    backendProcess = fork(backendPath, [], { stdio: ['ipc', 'pipe', 'pipe'] });

    if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[Backend]: ${output.trim()}`);
            if (output.includes('LOBSTER_BACKEND_READY')) {
                console.log(
                    '[Electron] Detected backend is ready! Notifying frontend.'
                );
                mainWindow.webContents.send('backend-ready');
            }
        });
    }

    if (backendProcess.stderr) {
        backendProcess.stderr.on('data', (data) => {
            console.error(`[Backend ERR]: ${data.toString()}`);
        });
    }

    backendProcess.on('exit', (code) => {
        console.log(`[Backend] Exited with code: ${code}`);
    });

    backendProcess.on('error', (err) => {
        console.error('[Backend] Failed to start.', err);
    });
};

// --- stopBackend  ---
const stopBackend = () => {
    if (backendProcess && !backendProcess.killed) {
        console.log('[Electron] Stopping backend...');
        backendProcess.kill();
        backendProcess = null;
    }
};

// Listen for messages FROM the flasher worker (e.g., progress)
interface FlasherMessage {
    type: 'flash-progress' | 'flash-complete' | 'flash-error';
    payload?: {
        progress?: number;
        error?: string;
    };
}

/**
 * Starts the flasher worker as a child process.
 */
const startFlasher = (window: BrowserWindow) => {
    const flasherWorkerPath = IS_DEV
        ? path.join(__dirname, 'flasher.worker.ts')
        : path.join(__dirname, 'flasher.worker.cjs');

    // In DEV, we use 'tsx' to execute the TypeScript file on the fly
    const flasherForkOptions: ForkOptions = {
        stdio: ['ipc', 'pipe', 'pipe'],
        // Use tsx/register to allow Node to run .ts files
        execArgv: IS_DEV ? ['-r', 'tsx/register'] : undefined,
    };

    console.log(`[Electron] Starting Flasher worker at: ${flasherWorkerPath}`);
    console.log(
        `[Electron] Flasher fork options:`,
        JSON.stringify(flasherForkOptions)
    );

    flasherProcess = fork(flasherWorkerPath, [], flasherForkOptions);

    flasherProcess.on('message', (message: FlasherMessage) => {
        if (!window) return;

        // Forward progress to the renderer
        if (
            message &&
            message.type === 'flash-progress' &&
            message.payload?.progress !== undefined
        ) {
            window.webContents.send('flash-progress', message.payload.progress);
        }
    });

    flasherProcess.stdout?.on('data', (data) => {
        console.log(`[Flasher]: ${data.toString().trim()}`);
    });
    flasherProcess.stderr?.on('data', (data) => {
        console.error(`[Flasher ERR]: ${data.toString().trim()}`);
    });
    flasherProcess.on('exit', (code) => {
        console.log(`[Flasher] Exited with code: ${code}`);
        flasherProcess = null; // Clear the process reference
    });
    flasherProcess.on('error', (err) => {
        console.error('[Flasher] Failed to start.', err);
    });
};

/**
 * Gracefully stops the flasher child process if it's running.
 */
const stopFlasher = () => {
    if (flasherProcess && !flasherProcess.killed) {
        console.log('[Electron] Stopping flasher worker...');
        flasherProcess.kill();
        flasherProcess = null;
    }
};

/**
 * Creates the main application window.
 */
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        webPreferences: {
            preload: preloadScriptPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // --- Load the app content ---
    if (IS_DEV) {
        console.log(`[Electron] Loading dev server: ${LOBSTER_DEV_SERVER_URL}`);
        mainWindow.loadURL(LOBSTER_DEV_SERVER_URL!);
        mainWindow.webContents.openDevTools();
    } else {
        const frontendIndexPath = path.join(
            __dirname,
            '..',
            'frontend',
            'index.html'
        );
        console.log(
            `[Electron] Loading production build: ${frontendIndexPath}`
        );
        mainWindow.loadFile(frontendIndexPath);
    }
};

// --- Electron App Lifecycle Events ---

/**
 * This method will be called when Electron has finished
 * initialization and is ready to create browser windows.
 */
app.on('ready', () => {
    app.commandLine.appendSwitch('disable-features', 'Autofill');

    // Create the window first
    createWindow();

    if (mainWindow) {
        startBackend(mainWindow);
        startFlasher(mainWindow);
    }

    // --- IPC handler for flashing ---
    ipcMain.handle('flash-device', async (_event, args: { port: string }) => {
        if (!flasherProcess) {
            // This shouldn't happen if 'ready' worked, but a good safeguard
            throw new Error('Flasher process is not running.');
        }

        // 1. Send the "flash" command to the flasher process
        flasherProcess.send({ type: 'flash', payload: args });

        // 2. Wait for the flasher to send back a "complete" or "error"
        return new Promise((resolve, reject) => {
            const onFlasherMessage = (message: FlasherMessage) => {
                if (message && message.type === 'flash-complete') {
                    flasherProcess?.removeListener('message', onFlasherMessage);
                    resolve('success');
                }
                if (message && message.type === 'flash-error') {
                    flasherProcess?.removeListener('message', onFlasherMessage);
                    reject(
                        new Error(
                            message.payload?.error ?? 'Unknown flash error'
                        )
                    );
                }
            };
            flasherProcess?.on('message', onFlasherMessage);
        });
    });

    // ---  IPC handler for listing ports ---
    ipcMain.handle('list-serial-ports', async () => {
        try {
            const ports = await SerialPort.list();
            // Filter for known ESP/Serial chips
            return ports.filter(
                (port: { vendorId: string }) =>
                    port.vendorId === '10C4' || // Silicon Labs (CP210x)
                    port.vendorId === '1A86' || // WCH (CH340)
                    port.vendorId === '303A' // Espressif
            );
        } catch (err: unknown) {
            console.error('Error listing serial ports:', err);
            return [];
        }
    });
});

/**
 * Quit when all windows are closed, except on macOS.
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * On macOS, re-create a window...
 */
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

/**
 * Gracefully stop the backend server when the app quits.
 */
app.on('quit', () => {
    console.log('[Electron] App is quitting.');
    stopBackend();
    stopFlasher();
});
