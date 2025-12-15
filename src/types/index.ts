import { Peripheral } from '@abandonware/noble';

// ============================================================================
// 1. Core Domain Types (Vocabulary)
// ============================================================================

export type DeviceState = 'READY' | 'ARMED' | 'LOCKED' | 'ABORTED' | 'COMPLETED' | 'TESTING';

export type SessionOutcome = 'SUCCESS' | 'ABORTED' | 'UNKNOWN';

export type TriggerStrategy = 'STRAT_AUTO_COUNTDOWN' | 'STRAT_BUTTON_TRIGGER';

export type DurationType = 'DUR_FIXED' | 'DUR_RANDOM' | 'DUR_RANGE_SHORT' | 'DUR_RANGE_MEDIUM' | 'DUR_RANGE_LONG';

export type DeterrentStrategy = 'DETERRENT_FIXED' | 'DETERRENT_RANDOM';

export const DEVICE_FEATURES = ['footPedal', 'startCountdown', 'statusLed'] as const;

export type DeviceFeature = (typeof DEVICE_FEATURES)[number];
export type BuildType = 'beta' | 'debug' | 'mock' | 'local_release' | 'release';

// ============================================================================
// 2. Hardware Interfaces
// ============================================================================

export interface Channels {
    ch1: boolean;
    ch2: boolean;
    ch3: boolean;
    ch4: boolean;
}

export interface Telemetry {
    buttonPressed: boolean;
    currentPressDurationMs: number;
    rssi: number;
    freeHeap: number;
    uptime: number;
    internalTempC: number | 'N/A';
}

// ============================================================================
// 3. System Interfaces (Identity & Network)
// ============================================================================

/**
 * Represents the firmware identity and build metadata.
 */
export interface Identity {
    /** The friendly name reported by firmware (e.g., "Lobster Lock") */
    name: string;

    /** Version string (e.g., "1.2.0") */
    version: string;

    /** Build type classification */
    buildType: BuildType;

    /** Compilation date (__DATE__) */
    buildDate: string;

    /** Compilation time (__TIME__) */
    buildTime: string;

    /** C++ Standard version used for compilation (__cplusplus) */
    cppStandard: number;
}

/**
 * Represents the network configuration and state.
 */
export interface Network {
    ssid: string;
    rssi: number;
    mac: string;
    ip: string;
    subnetMask: string;
    gateway: string;
    hostname: string;
    port: number;
}

// ============================================================================
// 4. Connectivity & Discovery
// ============================================================================

export type LinkStatus = 'ok' | 'error' | 'pending';

export interface LinkHealth {
    status: LinkStatus;
    message: string;
}

export interface ConnectionHealth {
    server: LinkHealth;
    device: LinkHealth;
}

export type ComputedAppStatus =
    | DeviceState
    | 'verifying_hardware'
    | 'no_device_selected'
    | 'device_unreachable'
    | 'server_unreachable'
    | 'connecting';

export type DeviceProvisioningState = 'ready' | 'new_unprovisioned';

export interface DiscoveredDevice {
    id: string;
    name: string;
    state: DeviceProvisioningState;
    address: string;
    mac: string;
    port: number;
    lastSeenTimestamp: number;
    peripheral?: Peripheral;
    failedAttempts: number;
}

// ============================================================================
// 5. Firmware Configuration Structures
// ============================================================================

export interface SessionPresets {
    shortMin: number;
    shortMax: number;
    mediumMin: number;
    mediumMax: number;
    longMin: number;
    longMax: number;
    minSessionDuration: number;
    maxSessionDuration: number;
}

export interface DeterrentConfig {
    enableStreaks: boolean;
    enableRewardCode: boolean;
    rewardPenaltyStrategy: DeterrentStrategy;
    rewardPenaltyMin: number;
    rewardPenaltyMax: number;
    rewardPenalty: number;
    enablePaybackTime: boolean;
    paybackTimeStrategy: DeterrentStrategy;
    paybackTimeMin: number;
    paybackTimeMax: number;
    paybackTime: number;
}

export interface SystemDefaults {
    longPressDuration: number;
    extButtonSignalDuration: number;
    testModeDuration: number;
    keepAliveInterval: number;
    keepAliveMaxStrikes: number;
    bootLoopThreshold: number;
    stableBootTime: number;
    wifiMaxRetries: number;
    armedTimeout: number;
}

export interface SessionConfig {
    durationType: DurationType;
    durationFixed: number;
    durationMin: number;
    durationMax: number;
    triggerStrategy: TriggerStrategy;
    channelDelays: [number, number, number, number];
    hideTimer: boolean;
    disableLED: boolean;
}

export interface SessionTimers {
    lockDuration: number;
    debtServed: number;
    penaltyDuration: number;
    lockRemaining: number;
    penaltyRemaining: number;
    testRemaining: number;
    triggerTimeout: number;
    channelDelays: [number, number, number, number];
}

export interface SessionStats {
    streaks: number;
    completed: number;
    aborted: number;
    paybackAccumulated: number;
    totalLockedTime: number;
}

export interface Reward {
    code: string;
    checksum: string;
}

// ============================================================================
// 6. Aggregated Device Objects
// ============================================================================

export interface DeviceDetails {
    // --- Device ID
    id: string;

    // --- System Info ---
    identity: Identity;
    network: Network;

    // --- Hardware & Support ---
    features: DeviceFeature[];
    channels: Channels;

    // --- Firmware Configuration Structures ---
    presets: SessionPresets;
    deterrentConfig: DeterrentConfig;
    defaults: SystemDefaults;
}

export interface SessionStatus {
    state: DeviceState;
    outcome: SessionOutcome;
    verified: boolean;
    config: SessionConfig;
    timers: SessionTimers;
    stats: SessionStats;
    telemetry: Telemetry;
}

// ============================================================================
// 7. Provisioning
// ============================================================================

export interface DeviceProvisioningData {
    ssid: string;
    pass: string;
    channels: Channels;
    presets: SessionPresets;
    deterrents: DeterrentConfig;
}
