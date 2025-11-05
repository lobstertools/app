// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

// Expose a secure API to the window (your React app)
contextBridge.exposeInMainWorld('api', {
    /**
     * Registers a listener. The provided callback will be executed
     * when the 'backend-ready' signal is received from the main process.
     */
    onBackendReady: (callback: () => void) => {
        ipcRenderer.on('backend-ready', callback);
    },

    /**
     * Triggers the backend to start flashing a device on a specific port.
     * The backend will use its pre-built firmware file.
     * @param port The COM port (e.g., 'COM3' or '/dev/tty.SLAB_USBtoUART')
     * @returns A promise that resolves with 'success' or rejects with an error.
     */
    flashDevice: (port: string) => ipcRenderer.invoke('flash-device', { port }),

    /**
     * Asks the main process for a list of available serial ports.
     * @returns A promise that resolves with an array of SerialPortInfo objects.
     */
    listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),

    /**
     * Registers a listener for flashing progress updates.
     * @param callback A function that will receive the progress (0-100)
     */
    onFlashProgress: (callback: (progress: number) => void) => {
        ipcRenderer.on('flash-progress', (_event, progress) =>
            callback(progress)
        );
    },
});

console.log('Preload script loaded.');
