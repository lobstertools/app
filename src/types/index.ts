// --- Core Status Types ---

/** Describes the setup state of a device (e.g., in BLE provisioning or on the network). */
export type DeviceProvisioningState = 'ready' | 'new_unprovisioned';

/** Describes the internal logic state of the device (what it's actively doing). */
export type DeviceState =
    | 'ready'
    | 'countdown'
    | 'locked'
    | 'aborted'
    | 'completed'
    | 'testing';

/** Represents the health of a single communication link (e..g, UI -> Server). */
export type LinkStatus = 'ok' | 'error' | 'pending';

/**
 * The final, derived state for the UI.
 * Calculated in SessionContext by combining ConnectionHealth and DeviceSessionState.
 */
export type ComputedAppStatus =
    | DeviceState // 'ready', 'locked', 'testing', etc.
    | 'no_device_selected'
    | 'device_unreachable'
    | 'server_unreachable'
    | 'connecting'; // Covers 'backend_not_ready' and 'server_pending'

// --- Primary Interfaces ---

/** Holds the status and message for one link in the communication chain. */
export interface LinkHealth {
    status: LinkStatus;
    message: string;
}

/** Describes the health of the entire communication chain. */
export interface ConnectionHealth {
    /** Health of the UI -> Backend (localhost) link. */
    server: LinkHealth;
    /** Health of the Backend -> Device (IP/BLE) link. */
    device: LinkHealth;
}

/** Represents a device found during a scan (BLE or mDNS). Minimal info only. */
export interface DiscoveredDevice {
    id: string; // mDNS fqdn or BLE peripheral UUID
    name: string;
    state: DeviceProvisioningState;
    address: string; // IP address (mDNS) or peripheral.id (BLE)
    lastSeen: number;
}

/**
 * Represents the fully loaded, selected device and its static properties.
 * This is created when a DiscoveredDevice is selected.
 */
export interface ActiveDevice {
    id: string;
    name: string;
    address: string; // IP address
    version: string;
    features: string[];
    numberOfChannels: number;
    config: {
        abortDelaySeconds: number;
        countStreaks: boolean;
        enableTimePayback: boolean;
        abortPaybackMinutes: number;
    };
}

/**
 * The live status response from an *active* device's API.
 * This contains all dynamic data, both live timers and accumulated stats.
 */
export interface SessionStatusResponse {
    status: DeviceState;
    message?: string;

    lockSecondsRemaining: number;
    penaltySecondsRemaining: number;
    countdownSecondsRemaining: number[];
    testSecondsRemaining: number;

    hideTimer?: boolean;

    // Accumulated stats
    streaks: number;
    abortedSessions: number;
    completedSessions: number;
    totalLockedSessionSeconds: number;
    pendingPaybackSeconds: number;
}

/** The request payload to start a new session on the device. */
export interface SessionStartRequest {
    duration: number;
    hideTimer: boolean;
    startDelays: number[];
}

/**
 * Information about an available serial port (for the flasher).
 */
export interface SerialPortInfo {
    path: string;
    manufacturer?: string;
    vendorId?: string;
}

export interface Reward {
    code: string;
    timestamp: string;
}

/** * New type for the data sent during provisioning
 */
export interface DeviceProvisioningData {
    ssid: string;
    pass: string;
    abortDelaySeconds: number;
    countStreaks: boolean;
    enableTimePayback: boolean;
    abortPaybackMinutes: number;
}

/** * Type for the session configuration form
 */
export interface SessionFormData {
    type: 'time-range' | 'fixed' | 'random';
    timeRangeSelection: 'short' | 'medium' | 'long';
    duration?: number;
    penaltyDuration?: number;
    rangeMin?: number;
    rangeMax?: number;
    hideTimer: boolean;
    startDelays: number[];
}

// --- Context State Interfaces ---
// (These were already camelCase, no changes needed)

export interface SessionContextState {
    status: SessionStatusResponse | null;
    currentState: ComputedAppStatus;
    rewardHistory: Reward[];
    sessionTimeRemaining: number;
    channelDelays: number[];
    isLocking: boolean;

    // --- Session Functions---
    startSession: (values: SessionFormData) => void;
    abortSession: () => void;
    startTestSession: () => void;
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

    // --- Device Actions ---
    scanForDevices: () => void;
    provisionDevice: (
        deviceId: string,
        data: DeviceProvisioningData
    ) => Promise<boolean>;
    clearDevice: () => void;
    fetchDeviceLogs: () => void;
    factoryResetDevice: (deviceId: string) => Promise<void>;

    selectDevice: (device: DiscoveredDevice) => void;
    openDeviceModal: () => void;
    closeDeviceModal: () => void;
    closeLogModal: () => void;

    // --- Flasher Modal State & Electron APIs ---
}
