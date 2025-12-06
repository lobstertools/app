import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { fork, ChildProcess, spawn, execSync } from 'child_process';
import { SerialPort } from 'serialport';
import { shell } from 'electron/common';

// --- ESM Polyfills ---
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Handle Squirrel Startup ---
if (require('electron-squirrel-startup')) {
    app.quit();
}

// --- Global process references ---
let backendProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

// --- Global State for Connection Handshake ---
let isBackendReady = false;

// --- Paths ---
const LOBSTER_DEV_SERVER_URL = process.env['LOBSTER_DEV_SERVER_URL'];
const IS_DEV = !!LOBSTER_DEV_SERVER_URL;

const preloadScriptPath = path.join(__dirname, '..', '..', 'dist', 'electron', 'preload.cjs');

// Helper to send the signal safely to the renderer
const sendBackendReadySignal = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log('[Electron] Sending backend-ready signal to frontend...');
        mainWindow.webContents.send('backend-ready');
    }
};

const startBackend = () => {
    if (IS_DEV) {
        console.log('[Electron] Dev mode: Not starting backend (assuming external server).');
        // In dev mode, we assume the backend is running externally.
        isBackendReady = true;
        // We do not send the signal here immediately because the window might
        // not be ready. The 'did-finish-load' listener in createWindow handles it.
        return;
    }

    // --- Production mode logic ---
    const backendPath = path.join(__dirname, '..', 'backend', 'index.cjs');
    console.log(`[Electron] Starting backend at: ${backendPath}`);

    backendProcess = fork(backendPath, [], { stdio: ['ipc', 'pipe', 'pipe'] });

    if (backendProcess.stdout) {
        backendProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[Backend]: ${output.trim()}`);

            // Detect the specific ready signal from the server
            if (output.includes('LOBSTER_BACKEND_READY')) {
                console.log('[Electron] Detected backend is ready!');
                isBackendReady = true;
                sendBackendReadySignal();
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
        isBackendReady = false;
    });

    backendProcess.on('error', (err) => {
        console.error('[Backend] Failed to start.', err);
        isBackendReady = false;
    });
};

const stopBackend = () => {
    if (backendProcess && !backendProcess.killed) {
        console.log('[Electron] Stopping backend...');
        backendProcess.kill();
        backendProcess = null;
    }
};

/**
 * Tries to find a system-installed version of esptool.
 * Returns the path if found, otherwise null.
 */
function findSystemEsptool(): string | null {
    const isWindows = process.platform === 'win32';
    // Commands to check, in order of preference
    const commandsToTry = isWindows
        ? ['where esptool.exe', 'where esptool.py'] // Windows
        : ['which esptool', 'which esptool.py']; // macOS & Linux

    for (const cmd of commandsToTry) {
        try {
            // execSync will throw an error if the command is not found
            const systemPath = execSync(cmd).toString().trim();

            // 'where' on Windows can return multiple lines, 'which' returns one.
            // We'll take the first valid one.
            const firstPath = systemPath.split('\n')[0].trim();

            if (firstPath) {
                return firstPath;
            }
        } catch (error) {
            // Command not found, continue to the next one
        }
    }

    // No system-wide executable found
    return null;
}

function getEsptoolPath() {
    try {
        const systemPath = findSystemEsptool();
        if (systemPath) {
            console.log(`[Electron] Found system-installed esptool at: ${systemPath}`);
            return systemPath;
        } else {
            console.log('[Electron] No system-installed esptool found, using bundled version.');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error(`[Electron] Error checking for system-installed esptool: ${error.message}`);
        console.log('[Electron] Defaulting to bundled version.');
    }

    const platform = process.platform;
    const arch = process.arch;

    let toolSubPath = '';
    console.log(`[Electron] Detecting bundled binary for platform: ${platform}, arch: ${arch}`);

    if (platform === 'win32') {
        if (arch === 'x64') {
            toolSubPath = path.join('esptool-windows-amd64', 'esptool.exe');
        } else {
            throw new Error(`Unsupported Windows architecture: ${arch}. Please add the correct esptool binary to assets/bin.`);
        }
    } else if (platform === 'darwin') {
        if (arch === 'arm64') {
            toolSubPath = path.join('esptool-macos-arm64', 'esptool');
        } else if (arch === 'x64') {
            toolSubPath = path.join('esptool-macos-amd64', 'esptool');
        } else {
            throw new Error(`Unsupported macOS architecture: ${arch}.`);
        }
    } else if (platform === 'linux') {
        const binName = 'esptool'; // Binary name for Linux
        if (arch === 'x64') {
            toolSubPath = path.join('esptool-linux-amd64', binName);
        } else if (arch === 'arm64') {
            toolSubPath = path.join('esptool-linux-aarch64', binName);
        } else if (arch === 'arm') {
            // Note: process.arch 'arm' typically maps to armv7
            toolSubPath = path.join('esptool-linux-armv7', binName);
        } else {
            throw new Error(`Unsupported Linux architecture: ${arch}. Please add esptool binaries for Linux to assets/bin.`);
        }
    } else {
        throw new Error(`Unsupported platform for esptool: ${platform}`);
    }

    if (IS_DEV) {
        return path.join(__dirname, '..', '..', 'assets', 'bin', toolSubPath);
    } else {
        return path.join(process.resourcesPath, 'bin', toolSubPath);
    }
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1200,
        minHeight: 800,
        icon: path.join(__dirname, '..', '..', 'build-assets', 'icon.png'),
        webPreferences: {
            preload: preloadScriptPath,
            contextIsolation: true,
            nodeIntegration: false,
            // Prevents the renderer from throttling timers when backgrounded
            backgroundThrottling: false,
        },
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        // Check if the URL is http or https
        if (details.url.startsWith('https:') || details.url.startsWith('http:')) {
            shell.openExternal(details.url);
        }
        // 'deny' prevents Electron from creating a new BrowserWindow
        return { action: 'deny' };
    });

    // --- Listener for Page Load/Reload ---
    mainWindow.webContents.on('did-finish-load', () => {
        // If backend is ALREADY ready (e.g. dev mode, or page reload),
        // we must tell the frontend again.
        if (isBackendReady) {
            // Small delay to allow React to hydrate and register the effect
            setTimeout(() => {
                console.log('[Electron] Window loaded/reloaded. Re-sending backend-ready.');
                sendBackendReadySignal();
            }, 500);
        }
    });

    if (IS_DEV) {
        console.log(`[Electron] Loading dev server: ${LOBSTER_DEV_SERVER_URL}`);
        mainWindow.loadURL(LOBSTER_DEV_SERVER_URL!);
    } else {
        const frontendIndexPath = path.join(__dirname, '..', 'frontend', 'index.html');
        console.log(`[Electron] Loading production build: ${frontendIndexPath}`);
        mainWindow.loadFile(frontendIndexPath);
    }

    if (IS_DEV || process.argv.includes('--debug-mode')) {
        console.log('[Electron] Opening DevTools (Triggered by IS_DEV or --debug flag)');
        mainWindow.webContents.openDevTools();
    }
};

// --- Electron App Lifecycle Events ---

app.on('ready', () => {
    const menuTemplate: MenuItemConstructorOptions[] = [];

    // 1. Add macOS app menu OR Windows/Linux File menu
    if (process.platform === 'darwin') {
        menuTemplate.push({
            label: app.name,
            submenu: [
                {
                    label: `About ${app.name}`,
                    click: () => {
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('open-about-modal');
                        }
                    },
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        });
    } else {
        // Add Windows/Linux File menu
        menuTemplate.push({
            label: 'File',
            submenu: [{ role: 'quit' }],
        });
    }

    // 2. Add the "Edit" menu (REQUIRED for Copy/Paste/SelectAll)
    menuTemplate.push({
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' },
        ],
    });

    // 3. Add "View" menu with DevTools *only* in development
    if (IS_DEV) {
        menuTemplate.push({
            label: 'View',
            submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }],
        });
    }

    // --- Build and Set Menu ---
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
    app.commandLine.appendSwitch('disable-features', 'Autofill');

    createWindow();

    if (mainWindow) {
        startBackend();
    }

    // --- IPC handler: open-firmware-dialog ---
    ipcMain.handle('open-firmware-dialog', async () => {
        if (!mainWindow) return null;
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Firmware',
            properties: ['openFile'],
            filters: [
                { name: 'Firmware', extensions: ['bin'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (canceled || filePaths.length === 0) {
            return null;
        }
        return filePaths[0];
    });

    // --- IPC handler: flash-device ---
    ipcMain.handle(
        'flash-device',
        async (
            _event,
            args: {
                port: string;
                files: {
                    firmwarePath: string;
                    bootloaderPath: string;
                    partitionsPath: string;
                };
            }
        ) => {
            let esptoolPath: string;
            try {
                esptoolPath = getEsptoolPath();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.error('[Electron] Error getting esptool path:', err);
                throw new Error(err.message);
            }

            // Construct the command with specific offsets for ESP32
            const flashArgs = [
                '--port',
                args.port,
                '--baud',
                '115200',
                '--before',
                'default_reset',
                '--after',
                'hard_reset',
                'write-flash',
                '--flash_mode',
                'dio',
                '--flash_freq',
                '40m',
                '--flash_size',
                'detect',
                '0x1000',
                args.files.bootloaderPath,
                '0x8000',
                args.files.partitionsPath,
                '0x10000',
                args.files.firmwarePath,
            ];

            console.log(`[Electron] Spawning esptool: ${esptoolPath}`);
            console.log(`[Electron] Args: ${flashArgs.join(' ')}`);

            const esptool = spawn(esptoolPath, flashArgs);

            return new Promise((resolve, reject) => {
                let stderr = '';

                esptool.stdout.on('data', (data: Buffer) => {
                    const line = data.toString();
                    console.log(`[esptool]: ${line.trim()}`);

                    if (!mainWindow) return;

                    const progressMatch = line.match(/(\d+(\.\d)?)%/);
                    if (progressMatch && progressMatch[1]) {
                        const progress = Math.floor(parseFloat(progressMatch[1]));
                        mainWindow.webContents.send('flash-progress', progress);
                    }
                });

                esptool.stderr.on('data', (data: Buffer) => {
                    const line = data.toString();
                    stderr += line;
                    console.error(`[esptool stderr]: ${line.trim()}`);
                });

                esptool.on('close', (code) => {
                    console.log(`[esptool] Exited with code: ${code}`);
                    if (code === 0) {
                        mainWindow?.webContents.send('flash-progress', 100);
                        resolve('success');
                    } else {
                        reject(new Error(`Flash failed (code ${code}).\nError: ${stderr}`));
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                esptool.on('error', (err: any) => {
                    console.error('[Electron] Failed to start esptool.', err);
                    reject(new Error(`Failed to start esptool (${err.code}): ${err.message}`));
                });
            });
        }
    );

    // --- IPC handler: list-serial-ports ---
    ipcMain.handle('list-serial-ports', async (_, { filterforKnownDevices }: { filterforKnownDevices: boolean }) => {
        try {
            const ports = await SerialPort.list();

            console.log('[Electron] All serial ports found:', JSON.stringify(ports, null, 2));

            const filteredPorts = filterforKnownDevices
                ? ports.filter(
                      (port) =>
                          port.vendorId === '10C4' || // Silicon Labs (CP210x)
                          port.vendorId === '1A86' || // WCH (CH340)
                          port.vendorId === '303A' || // Espressif
                          port.vendorId === '067b' // Prolific
                  )
                : ports;

            const processedPorts = filteredPorts.map((port) => {
                if (process.platform === 'darwin' && port.path.startsWith('/dev/tty.')) {
                    return {
                        ...port,
                        path: port.path.replace('/dev/tty.', '/dev/cu.'),
                    };
                }
                return port;
            });

            console.log('[Electron] Processed ports:', processedPorts);
            return processedPorts;
        } catch (err: unknown) {
            console.error('Error listing serial ports:', err);
            return [];
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('quit', () => {
    console.log('[Electron] App is quitting.');
    stopBackend();
});
