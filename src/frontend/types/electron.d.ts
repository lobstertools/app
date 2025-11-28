import { SerialPortInfo } from 'serialport';

// Re-export this type for convenience in the rest of the app
export type { SerialPortInfo };

/**
 * Defines the IpcApi interface exposed by Electron's preload script.
 */
export interface IpcApi {
    /**
     * Registers a listener for the 'backend-ready' signal.
     * @returns A function to remove the listener.
     */
    onBackendReady: (callback: () => void) => () => void;

    /**
     * Registers a listener for the 'open-about-modal' signal.
     * @returns A function to remove the listener.
     */
    onOpenAboutModal: (callback: () => void) => () => void;

    /**
     * Asks the main process to open a file dialog for firmware.
     * @returns A promise that resolves with the selected file path or null.
     */
    openFirmwareDialog: () => Promise<string | null>;

    /**
     * Triggers the main process to flash a device.
     * @param port The COM port (e.g., 'COM3')
     * @param files The local filesystem path to the .bin files.
     * @returns A promise that resolves with 'success' or rejects with an error.
     */
    flashDevice: (
        port: string,
        files: {
            firmwarePath: string;
            bootloaderPath: string;
            partitionsPath: string;
        }
    ) => Promise<'success'>;

    /**
     * Asks the main process for a list of available serial ports.
     * @returns A promise that resolves with an array of SerialPortInfo objects.
     */
    listSerialPorts: () => Promise<SerialPortInfo[]>;

    /**
     * Registers a listener for flashing progress updates.
     * @param callback A function that will receive the progress (0-100)
     * @returns A function to remove the listener.
     */
    onFlashProgress: (callback: (progress: number) => void) => () => void;
}

// Augment the global Window interface to include 'api'
declare global {
    interface Window {
        /**
         * The secure API exposed by Electron's contextBridge.
         */
        api: IpcApi;
    }
}
