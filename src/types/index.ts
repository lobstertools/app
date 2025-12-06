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
 * Durations are given in seconds.
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
    minLockDuration: number;
    maxLockDuration: number;
    testModeDuration: number;

    channels: {
        ch1: boolean;
        ch2: boolean;
        ch3: boolean;
        ch4: boolean;
    };

    // Deterrent Configuration
    deterrents: {
        enableStreaks: boolean;
        enableRewardCode: boolean;
        rewardPenaltyDuration: number;

        // Payback Time
        enablePaybackTime: boolean;
        paybackDuration: number;
        minPaybackDuration: number;
        maxPaybackDuration: number;
    };
}

// ============================================================================
// 4. Dynamic Session Management
// ============================================================================

/**
 * Represents the complete configuration of a session.
 * Used for both the Arm Request (Input) and the Status Report (Output).
 */
export interface SessionConfig {
    /**
     * Determines how the device transitions from 'armed' to 'locked'.
     */
    triggerStrategy: TriggerStrategy;

    /**
     * If true, the device display remains dark/obscured during the session.
     */
    hideTimer: boolean;

    /**
     * Intent Metadata.
     */
    durationType: 'fixed' | 'random' | 'short' | 'medium' | 'long';
    duration: number;
    durationMin?: number;
    durationMax?: number;

    /**
     * The start delays for each channel (in seconds).
     */
    channelDelays: {
        ch1: number;
        ch2: number;
        ch3: number;
        ch4: number;
    };
}

/**
 * Group of dynamic timers indicating the current progress of the session.
 * All time units are seconds.
 */
export interface SessionTimers {
    /**
     * Lock Time remaining.
     */
    lockRemaining: number;

    /**
     * Time remaining before showing the Reward.
     */
    rewardRemaining: number;

    /**
     * Test Session Time remaining.
     */
    testRemaining: number;

    /**
     * Timeout waiting for the double-click session start.
     */
    triggerTimeout?: number;
}

/**
 * The live status response from an *active* device's API.
 * This contains all dynamic data, both live timers and accumulated stats.
 */
export interface SessionStatus {
    /**
     * Overall status
     */
    status: DeviceState;

    /**
     * The total duration of the locked phase (in seconds).
     */
    lockDuration: number;

    /**
     * Dynamic timers indicating the remaining time for various states.
     */
    timers: SessionTimers;

    /**
     * The Active Configuration.
     * Returned by the device so the UI knows exactly what parameters are running.
     * This replaces the loose top-level config fields.
     */
    config?: SessionConfig;

    /**
     * Live countdowns.
     * In 'autoCountdown', these tick down.
     * In 'buttonTrigger', these are static until locked.
     */
    channelDelaysRemaining: {
        ch1?: number;
        ch2?: number;
        ch3?: number;
        ch4?: number;
    };

    /**
     * Accumulated session statistics
     */
    stats: {
        streaks: number;
        aborted: number;
        completed: number;
        totalTimeLocked: number;
        pendingPayback: number;
    };

    /**
     * Real-time hardware telemetry.
     */
    hardware: {
        buttonPressed: boolean;
        currentPressDurationMs: number;
        rssi: number;
        freeHeap: number;
        uptime: number;
        internalTempC: number | 'N/A';
    };
}

/**
 * Reward directional unlock code
 */
export interface Reward {
    code: string;
    checksum: string;
}

// ============================================================================
// 5. Provisioning
// ============================================================================

/**
 * Input data required to provision a new device.
 * Durations are giving in seconds
 */
export interface DeviceProvisioningData {
    ssid: string;
    pass: string;
    enableStreaks: boolean;
    enablePaybackTime: boolean;
    paybackDuration: number;
    enableRewardCode: boolean;
    rewardPenaltyDuration: number;
    ch1Enabled: boolean;
    ch2Enabled: boolean;
    ch3Enabled: boolean;
    ch4Enabled: boolean;
}
