import { createContext, useContext } from 'react';
import {
    ActiveDevice,
    ConnectionHealth,
    DeviceProvisioningData,
    DiscoveredDevice,
} from '../../types';
import { SerialPortInfo } from '../types/electron';

export interface DeviceHealthResponse {
    status: 'ok' | 'error';
    message: string;
}

export interface DeviceManagerContextState {
    connectionHealth: ConnectionHealth;
    activeDevice: ActiveDevice | null;
    discoveredDevices: DiscoveredDevice[];
    isDeviceModalOpen: boolean;
    isScanning: boolean;
    isProvisioning: boolean;
    isLogModalOpen: boolean;
    logContent: string;
    scanForDevices: (silent?: boolean) => void;
    provisionDevice: (
        deviceId: string,
        data: DeviceProvisioningData
    ) => Promise<boolean>;
    selectDevice: (device: DiscoveredDevice) => void;
    clearDevice: () => void;
    openDeviceModal: () => void;
    closeDeviceModal: () => void;
    factoryResetDevice: (deviceId: string) => void;
    fetchDeviceLogs: () => void;
    closeLogModal: () => void;

    // --- Flashing Properties ---
    serialPorts: SerialPortInfo[];
    isScanningPorts: boolean;
    isFlashing: boolean;
    flashProgress: number;
    scanForSerialPorts: () => void;
    selectFirmwareFile: () => Promise<string | null>;
    flashDevice: (port: string, firmwarePath: string) => Promise<boolean>;

    // --- Properties for Device Settings ---
    isDeviceSettingsModalOpen: boolean;
    openDeviceSettingsModal: () => void;
    closeDeviceSettingsModal: () => void;
    isUpdatingWifi: boolean;
    updateWifi: (
        deviceId: string,
        ssid: string,
        pass: string
    ) => Promise<boolean>;
}

export const DeviceManagerContext = createContext<
    DeviceManagerContextState | undefined
>(undefined);

/**
 * Custom hook to consume the DeviceManagerContext.
 * Provides access to all device state and management functions.
 */
export const useDeviceManager = () => {
    const ctx = useContext(DeviceManagerContext);
    if (!ctx)
        throw new Error(
            'useDeviceManager must be used within a DeviceManagerProvider'
        );
    return ctx;
};
