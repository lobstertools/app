/*
 * =================================================================
 * Project:   Lobster Lock - Self-Bondage Session Manager
 * Component: Mock Lock (mock-lock)
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Description:
 * Mock (fake) ESP lock server for development. This Node.js
 * app simulates the exact API of the physical device's
 * firmware, including the state machine, timers, and endpoints
 * (e.g., `/status`, `/arm`), allowing for frontend
 * development without hardware.
 * =================================================================
 */

import express from 'express';
import cors from 'cors';
import readline from 'readline';
import bonjour from 'bonjour';

import { DeviceDetails, DeviceFeature, Reward, SessionStatus, SessionConfig, DeviceState } from '../types/';

const app = express();
const PORT = 3003;
app.use(cors());
app.use(express.json());

// ============================================================================
// 1. CENTRALIZED MOCK CONFIGURATION
// ============================================================================
// Mirrors the C++ SystemConfig structure.
// Implements "Developer Friendly" defaults (Debug Mode).

const MOCK_CONFIGURATION = {
    // Device Identity
    identity: {
        id: 'Mock-LobsterLock',
        version: 'v1.4-mock-debug', // Explicitly marked as debug
        buildType: 'mock' as const, // 'mock' | 'debug' | 'release'
        mac: '00:1A:2B:3C:4D:5E',
        port: PORT,
    },

    // Hardware Capabilities
    hardware: {
        numberOfChannels: 4,
        features: ['footPedal', 'startCountdown', 'statusLed'] as DeviceFeature[],
        channels: { ch1: true, ch2: true, ch3: true, ch4: true },
    },

    // System Limits & Timers
    limits: {
        longPressMs: 1000, // 1s for quick triggering
        minLockSeconds: 10, // 10s minimum for quick lock cycles
        maxLockSeconds: 3600, // 1 hour
        minPenaltySeconds: 10, // 10s penalty
        maxPenaltySeconds: 3600, // 1 hour
        minPaybackTimeSeconds: 10, // 10s min debt
        maxPaybackTimeSeconds: 600, // 10 min cap
        testModeDurationSeconds: 30, // 30s hardware test
        armedTimeoutSeconds: 300, // 5 min idle timeout
    },

    // Initial "Boot" State
    initialState: {
        enableStreaks: true,
        enablePaybackTime: true,
        enableRewardCode: true,
        paybackDurationSeconds: 20,
        rewardPenaltyDuration: 10,

        // Mock Data for "Story Mode"
        startingStreaks: 5,
        startingTotalTime: 50000,
        startingCompleted: 12,
        startingAborted: 2,
        startingPendingPayback: 10,
    },
};

// --- Mutable Settings (Simulating Flash Storage) ---
// Initialized from Config
const enableStreaks = MOCK_CONFIGURATION.initialState.enableStreaks;
const enablePaybackTime = MOCK_CONFIGURATION.initialState.enablePaybackTime;
const enableRewardCode = MOCK_CONFIGURATION.initialState.enableRewardCode;
const paybackDuration = MOCK_CONFIGURATION.initialState.paybackDurationSeconds;
const rewardPenaltyDuration = MOCK_CONFIGURATION.initialState.rewardPenaltyDuration;
const channelConfig = { ...MOCK_CONFIGURATION.hardware.channels };

// --- Dynamic Session State ---
let streaks = MOCK_CONFIGURATION.initialState.startingStreaks;
let totalTimeLocked = MOCK_CONFIGURATION.initialState.startingTotalTime;
let completed = MOCK_CONFIGURATION.initialState.startingCompleted;
let aborted = MOCK_CONFIGURATION.initialState.startingAborted;
let pendingPayback = MOCK_CONFIGURATION.initialState.startingPendingPayback;

// State Machine
let currentState: DeviceState = 'ready';

// Current Active Config
let currentSessionConfig: SessionConfig | undefined;

// Timers
let lockRemaining = 0;
let rewardRemaining = 0; // Was penaltySecondsRemaining
let testRemaining = 0;
let triggerTimeout = 0;

