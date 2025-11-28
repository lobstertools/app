// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { SerialPortInfo } from '../frontend/types/electron';

// Expose a secure API to the window (your React app)
contextBridge.exposeInMainWorld('api', {
    /**
     * Registers a listener. The provided callback will be executed
     * when the 'backend-ready' signal is received from the main process.
     */
    onBackendReady: (callback: () => void) => {
        // Store the callback to be able to remove it
        const listener = () => callback();
        ipcRenderer.on('backend-ready', listener);
        // Return a function to remove the listener
        return () => ipcRenderer.removeListener('backend-ready', listener);
    },

    /**
     *Registers a listener for the 'open-about-modal' signal from the main menu.
     */
    onOpenAboutModal: (callback: () => void) => {
        const listener = () => callback();
        ipcRenderer.on('open-about-modal', listener);
        return () => ipcRenderer.removeListener('open-about-modal', listener);
    },

    /**
     * Asks the main process to open a file dialog for firmware.
     * @returns A promise that resolves with the selected file path or null.
     */
    openFirmwareDialog: () => ipcRenderer.invoke('open-firmware-dialog'),

    /**
     * Triggers the backend to start flashing a device on a specific port.
     * @param port The COM port (e.g., 'COM3' or '/dev/tty.SLAB_USBtoUART')
     * @param firmwarePath The local filesystem path to the .bin firmware file.
     * @returns A promise that resolves with 'success' or rejects with an error.
     */
    flashDevice: (port: string, files: { firmwarePath: string; bootloaderPath: string; partitionsPath: string }) =>
        ipcRenderer.invoke('flash-device', { port, files }),

    /**
     * Asks the main process for a list of available serial ports.
     * @returns A promise that resolves with an array of SerialPortInfo objects.
     */
    listSerialPorts: (filterforKnownDevices: boolean): Promise<SerialPortInfo[]> =>
        ipcRenderer.invoke('list-serial-ports', { filterforKnownDevices }),

    /**
     * Registers a listener for flashing progress updates.
     * @param callback A function that will receive the progress (0-100)
     * @returns A function that, when called, removes the listener.
     */
    onFlashProgress: (callback: (progress: number) => void) => {
        const listener = (_event: IpcRendererEvent, progress: number) => callback(progress);
        ipcRenderer.on('flash-progress', listener);
        // Return a function to remove the listener
        return () => ipcRenderer.removeListener('flash-progress', listener);
    },
});

console.log('Preload script loaded.');
