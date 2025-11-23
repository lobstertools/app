// --- Core Status Types ---

import { Peripheral } from '@abandonware/noble';

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
    name: string; // 'lobster-lock' (mDNS) or 'Lobster Lock-XYZ' (BLE)
    state: 'ready' | 'new_unprovisioned';
    address: string; // IP address (mDNS) or peripheral.id (BLE)
    port: number;
    lastSeen: number; // Date.now()
    peripheral?: Peripheral; // Store the noble object for BLE devices
    failedAttempts: number;
}

export type BuildType = 'beta' | 'debug' | 'mock' | 'release';

/**
 * Represents the fully loaded, selected device and its static properties.
 * This is created when a DiscoveredDevice is selected.
 */
export interface ActiveDevice {
    id: string;
    name: string;
    address: string;
    version: string;
    buildType: BuildType;
    features: string[];

    channels: {
        ch1: boolean;
        ch2: boolean;
        ch3: boolean;
        ch4: boolean;
    };

    // Deterrent Configuration
    config: {
        enableStreaks: boolean;
        enablePaybackTime: boolean;
        paybackTimeMinutes: number;
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
    testSecondsRemaining: number;

    delays: {
        ch1?: number;
        ch2?: number;
        ch3?: number;
        ch4?: number;
    };

    hideTimer?: boolean;

    // Accumulated session numbers
    stats: {
        streaks: number;
        aborted: number;
        completed: number;
        totalLockedTimeSeconds: number;
        pendingPaybackSeconds: number;
    };
}

/** The request payload to start a new session on the device. */
export interface SessionStartRequest {
    duration: number;
    hideTimer: boolean;
    penaltyDuration: number;

    delays: {
        ch1: number;
        ch2: number;
        ch3: number;
        ch4: number;
    };
}

export interface Reward {
    code: string;
    checksum: string;
}

/** Provisioning data */
export interface DeviceProvisioningData {
    ssid: string;
    pass: string;
    enableStreaks: boolean;
    enablePaybackTime: boolean;
    paybackTimeMinutes: number;
    ch1Enabled: boolean;
    ch2Enabled: boolean;
    ch3Enabled: boolean;
    ch4Enabled: boolean;
}