// Dynamic channel delays
let currentDelays = { ch1: 0, ch2: 0, ch3: 0, ch4: 0 };

// Internal tracking variables
let lockDurationTotal = 0; // Total duration of current/last session
let penaltyDurationConfig = 0; // Loaded from system config on arm
let rewardHistory: Reward[] = [];

// --- Keep-Alive Session Watchdog ---
const KEEP_ALIVE_TIMEOUT_MS = 120 * 1000; // 2 minutes
let lastKeepAliveTime = 0; // 0 = disarmed

let lockInterval: NodeJS.Timeout | null = null;
let penaltyInterval: NodeJS.Timeout | null = null;
let armedInterval: NodeJS.Timeout | null = null;
let testInterval: NodeJS.Timeout | null = null;
const logBuffer: string[] = [];

// --- Helper Functions ---

/**
 * Logs a message to the console and a rolling in-memory buffer.
 */
const log = (message: string) => {
    const entry = `[${new Date().toISOString()}] MOCK: ${message}`;
    console.log(entry);
    if (logBuffer.length >= 50) logBuffer.shift();
    logBuffer.push(entry);
};

/**
 * NATO Phonetic Alphabet Lookup
 */
const getNatoWord = (char: string): string => {
    const map: { [key: string]: string } = {
        A: 'Alpha',
        B: 'Bravo',
        C: 'Charlie',
        D: 'Delta',
        E: 'Echo',
        F: 'Foxtrot',
        G: 'Golf',
        H: 'Hotel',
        I: 'India',
        J: 'Juliett',
        K: 'Kilo',
        L: 'Lima',
        M: 'Mike',
        N: 'November',
        O: 'Oscar',
        P: 'Papa',
        Q: 'Quebec',
        R: 'Romeo',
        S: 'Sierra',
        T: 'Tango',
        U: 'Uniform',
        V: 'Victor',
        W: 'Whiskey',
        X: 'X-ray',
        Y: 'Yankee',
        Z: 'Zulu',
    };
    return map[char] || '';
};

/**
 * Calculates the Alpha-Numeric Checksum (NATO-00)
 * Format: "Alpha-92"
 */
const calculateChecksum = (code: string): string => {
    let weightedSum = 0;
    let rollingVal = 0;
    const mapping: { [key: string]: number } = { U: 1, D: 2, L: 3, R: 4 };

    for (let i = 0; i < code.length; i++) {
        const char = code[i];
        const val = mapping[char] || 0;

        // Alpha-Tag Logic (Weighted Sum)
        weightedSum += val * (i + 1);

        // Numeric Logic (Rolling Hash)
        rollingVal = (rollingVal * 3 + val) % 100;
    }

    // Map to A-Z
    const alphaIndex = weightedSum % 26;
    const alphaChar = String.fromCharCode('A'.charCodeAt(0) + alphaIndex);

    return `${getNatoWord(alphaChar)}-${rollingVal.toString().padStart(2, '0')}`;
};

/**
 * Generates a unique reward entry (code + checksum).
 * Ensures checksum does not collide with existing history.
 */
const generateUniqueReward = (): Reward => {
    const chars = ['U', 'D', 'L', 'R'];
    let code = '';
    let checksum = '';
    let collision = true;

    while (collision) {
        // 1. Generate Candidate Code
        code = '';
        for (let i = 0; i < 32; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }

        // 2. Calculate Checksum
        checksum = calculateChecksum(code);

        // 3. Check collision against existing history
        collision = rewardHistory.some((r) => r.checksum === checksum);
    }

    return { code, checksum };
};

/**
 * Clears all active session timers.
 */
const stopAllTimers = () => {
    if (lockInterval) clearInterval(lockInterval);
    if (penaltyInterval) clearInterval(penaltyInterval);
    if (armedInterval) clearInterval(armedInterval);
    if (testInterval) clearInterval(testInterval);
    lockInterval = null;
    penaltyInterval = null;
    armedInterval = null;
    testInterval = null;
};

