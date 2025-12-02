import { ReactNode, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { App } from 'antd';

import { DiscoveredDevice, DeviceDetails, ConnectionHealth, DeviceProvisioningData } from '../../types';
import { apiClient } from '../lib/apiClient';
import { SerialPortInfo } from '../types/electron';
import { useAppRuntime } from './useAppRuntime';
import { DeviceHealthResponse, DeviceManagerContext, DeviceManagerContextState } from './useDeviceManager';

// Initial state for the new ConnectionHealth (2-link version)
const INITIAL_HEALTH: ConnectionHealth = {
    server: { status: 'pending', message: 'Connecting to server...' },
    device: { status: 'pending', message: 'Waiting for server...' },
};

const STORAGE_KEY_DEVICE_ID = 'lobster-device-id';
const STORAGE_KEY_LEGACY = 'lobster-active-device';

/**
 * Main provider component. Wraps the application to provide global state
 * and logic for discovering, provisioning, and interacting with devices.
 */
export const DeviceManagerProvider = ({ children }: { children: ReactNode }) => {
    // This is the one place we consume AppRuntimeContext
    const { isBackendReady, isElectron } = useAppRuntime();
    const { notification } = App.useApp();

    const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>(INITIAL_HEALTH);

    // Initialize as null, using a fresh fetch in the useEffect below.
    const [activeDevice, setActiveDevice] = useState<DeviceDetails | null>(null);

    const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
    const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isProvisioning, setIsProvisioning] = useState(false);

    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logContent, setLogContent] = useState('');

    // --- State for new Device Settings Modal ---
    const [isDeviceSettingsModalOpen, setIsDeviceSettingsModalOpen] = useState(false);
    const [isUpdatingWifi, setIsUpdatingWifi] = useState(false);

    // --- State for Flashing ---
    const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([]);
    const [isScanningPorts, setIsScanningPorts] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flashProgress, setFlashProgress] = useState(0);

    // --- Device Management Functions ---

    /**
     * Triggers a new scan for BLE (new) and mDNS (ready) devices.
     * Populates the `discoveredDevices` list.
     */
    const scanForDevices = useCallback(
        async (silent = false) => {
            if (!silent) {
                setIsScanning(true);
            }
            try {
                const response = await apiClient.get<DiscoveredDevice[]>('/devices');
                // Since the backend handles cache, this returns the current "Truth"
                setDiscoveredDevices(response.data);
            } catch (err) {
                console.error('Failed to fetch devices:', err);
                if (!silent) {
                    notification.error({ message: 'Failed to scan for devices' });
                }
            } finally {
                if (!silent) {
                    setIsScanning(false);
                }
            }
        },
        [notification]
    );

    /**
     * Sends Wi-Fi credentials and configuration data to a 'new' (BLE) device.
     * @param deviceId The ID of the BLE device to provision.
     * @param data The provisioning data (SSID, pass, etc.).
     * @returns True on success, false on failure.
     */
    const provisionDevice = useCallback(
        async (deviceId: string, data: DeviceProvisioningData) => {
            setIsProvisioning(true);
            try {
                const response = await apiClient.post(`/devices/${deviceId}/provision`, data);
                notification.success({
                    message: 'Provisioning Sent!',
                    description: response.data?.message || 'Device should reboot and appear on the network.',
                });
                scanForDevices(); // Refresh the list
                setIsProvisioning(false);
                return true;
            } catch (err: any) {
                const msg = err.response?.data?.message || 'Failed to provision device.';
                notification.error({
                    message: 'Provisioning Failed',
                    description: msg,
                });
                setIsProvisioning(false);
                return false;
            }
        },
        [notification, scanForDevices]
    );

    /**
     * Sends new Wi-Fi credentials to an already provisioned, 'ready' device.
     * @param deviceId The ID of the active device.
     * @param ssid The new Wi-Fi SSID.
     * @param pass The new Wi-Fi password.
     * @returns True on success, false on failure.
     */
    const updateWifi = useCallback(
        async (deviceId: string, ssid: string, pass: string) => {
            setIsUpdatingWifi(true);
            try {
                await apiClient.post(`/devices/${deviceId}/update-wifi`, {
                    ssid,
                    pass,
                });
                // Notification is handled by the modal on success
                return true;
            } catch (err: any) {
                const msg = err.response?.data?.message || 'Failed to send Wi-Fi update command.';
                notification.error({
                    message: 'Update Failed',
                    description: msg,
                });
                return false;
            } finally {
                setIsUpdatingWifi(false);
            }
        },
        [notification]
    );

    /**
     * Deselects the currently active device, clears it from localStorage,
     * and re-opens the device selection modal.
     */
    const clearDevice = useCallback(() => {
        setActiveDevice(null);

        localStorage.removeItem(STORAGE_KEY_DEVICE_ID);
        localStorage.removeItem(STORAGE_KEY_LEGACY);

        setConnectionHealth({
            server: { status: 'ok', message: 'Server connected.' },
            device: { status: 'pending', message: 'No device selected.' },
        });
        setIsDeviceModalOpen(true);
    }, []);

    /**
     * Helper to fetch and update device details.
     * Used by selectDevice and by the startup effect.
     */
    const refreshDeviceDetails = useCallback(async (deviceId: string) => {
        const response = await apiClient.get<DeviceDetails>(`/devices/${deviceId}/details`);
        const fullDevice = response.data;
        fullDevice.id = deviceId; // Ensure the ID is set

        const fwVersion = (fullDevice.version || '').toLowerCase();

        // Determine BuildType based on version string priorities
        if (fwVersion.includes('mock')) {
            fullDevice.buildType = 'mock';
        } else if (fwVersion.includes('debug')) {
            fullDevice.buildType = 'debug';
        } else if (fwVersion.includes('local')) {
            fullDevice.buildType = 'local_release';
        } else if (fwVersion.includes('beta')) {
            fullDevice.buildType = 'beta';
        } else {
            // Fallback for standard production builds
            fullDevice.buildType = 'release';
        }

        setActiveDevice(fullDevice);

        localStorage.setItem(STORAGE_KEY_DEVICE_ID, deviceId);
        return fullDevice;
    }, []);

    /**
     * Sets a 'ready' discovered device as the new `activeDevice`.
     * Fetches its full details and saves it to localStorage.
     * @param device The device (from `discoveredDevices`) to select.
     */
    const selectDevice = useCallback(
        async (device: DiscoveredDevice) => {
            if (device.state !== 'ready') {
                notification.error({
                    message: 'Device not ready',
                    description: 'This device must be provisioned first.',
                });
                return;
            }

            setConnectionHealth(INITIAL_HEALTH);
            setIsDeviceModalOpen(false);

            try {
                await refreshDeviceDetails(device.id);
            } catch (err) {
                console.error('Failed to fetch device details:', err);
                notification.error({
                    message: 'Failed to select device',
                    description: 'Could not fetch device details. Please try again.',
                });
                clearDevice(); // Go back to 'no device' state
            }
        },
        [clearDevice, notification, refreshDeviceDetails]
    );

    /**
     * Sends a factory reset command to the specified device.
     * On success, clears the active device.
     * @param deviceId The ID of the device to reset (must be an active device).
     */
    const factoryResetDevice = useCallback(
        async (deviceId: string) => {
            try {
                await apiClient.post(`/devices/${deviceId}/factory-reset`);
                notification.success({
                    message: 'Factory Reset Complete',
                    description: 'The device is rebooting into provisioning mode.',
                });
                clearDevice(); // Device is no longer 'active'
            } catch (err: any) {
                const msg = err.response?.data?.message || 'Failed to send reset command.';
                notification.error({
                    message: 'Reset Failed',
                    description: msg,
                });
            }
        },
        [clearDevice, notification]
    );

    /**
     * Opens the device selection modal.
     */
    const openDeviceModal = () => setIsDeviceModalOpen(true);

    /**
     * Closes the device selection modal.
     */
    const closeDeviceModal = () => setIsDeviceModalOpen(false);

    /**
     * Opens the device settings modal.
     */
    const openDeviceSettingsModal = () => setIsDeviceSettingsModalOpen(true);

    /**
     * Closes the device settings modal.
     */
    const closeDeviceSettingsModal = () => setIsDeviceSettingsModalOpen(false);

    /**
     * Fetches the full diagnostic log contents from the currently
     * active device and opens the log modal.
     */
    const openDeviceLogs = useCallback(async () => {
        if (!activeDevice) return;
        setLogContent('Loading logs from device...');
        setIsLogModalOpen(true);
        try {
            const response = await apiClient.get(`/devices/${activeDevice.id}/log`, { responseType: 'text' });
            setLogContent(response.data);
        } catch (err: any) {
            const msg = axios.isAxiosError(err) ? err.response?.data : 'Failed to fetch logs.';
            setLogContent(`Error:\n${msg}`);
        }
    }, [activeDevice]);

    /**
     * Closes the log viewer modal.
     */
    const closeLogModal = () => setIsLogModalOpen(false);

    /**
     * Scans for available serial ports (Electron only).
     */
    const scanForSerialPorts = useCallback(
        async (filterKnownDevices: boolean = true) => {
            if (!isElectron) return;
            setIsScanningPorts(true);
            try {
                const ports = await window.api.listSerialPorts(filterKnownDevices);
                setSerialPorts(ports);
            } catch (err: any) {
                notification.error({
                    message: 'Failed to list serial ports',
                    description: err.message,
                });
            } finally {
                setIsScanningPorts(false);
            }
        },
        [isElectron, notification]
    );

    /**
     * Opens the Electron dialog to select a firmware file.
     * @returns File path or null.
     */
    const selectFirmwareFile = useCallback(async () => {
        if (!isElectron) return null;
        try {
            return await window.api.openFirmwareDialog();
        } catch (err: any) {
            notification.error({
                message: 'Failed to open file dialog',
                description: err.message,
            });
            return null;
        }
    }, [isElectron, notification]);

    /**
     * Flashes a device with the selected firmware (Electron only).
     * This function now throws an error on failure instead of
     * showing a notification.
     *
     * @returns True on success.
     * @throws An error with the failure message.
     */
    const flashDevice = useCallback(
        async (
            port: string,
            files: {
                firmwarePath: string;
                bootloaderPath: string;
                partitionsPath: string;
            }
        ) => {
            if (!isElectron) {
                // Still return false for the non-electron case
                return false;
            }

            setIsFlashing(true);
            setFlashProgress(0);

            try {
                // This will either resolve with 'success'
                // or throw an error from the main process
                await window.api.flashDevice(port, files);

                // Success!
                notification.success({
                    message: 'Device flashed successfully!',
                });
                return true;
            } finally {
                // This always runs, ensuring we stop the loading state
                // even if an error was thrown.
                setIsFlashing(false);
                setFlashProgress(0); // Reset progress
            }
        },
        [isElectron, notification]
    );

    // --- Health & Keepalive (Internal) ---

    const fetchHealth = useCallback(async () => {
        if (!isBackendReady) {
            setConnectionHealth(INITIAL_HEALTH); // Backend not yet ready
            return;
        }

        if (!activeDevice) {
            setConnectionHealth({
                server: { status: 'ok', message: 'Server connected.' },
                device: { status: 'pending', message: 'No device selected.' },
            });
            return;
        }

        try {
            // Check Link 2 (Backend -> Device)
            const response = await apiClient.get<DeviceHealthResponse>(`/devices/${activeDevice.id}/health`);

            // SUCCESS: Link 1 (UI -> Server) is OK. Link 2 is from response.
            setConnectionHealth({
                server: { status: 'ok', message: 'Server connected.' },
                device: {
                    status: response.data.status,
                    message: response.data.message,
                },
            });
        } catch (err: any) {
            if (axios.isAxiosError(err)) {
                if (err.response) {
                    // SERVER IS REACHABLE, but returned an error (404, 503)
                    // This means Link 1 (UI -> Server) is 'ok'.
                    // Link 2 (Backend -> Device) is 'error'.
                    const deviceMsg = err.response.data?.message || 'Device is unreachable.';
                    setConnectionHealth({
                        server: { status: 'ok', message: 'Server connected.' },
                        device: { status: 'error', message: deviceMsg },
                    });
                } else {
                    // SERVER IS UNREACHABLE (Network error, DNS, ECONNREFUSED)
                    // Link 1 (UI -> Server) is 'error'.
                    setConnectionHealth({
                        server: {
                            status: 'error',
                            message: 'Server unreachable. Check connection.',
                        },
                        device: {
                            status: 'pending',
                            message: 'Waiting for server connection...',
                        },
                    });
                }
            } else {
                // A non-Axios JS error occurred
                console.error('Non-Axios error in fetchHealth:', err);
                setConnectionHealth({
                    server: {
                        status: 'error',
                        message: 'An application error occurred.',
                    },
                    device: { status: 'pending', message: 'Waiting...' },
                });
            }
        }
    }, [activeDevice, isBackendReady]);

    const sendKeepAlive = useCallback(async () => {
        if (!activeDevice) return;
        try {
            await apiClient.post(`/devices/${activeDevice.id}/keepalive`);
        } catch (err) {
            console.warn('Failed to send keep-alive ping:', err);
        }
    }, [activeDevice]);

    // --- Effects ---

    // Startup Device Refresh & Migration
    useEffect(() => {
        if (!isBackendReady) return;

        // 1. Retrieve the ID
        let storedId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);

        // 2. Migration: If no ID found, check for the legacy JSON blob
        if (!storedId) {
            const legacyData = localStorage.getItem(STORAGE_KEY_LEGACY);
            if (legacyData) {
                try {
                    const parsed = JSON.parse(legacyData);
                    if (parsed && parsed.id) {
                        console.log('[DeviceManager] Migrating legacy storage to ID-only format.');
                        storedId = parsed.id;
                        // Save the new format immediately
                        localStorage.setItem(STORAGE_KEY_DEVICE_ID, parsed.id);
                        // Clear the old format
                        localStorage.removeItem(STORAGE_KEY_LEGACY);
                    }
                } catch (e) {
                    console.warn('[DeviceManager] Failed to migrate legacy storage:', e);
                    localStorage.removeItem(STORAGE_KEY_LEGACY);
                }
            }
        }

        // 3. If we have an ID (either existing or migrated), fetch the details
        if (storedId) {
            console.log(`[DeviceManager] Restoring session for device: ${storedId}`);
            refreshDeviceDetails(storedId).catch((err) => {
                console.warn('[DeviceManager] Startup refresh failed:', err);

                // If the backend explicitly returns 404 (Not Found),
                // it means the device ID in localStorage is invalid or expired.
                // We MUST clear it to stop the UI from polling a dead ID.
                if (axios.isAxiosError(err) && err.response?.status === 404) {
                    console.warn('[DeviceManager] Stale device ID detected (404). Clearing...');
                    clearDevice();
                }
            });
        }
        // Disable exhaustive-deps because we only want this to run once when 'isBackendReady' flips to true
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isBackendReady]);

    useEffect(() => {
        fetchHealth();
        const healthPollTimer = setInterval(fetchHealth, 10000);
        return () => clearInterval(healthPollTimer);
    }, [fetchHealth]);

    useEffect(() => {
        const isFullyConnected = connectionHealth.server.status === 'ok' && connectionHealth.device.status === 'ok';

        if (!activeDevice || !isFullyConnected) return;

        sendKeepAlive();
        const keepAliveTimer = setInterval(sendKeepAlive, 10000);
        return () => clearInterval(keepAliveTimer);
    }, [activeDevice, connectionHealth, sendKeepAlive]);

    // Effect to listen for flash progress
    useEffect(() => {
        // Only run this effect in Electron
        if (!isElectron) return;

        // Register the listener from window.api
        const removeListener = window.api.onFlashProgress((progress) => {
            // Only update state if we are actively in the process of flashing
            if (isFlashing) {
                setFlashProgress(progress);
            }
        });

        // Return the cleanup function
        return () => {
            removeListener();
        };
    }, [isElectron, isFlashing]);

    const value: DeviceManagerContextState = {
        connectionHealth,
        activeDevice,
        discoveredDevices,
        isDeviceModalOpen,
        isScanning,
        isProvisioning,
        isLogModalOpen,
        logContent,
        scanForDevices,
        provisionDevice,
        selectDevice,
        clearDevice,
        openDeviceModal,
        closeDeviceModal,
        factoryResetDevice,
        openDeviceLogs,
        closeLogModal,

        serialPorts,
        isScanningPorts,
        isFlashing,
        flashProgress,
        scanForSerialPorts,
        selectFirmwareFile,
        flashDevice,

        isDeviceSettingsModalOpen,
        openDeviceSettingsModal,
        closeDeviceSettingsModal,
        isUpdatingWifi,
        updateWifi,
    };

    return <DeviceManagerContext.Provider value={value}>{children}</DeviceManagerContext.Provider>;
};

export default DeviceManagerContext;
