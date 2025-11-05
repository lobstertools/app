import { SerialPortInfo } from '../../types/index';

/**
 * Defines the IpcApi interface exposed by Electron's preload script (preload.cts)
 * to the renderer process (your React app).
 */
export interface IpcApi {
    /**
     * Registers a listener. The provided callback will be executed
     * when the 'backend-ready' signal is received from the main process.
     *
     */
    onBackendReady: (callback: () => void) => void;

    /**
     * Triggers the backend to start flashing a device on a specific port.
     *
     * @param port The COM port (e.g., 'COM3')
     * @returns A promise that resolves with 'success' or rejects with an error.
     */
    flashDevice: (port: string) => Promise<string>;

    /**
     * Asks the main process for a list of available serial ports.
     *
     * @returns A promise that resolves with an array of SerialPortInfo objects.
     */
    listSerialPorts: () => Promise<SerialPortInfo[]>;

    /**
     * Registers a listener for flashing progress updates.
     *
     * @param callback A function that will receive the progress (0-100)
     */
    onFlashProgress: (callback: (progress: number) => void) => void;
}

// Augment the global Window interface to include 'api'
declare global {
    interface Window {
        /**
         * The secure API exposed by Electron's contextBridge.
         *
         */
        api: IpcApi;
    }
}