/**
 * Resets the mock device to its default "boot" state.
 * This is where the NEW code for the upcoming session is generated.
 */
const initializeState = () => {
    log('Initializing state (simulating device boot).');
    log(` -> Device: ${MOCK_CONFIGURATION.identity.id} ${MOCK_CONFIGURATION.identity.version}`);
    log(` -> Build Type: ${MOCK_CONFIGURATION.identity.buildType.toUpperCase()}`);
    log(` -> Limits: MinLock=${MOCK_CONFIGURATION.limits.minLockSeconds}s, TestMode=${MOCK_CONFIGURATION.limits.testModeDurationSeconds}s`);

    stopAllTimers();

    rewardHistory = [];

    if (enableRewardCode) {
        // Generate some fake historical codes
        const numberOfHistoricalCodes = 4;
        for (let i = 0; i < numberOfHistoricalCodes; i++) {
            rewardHistory.push(generateUniqueReward());
        }

        // No real need to reverse since they are random, but mimicking structure
        rewardHistory.reverse();
        log(`   -> Generated ${numberOfHistoricalCodes} historical reward codes.`);

        // Generate the "Current" code (Index 0)
        // This is the code the user sees in READY state to set their lock.
        const newReward = generateUniqueReward();
        rewardHistory.unshift(newReward);
        log(`Generated new reward code for this session: ${newReward.code} (${newReward.checksum})`);
    }

    // Reset stats to config starting values
    streaks = MOCK_CONFIGURATION.initialState.startingStreaks;
    totalTimeLocked = MOCK_CONFIGURATION.initialState.startingTotalTime;
    completed = MOCK_CONFIGURATION.initialState.startingCompleted;
    aborted = MOCK_CONFIGURATION.initialState.startingAborted;
    pendingPayback = MOCK_CONFIGURATION.initialState.startingPendingPayback;

    currentState = 'ready';
    currentSessionConfig = undefined;

    lockRemaining = 0;
    rewardRemaining = 0;
    testRemaining = 0;
    triggerTimeout = 0;
    lastKeepAliveTime = 0;

    currentDelays = { ch1: 0, ch2: 0, ch3: 0, ch4: 0 };
    lockDurationTotal = 0;
    penaltyDurationConfig = 0;
};

/**
 * Triggers the full abort logic, moving from 'locked' to 'aborted'.
 * Or safely resets if in 'armed'.
 * @param source The reason for the abort (e.g., 'API', 'Watchdog')
 * @returns true if the abort was successful
 */
const triggerAbort = (source: string): boolean => {
    // Safe Abort (Safety is ON)
    if (currentState === 'armed') {
        log(`🔓 Arming sequence canceled by ${source}. Returning to READY (No penalty).`);
        stopAllTimers();
        currentState = 'ready';
        return true;
    }

    // Safe Abort (Safety is ON)
    if (currentState === 'testing') {
        log(`🔬 Hardware Testing canceled by ${source}. Returning to READY.`);
        stopAllTimers();
        currentState = 'ready';
        return true;
    }

    if (currentState !== 'locked') {
        log(`triggerAbort called from ${source} but state is ${currentState}. Ignoring.`);
        return false;
    }

    // Hard Abort (Point of No Return passed)
    log(`🔓 Session aborted by ${source}!`);
    if (lockInterval) clearInterval(lockInterval);
    lockInterval = null;

    lastKeepAliveTime = 0; // <-- DISARM WATCHDOG
    aborted++; // Increment stat

    // Add to debt bank if enabled
    if (enablePaybackTime) {
        const paybackToAdd = paybackDuration;
        pendingPayback += paybackToAdd;
        log(`   -> Added ${paybackToAdd}s to payback bank. Total: ${pendingPayback}s`);
    }
    if (enableStreaks) {
        log(`   -> Streak reset to 0.`);
        streaks = 0; // Aborting resets streaks
    }

    // LOGIC CHANGE: If Reward Code is Disabled, skip penalty phase.
    if (!enableRewardCode) {
        log(`   -> Reward Code disabled. Skipping penalty timer and moving to COMPLETED.`);
        completeSession();
        return true;
    }

    // Reward Code Enabled: Enforce Penalty
    log(`   -> Penalty timer started.`);
    currentState = 'aborted';
    lockRemaining = 0;
    rewardRemaining = penaltyDurationConfig;

    // Start penalty timer
    penaltyInterval = setInterval(() => {
        if (rewardRemaining > 0) rewardRemaining--;
        else completeSession();
    }, 1000);

    return true;
};

