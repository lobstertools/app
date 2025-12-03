import { Peripheral } from '@abandonware/noble';

// ============================================================================
// 1. Core Domain Types (Vocabulary)
// ============================================================================

/**
 * Hardcoded firmware feature flags.
 * UI uses these to infer interaction logic (e.g. "Hold for 3s").
 */
export const DEVICE_FEATURES = [
    'footPedal', // For long-press and double click support
    'startCountdown', // Supports auto-sequence
    'statusLed', // Supports a status LED
] as const;

export type DeviceFeature = (typeof DEVICE_FEATURES)[number];

/**
 * Describes the internal logic state of the device.
 */
export type DeviceState =
    | 'validating' // Validating hardware
    | 'ready' // Idle, waiting for command
    | 'armed' // Safety off, waiting for Trigger (Auto or Button)
    | 'locked' // Point of no return, session active
    | 'aborted' // Session cancelled
    | 'completed' // Session finished successfully
    | 'testing'; // Hardware test mode

/**
 * Defines how the device behaves while in the 'armed' state.
 */
export type TriggerStrategy =
    | 'autoCountdown' // Device is actively ticking down channel delays
    | 'buttonTrigger'; // Device is waiting for physical button input

export type BuildType = 'beta' | 'debug' | 'mock' | 'local_release' | 'release';

// ============================================================================
// 2. Connectivity & Discovery
// ============================================================================

/** Represents the health of a single communication link (e.g., UI -> Server). */
export type LinkStatus = 'ok' | 'error' | 'pending';

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

/** Describes the setup state of a device (e.g., in BLE provisioning or on the network). */
export type DeviceProvisioningState = 'ready' | 'new_unprovisioned';

/** Represents a device found during a scan (BLE or mDNS). Minimal info only. */
export interface DiscoveredDevice {
    id: string; // mDNS fqdn or BLE peripheral UUID
    name: string; // 'lobster-lock' (mDNS) or 'Lobster Lock-XYZ' (BLE)
    state: DeviceProvisioningState;
    address: string; // IP address (mDNS) or peripheral.id (BLE)
    mac: string; // MAC address when connecting over IP
    port: number;
    lastSeenTimestamp: number; // Date.now()
    peripheral?: Peripheral; // Store the noble object for BLE devices
    failedAttempts: number;
}

// ============================================================================
// 3. Static Device Configuration
// ============================================================================

/**
 * Represents the fully loaded, selected device and its static properties.
 * This is created when a DiscoveredDevice is selected and details are fetched.
 */
export interface DeviceDetails {
    id: string;
    name: string;
    address: string;
    port: number;
    mac: string;
    version: string;
    buildType: BuildType;
    features: DeviceFeature[];

    // --- System Limits ---
    longPressMs: number;
    minLockSeconds: number;
    maxLockSeconds: number;
    minPenaltySeconds: number;
    maxPenaltySeconds: number;
    testModeDurationSeconds: number;

    channels: {
        ch1: boolean;
        ch2: boolean;
        ch3: boolean;
        ch4: boolean;
    };

    // Deterrent Configuration
    deterrents: {
        enableStreaks: boolean;
        enablePaybackTime: boolean;
        paybackDurationSeconds: number;
        // Payback Limits
        minPaybackTimeSeconds: number;
        maxPaybackTimeSeconds: number;
        enableRewardCode: boolean;
    };
}

// ============================================================================
// 4. Dynamic Session Management
// ============================================================================

/**
 * The unified payload to Arm/Start a session.
 * Merges the execution logic (strategy) with the session parameters.
 */
export interface SessionArmRequest {
    /**
     * Determines how the device transitions from 'armed' to 'locked'.
     */
    triggerStrategy: TriggerStrategy;

    /**
     * The total duration of the locked phase (in seconds).
     */
    lockDurationSeconds: number;

    /**
     * If true, the device display remains dark/obscured during the session.
     */
    hideTimer: boolean;

    /**
     * Time added to duration if a violation occurs (in seconds).
     */
    penaltyDurationSeconds: number;

    /**
     * The start delays for each channel (in seconds).
     * - If strategy is 'autoCountdown': These are the countdown timers.
     * - If strategy is 'buttonTrigger': These are applied AFTER the button press.
     */
    channelDelaysSeconds: {
        ch1: number;
        ch2: number;
        ch3: number;
        ch4: number;
    };
}

/**
 * The live status response from an *active* device's API.
 * This contains all dynamic data, both live timers and accumulated stats.
 */
export interface SessionStatus {
    status: DeviceState;
    message?: string;

    lockSecondsRemaining: number;
    penaltySecondsRemaining: number;
    testSecondsRemaining: number;

    /**
     * Context for the 'armed' state.
     * Populated when status is 'armed' or 'locked'.
     */
    triggerStrategy?: TriggerStrategy;

    /** * Timeout waiting for the double-click session start
     */
    triggerTimeoutRemainingSeconds?: number;

    /**
     * Live countdowns.
     * In 'autoCountdown', these tick down.
     * In 'buttonTrigger', these are static until locked.
     */
    channelDelaysRemainingSeconds: {
        ch1?: number;
        ch2?: number;
        ch3?: number;
        ch4?: number;
    };

    hideTimer?: boolean;

    stats: {
        streaks: number;
        aborted: number;
        completed: number;
        totalTimeLockedSeconds: number;
        pendingPaybackSeconds: number;
    };

    /**
     * Real-time hardware telemetry.
     */
    hardwareStatus: {
        buttonPressed: boolean;
        currentPressDurationMs: number;
        rssi: number;
        freeHeap: number;
        uptimeSeconds: number;
        internalTempC: number | 'N/A';
    };
}

export interface Reward {
    code: string;
    checksum: string;
}

// ============================================================================
// 5. Provisioning
// ============================================================================

/** Input data required to provision a new device. */
export interface DeviceProvisioningData {
    ssid: string;
    pass: string;
    enableStreaks: boolean;
    enablePaybackTime: boolean;
    paybackDurationSeconds: number;
    enableRewardCode: boolean;
    ch1Enabled: boolean;
    ch2Enabled: boolean;
    ch3Enabled: boolean;
    ch4Enabled: boolean;
}