/**
 * Starts the main 1-second lock interval.
 */
const startLockInterval = () => {
    log(`Starting main lock timer for ${lockDurationTotal} seconds.`);
    stopAllTimers();

    currentState = 'locked';
    lockRemaining = lockDurationTotal;
    lastKeepAliveTime = Date.now(); // <-- ARM WATCHDOG

    lockInterval = setInterval(() => {
        // --- Watchdog Check (LOCKED state only) ---
        if (lastKeepAliveTime > 0 && Date.now() - lastKeepAliveTime > KEEP_ALIVE_TIMEOUT_MS) {
            log('Keep-alive watchdog timeout. Aborting session.');
            triggerAbort('Watchdog');
            return; // Stop processing
        }

        if (lockRemaining > 0) {
            lockRemaining--;
            totalTimeLocked++;
        } else {
            completeSession();
        }
    }, 1000);
};

/**
 * Starts the 1-second "Armed" interval.
 * Handles both Auto-Countdown and Button Wait logic.
 */
const startArmedInterval = () => {
    log(`Device ARMED. Strategy: ${currentSessionConfig?.triggerStrategy}`);
    stopAllTimers();

    armedInterval = setInterval(() => {
        if (currentSessionConfig?.triggerStrategy === 'autoCountdown') {
            // --- AUTO MODE ---
            // Tick down channels immediately
            let allZero = true;

            // Iterate delays object
            // Typecast keys for simple iteration in mock
            (['ch1', 'ch2', 'ch3', 'ch4'] as const).forEach((key) => {
                if (currentDelays[key] > 0) {
                    allZero = false;
                    currentDelays[key]--;
                    if (currentDelays[key] === 0) {
                        log(`Channel ${key} closed (delay finished).`);
                    }
                }
            });

            // When all delays hit 0, transition to LOCKED
            if (allZero) {
                log('Auto-Countdown complete. Locking session.');
                if (armedInterval) clearInterval(armedInterval);
                armedInterval = null;
                // Arming is handled inside startLockInterval()
                startLockInterval();
            }
        } else {
            // --- BUTTON MODE ---
            // Waiting for user input (Simulated via 'L' key or /debug/button-press)
            // Decrement the timeout
            if (triggerTimeout > 0) {
                triggerTimeout--;
            } else {
                log('Button Trigger Timeout! Cancelling arming.');
                triggerAbort('Timeout');
            }
        }
    }, 1000);
};

/**
 * Stops the test mode and returns to READY.
 */
const stopTestMode = () => {
    if (testInterval) clearInterval(testInterval);
    testInterval = null;
    currentState = 'ready';
    testRemaining = 0;
    lastKeepAliveTime = 0; // Disarm watchdog
};

/**
 * Starts the 1-second test mode interval.
 */
const startTestInterval = () => {
    // Use the limit from Config
    const duration = MOCK_CONFIGURATION.limits.testModeDurationSeconds;
    log(`Starting test mode timer for ${duration} seconds.`);

    stopAllTimers();
    testRemaining = duration;
    // NOTE: Watchdog is NOT armed here

    testInterval = setInterval(() => {
        if (testRemaining > 0) {
            testRemaining--;
        } else {
            log('Test mode auto-stopped.');
            stopTestMode();
        }
    }, 1000);
};

/**
 * Transitions the state to COMPLETED.
 */
const completeSession = () => {
    log('Session COMPLETED. Awaiting reboot to generate next code.');
    stopAllTimers();
    currentState = 'completed';
    lastKeepAliveTime = 0; // Disarm watchdog
    lockRemaining = 0;
    rewardRemaining = 0;
    testRemaining = 0;
    triggerTimeout = 0;
    currentDelays = { ch1: 0, ch2: 0, ch3: 0, ch4: 0 };

    completed++; // Increment stat

    if (enableStreaks) {
        streaks++;
        log(`Streak count incremented to: ${streaks}`);
    }

    // NOTE: We do NOT generate a new reward code here.
    // The user needs to see the code they just unlocked (Index 0).
    // The new code for the NEXT session is generated in initializeState() (Reboot).
};

/**
 * Formats seconds into a human-readable string.
 */
const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes} minutes ${seconds} seconds`;
};

/**
 * Starts the mDNS/Bonjour service to announce the mock lock.
 * (Simulates Stage 2 "Operational" mode)
 */
const startMDNS = () => {
    log(`Starting mDNS advertisement...`);
    const service = bonjour().publish({
        name: MOCK_CONFIGURATION.identity.id,
        type: 'lobster-lock',
        port: PORT,
        protocol: 'tcp',
    });

    service.on('up', () => {
        log(`mDNS service announced: _lobster-lock._tcp.local on port ${PORT}`);
    });

    service.on('error', (err) => {
        log(`mDNS error: ${err.message}`);
    });
};

// --- ⌨️ Keybinding Setup (for debugging) ---
const TIME_ADJUSTMENT_SECONDS = 60;
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (_, key) => {
    // CTRL+C to exit
    if (key.ctrl && key.name === 'c') process.exit();

    // 'L' for Long-Press (Simulate Button)
    if (key.name === 'l') {
        log('⌨️  KEYPRESS: Simulated Long-Press (Button).');
        handlePhysicalButtonLongPress();
    }

    // 'D' for Double-Click (Simulate Button)
    if (key.name === 'd') {
        log('⌨️  KEYPRESS: Simulated Double-Click (Button).');
        handlePhysicalButtonDoubleClick();
    }

    // Up/Down arrows to adjust timers
    if (key.name === 'up' || key.name === 'down') {
        const adjustment = key.name === 'up' ? TIME_ADJUSTMENT_SECONDS : -TIME_ADJUSTMENT_SECONDS;
        const action = key.name === 'up' ? 'Increased' : 'Decreased';

        if (currentState === 'locked') {
            lockRemaining = Math.max(0, lockRemaining + adjustment);
            log(`🔼🔽 ${action} lock time. New remaining: ${formatTime(lockRemaining)}`);
        } else if (currentState === 'aborted') {
            rewardRemaining = Math.max(0, rewardRemaining + adjustment);
            log(`🔼🔽 ${action} penalty time. New remaining: ${formatTime(rewardRemaining)}`);
        } else if (currentState === 'armed') {
            log(`🔼🔽 Timer adjustment disabled during arming.`);
        } else if (currentState === 'testing') {
            log(`🔼🔽 Timer adjustment disabled during test mode.`);
        }
    }
});

/**
 * Long-press = abort
 */
const handlePhysicalButtonLongPress = () => {
    if (currentState === 'locked') {
        // In LOCKED state, long-press triggers abort
        log('Button Abort Triggered (Emergency Stop).');
        triggerAbort('Physical Button');
    } else {
        log(`Long-Press ignored in state: ${currentState}`);
    }
};

/**
 * Double-click = start
 */
const handlePhysicalButtonDoubleClick = () => {
    if (currentState === 'armed') {
        // In ARMED state, double-click triggers lock if strategy is buttonTrigger
        if (currentSessionConfig?.triggerStrategy === 'buttonTrigger') {
            log('Double-Click Trigger Received! Locking session.');
            startLockInterval();
        } else {
            log('Double-Click ignored (Auto mode active).');
        }
    }
};

// =================================================================
// --- API Endpoints ---
// =================================================================

/**
 * GET / (Root)
 * Simple info endpoint.
 */
app.get('/', (_, res) => {
    res.type('text/plain').send(`Mock Lobster-Lock API ${MOCK_CONFIGURATION.identity.version} (Reboot to Reset)
Endpoints:
- GET /status
- GET /details
- POST /arm
- POST /abort
- POST /start-test
- POST /keepalive
- GET /reward
- GET /log
- POST /update-wifi
- POST /factory-reset`);
});

/**
 * GET /log
 * Dumps the in-memory log buffer.
 */
app.get('/log', (_, res) => {
    res.type('text/plain').send(logBuffer.join('\n'));
});

/**
 * POST /keepalive
 * "Pets" the watchdog to prevent a timeout.
 */
app.post('/keepalive', (_, res) => {
    if (currentState === 'locked') {
        lastKeepAliveTime = Date.now();
        log('API: /keepalive received (watchdog petted).');
    } else {
        log('API: /keepalive received (ignored, not locked).');
    }
    res.sendStatus(200);
});

/**
 * POST /update-wifi
 * Simulates updating the Wi-Fi credentials (only in 'ready' state).
 */
app.post('/update-wifi', (req, res) => {
    if (currentState !== 'ready') {
        log('API: /update-wifi FAILED (not ready)');
        return res.status(409).json({
            status: 'error',
            message: 'Device must be in READY state to update Wi-Fi.',
        });
    }

    const { ssid, pass } = req.body;
    if (!ssid || pass === undefined) {
        log('API: /update-wifi FAILED (missing ssid or pass)');
        return res.status(400).json({
            status: 'error',
            message: 'Missing required fields: ssid, pass.',
        });
    }

    log(`📶 /update-wifi received. Mock NVS "saved" new credentials: SSID=${ssid}`);

    res.json({
        status: 'success',
        message: 'Wi-Fi credentials updated. Please reboot the device to apply.',
    });
});

/**
 * GET /details
 * Returns the static device configuration (ActiveDevice)
 */
app.get('/details', (_, res) => {
    log('API: /details requested.');
    const response: DeviceDetails = {
        id: MOCK_CONFIGURATION.identity.id,
        name: MOCK_CONFIGURATION.identity.id,
        address: '127.0.0.1',
        port: PORT,
        mac: MOCK_CONFIGURATION.identity.mac,
        version: MOCK_CONFIGURATION.identity.version,
        features: MOCK_CONFIGURATION.hardware.features,
        buildType: MOCK_CONFIGURATION.identity.buildType,
        channels: { ...channelConfig },

        // System Limits (Mapped from Config)
        longPressMs: MOCK_CONFIGURATION.limits.longPressMs,
        minLockDuration: MOCK_CONFIGURATION.limits.minLockSeconds,
        maxLockDuration: MOCK_CONFIGURATION.limits.maxLockSeconds,
        testModeDuration: MOCK_CONFIGURATION.limits.testModeDurationSeconds,

        deterrents: {
            enableStreaks: enableStreaks,
            enableRewardCode: enableRewardCode,
            rewardPenaltyDuration: rewardPenaltyDuration,
            enablePaybackTime: enablePaybackTime,
            paybackDuration: paybackDuration,
            minPaybackDuration: MOCK_CONFIGURATION.limits.minPaybackTimeSeconds,
            maxPaybackDuration: MOCK_CONFIGURATION.limits.maxPaybackTimeSeconds,
        },
    };
    res.json(response);
});

/**
 * GET /reward
 * Retrieve code history.
 * Logic:
 * - Ready/Completed: Visible (History review)
 * - Armed: Hidden (Cannot see code while arming)
 * - Locked: Hidden (It's in the box)
 * - Aborted: Hidden if Penalty active, Visible if Penalty over
 */
app.get('/reward', (_, res) => {
    // 1. LOCKED or ARMED: Always hidden
    if (currentState === 'locked' || currentState === 'armed') {
        log(`API: /reward DENIED (Session ${currentState})`);
        return res.status(403).json({
            status: 'forbidden',
            message: 'Reward is locked away.',
        });
    }

    // 2. ABORTED: Hidden ONLY if penalty is still ticking
    if (currentState === 'aborted' && rewardRemaining > 0) {
        log(`API: /reward DENIED (Penalty Active: ${rewardRemaining}s)`);
        return res.status(403).json({
            status: 'forbidden',
            message: `Reward locked for penalty duration (${rewardRemaining}s).`,
        });
    }

    // 3. READY, COMPLETED, TESTING: Allow
    log(`API: /reward requested. Sending ${rewardHistory.length} codes.`);
    res.json(rewardHistory);
});

/**
 * POST /arm (Replaces /start)
 * Arm the device for a session.
 */
app.post('/arm', (req, res) => {
    if (currentState !== 'ready') {
        log('API: /arm FAILED (not ready)');
        return res.status(409).json({
            status: 'error',
            message: 'Device is not ready. Cannot arm.',
        });
    }

    const config = req.body as SessionConfig;

    // Basic Validation
    if (!config.triggerStrategy || !config.channelDelays) {
        log('API: /arm FAILED (Missing required SessionConfig fields)');
        return res.status(400).json({
            status: 'error',
            message: 'Invalid SessionConfig payload.',
        });
    }

    // --- REWORKED DURATION LOGIC ---
    let resolvedDuration = 0;
    let min = 0;
    let max = 0;

    // Default lower bound if not specified
    const defaultMin = MOCK_CONFIGURATION.limits.minLockSeconds;

    if (config.durationType === 'fixed') {
        // Use the explicit 'duration' field for fixed
        resolvedDuration = config.duration || defaultMin;
        log(`   -> Fixed Duration Resolved: ${resolvedDuration}s`);
    } else {
        // Range Logic: Calculate boundaries
        switch (config.durationType) {
            case 'short':
                min = 20;
                max = 45;
                break;
            case 'medium':
                min = 60;
                max = 90;
                break;
            case 'long':
                min = 120;
                max = 180;
                break;
            case 'random':
                // For 'random', use the explicit min/max fields
                min = config.durationMin || defaultMin;
                max = config.durationMax || min + 60;
                break;
            default:
                // Fallback
                min = defaultMin;
                max = defaultMin + 60;
                break;
        }

        // Ensure max >= min to avoid negative range
        const effectiveMax = Math.max(min, max);
        resolvedDuration = Math.floor(Math.random() * (effectiveMax - min + 1)) + min;
        log(`   -> ${config.durationType.toUpperCase()} Duration Resolved: ${resolvedDuration}s (Range: ${min}-${effectiveMax}s)`);
    }

    // Store config for this session
    currentSessionConfig = config;

    // Apply Payback logic
    lockDurationTotal = resolvedDuration + pendingPayback;
    if (pendingPayback > 0) {
        log(`   -> Added ${pendingPayback}s payback time. Total: ${lockDurationTotal}s`);
    }

    penaltyDurationConfig = rewardPenaltyDuration; // From static config

    // Parse channel delays from object
    currentDelays.ch1 = Number(config.channelDelays.ch1 || 0);
    currentDelays.ch2 = Number(config.channelDelays.ch2 || 0);
    currentDelays.ch3 = Number(config.channelDelays.ch3 || 0);
    currentDelays.ch4 = Number(config.channelDelays.ch4 || 0);

    log(`🔒 /arm request. Strategy: ${currentSessionConfig?.triggerStrategy}. Total Lock Duration: ${lockDurationTotal}s.`);

    // Transition to ARMED
    currentState = 'armed';

    stopAllTimers();

    if (currentSessionConfig?.triggerStrategy === 'buttonTrigger') {
        // Manual Mode: Set timeout and wait
        triggerTimeout = MOCK_CONFIGURATION.limits.armedTimeoutSeconds;
        log('   -> Waiting for Button Trigger...');
    } else {
        // Auto Mode: Logs
        log('   -> Auto Sequence Started...');
    }

    // Start the Arming Loop (Handles both countdowns and button timeout)
    startArmedInterval();

    res.json({
        status: 'armed',
    });
});

/**
 * POST /start-test
 * Start a test session.
 */
app.post('/start-test', (_, res) => {
    if (currentState !== 'ready') {
        log('API: /start-test FAILED (not ready)');
        return res.status(409).json({
            status: 'error',
            message: 'Device must be in READY state to run test.',
        });
    }

    log(`🔬 /start-test request. Engaging relays for ${MOCK_CONFIGURATION.limits.testModeDurationSeconds}s.`);
    currentState = 'testing';
    startTestInterval(); // Watchdog is NOT armed

    res.json({
        status: 'testing',
        testSecondsRemaining: testRemaining,
    });
});

/**
 * POST /abort
 * Aborts an active session.
 */
app.post('/abort', (_, res) => {
    if (triggerAbort('API')) {
        // If triggerAbort returned true, it handled the state change
        res.json({ status: currentState === 'ready' ? 'ready' : 'aborted' });
    } else {
        log('API: /abort FAILED (not abortable)');
        return res.status(409).json({
            status: 'error',
            message: 'Device is not in a state that can be aborted.',
        });
    }
});

/**
 * POST /debug/button-press
 * Simulates a physical button press via HTTP (for testing without keyboard).
 */
app.post('/debug/button-press', (_, res) => {
    log('API: /debug/button-press received.');
    handlePhysicalButtonLongPress();
    res.json({ message: 'Button press simulated' });
});

/**
 * POST /factory-reset (Replaces /forget)
 * Simulates the device forgetting credentials and rebooting.
 */
app.post('/factory-reset', (_, res) => {
    if (currentState !== 'ready' && currentState !== 'completed') {
        log('API: /factory-reset FAILED (session active)');
        return res.status(409).json({
            status: 'error',
            message: 'Device is in an active session. Cannot reset while locked, in countdown, or in penalty.',
        });
    }

    log('API: /factory-reset received. Simulating reboot and state reset.');

    // Send the response *before* we reset state
    res.json({ status: 'resetting', message: 'Simulating reboot.' });

    // Reset the mock device state
    setTimeout(initializeState, 500); // Short delay to allow response to send
});

/**
 * GET /status
 * The main endpoint polled by the UI.
 */
app.get('/status', (_, res) => {
    const response: SessionStatus = {
        status: currentState,
        lockDuration: lockDurationTotal,

        timers: {
            lockRemaining: lockRemaining,
            rewardRemaining: rewardRemaining,
            testRemaining: testRemaining,
            triggerTimeout:
                currentState === 'armed' && currentSessionConfig?.triggerStrategy === 'buttonTrigger' ? triggerTimeout : undefined,
        },

        config: currentSessionConfig,

        channelDelaysRemaining: {
            ch1: currentDelays.ch1,
            ch2: currentDelays.ch2,
            ch3: currentDelays.ch3,
            ch4: currentDelays.ch4,
        },

        stats: {
            streaks,
            aborted,
            completed,
            totalTimeLocked: totalTimeLocked,
            pendingPayback,
        },

        hardware: {
            buttonPressed: false,
            currentPressDurationMs: 0,
            rssi: -40,
            freeHeap: 1000000,
            uptime: 10000,
            internalTempC: 30,
        },
    };

    res.json(response);
});

// --- Server Start ---
// Bind to '0.0.0.0' to allow external access, not just 'localhost'.
app.listen(PORT, '0.0.0.0', () => {
    log(`Mock ESP server running at http://localhost:${PORT}`);
    initializeState();
    startMDNS();
    log(`⌨️  KEYBINDINGS ENABLED: Use UP/DOWN arrow keys in this terminal to adjust the timer.`);
    log(`   Use 'L' key to simulate LONG PRESS (Abort).`);
    log(`   Use 'D' key to simulate DOUBLE-CLICK (Start).`);
    log(`   Use CTRL+C to exit.`);
});
