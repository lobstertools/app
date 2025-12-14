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

import {
    DeviceDetails,
    DeviceFeature,
    Reward,
    SessionStatus,
    SessionConfig,
    DeviceState,
    Identity,
    Network,
    SessionPresets,
    DeterrentConfig,
    SystemDefaults,
} from '../types/';

const app = express();
const PORT = 3003;
app.use(cors());
app.use(express.json());

// ============================================================================
// 1. CENTRALIZED MOCK CONFIGURATION
// ============================================================================
// Implements "Developer Friendly" defaults (Debug Mode).

const MOCK_CONFIGURATION = {
    // Device Identity
    identity: {
        name: 'Lobster Lock (Mock)',
        version: 'v1.5-mock-debug',
        buildType: 'mock',
        buildDate: new Date().toISOString().split('T')[0],
        buildTime: new Date().toTimeString().split(' ')[0],
        cppStandard: 201703,
    } as Identity,

    // Network Config
    network: {
        ssid: 'Mock-WiFi-Network',
        rssi: -45,
        mac: '00:1A:2B:3C:4D:5E',
        ip: '127.0.0.1',
        subnetMask: '255.255.255.0',
        gateway: '127.0.0.1',
        hostname: 'lobster-lock-mock',
        port: PORT,
    } as Network,

    // Hardware Capabilities
    hardware: {
        numberOfChannels: 4,
        features: ['footPedal', 'startCountdown', 'statusLed'] as DeviceFeature[],
        channels: { ch1: true, ch2: false, ch3: true, ch4: false },
    },

    // System Limits & Defaults
    defaults: {
        longPressDuration: 1000, // 1s for quick triggering
        extButtonSignalDuration: 500,
        testModeDuration: 30, // 30s hardware test
        keepAliveInterval: 10000,
        keepAliveMaxStrikes: 3,
        bootLoopThreshold: 3,
        stableBootTime: 30000,
        wifiMaxRetries: 5,
        armedTimeout: 300, // 5 min idle timeout
    } as SystemDefaults,

    // Duration Presets
    presets: {
        shortMin: 10,
        shortMax: 20,
        mediumMin: 60,
        mediumMax: 90,
        longMin: 120,
        longMax: 180,
        minSessionDuration: 10, // 10s for debug
        maxSessionDuration: 3600, // 1 hr for debug
    } as SessionPresets,

    // Initial "Boot" State
    initialDeterrents: {
        enableStreaks: true,
        enableRewardCode: true,
        rewardPenaltyStrategy: 'DETERRENT_FIXED',
        rewardPenaltyMin: 300,
        rewardPenaltyMax: 900,
        rewardPenalty: 10, // 10s for debug
        enablePaybackTime: true,
        paybackTimeStrategy: 'DETERRENT_FIXED',
        paybackTimeMin: 300,
        paybackTimeMax: 900,
        paybackTime: 20, // 20s for debug
    } as DeterrentConfig,

    // Mock Data for "Story Mode"
    initialStats: {
        streaks: 5,
        completed: 12,
        aborted: 2,
        paybackAccumulated: 10,
        totalLockedTime: 50000,
    },
};

const MOCK_DEVICE_ID = MOCK_CONFIGURATION.network.mac.replace(/:/g, '');

// --- Mutable Settings (Simulating Flash Storage) ---
const deterrentConfig: DeterrentConfig = { ...MOCK_CONFIGURATION.initialDeterrents };
const channelConfig = { ...MOCK_CONFIGURATION.hardware.channels };

// --- Dynamic Session State ---
let streaks = MOCK_CONFIGURATION.initialStats.streaks;
let totalTimeLocked = MOCK_CONFIGURATION.initialStats.totalLockedTime;
let completed = MOCK_CONFIGURATION.initialStats.completed;
let aborted = MOCK_CONFIGURATION.initialStats.aborted;
let paybackAccumulated = MOCK_CONFIGURATION.initialStats.paybackAccumulated;

// State Machine
let currentState: DeviceState = 'READY';

// Current Active Config
let currentSessionConfig: SessionConfig | undefined;

// Timers
let lockRemaining = 0;
let penaltyRemaining = 0;
let testRemaining = 0;
let triggerTimeout = 0;

// Dynamic channel delays
let currentDelays: [number, number, number, number] = [0, 0, 0, 0];

// Internal tracking variables
let lockDurationTotal = 0; // Total duration of current/last session
let penaltyDurationConfig = 0; // Loaded from system config on arm
const rewardHistory: Reward[] = [];

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
    log(` -> Device: ${MOCK_CONFIGURATION.identity.name} ${MOCK_CONFIGURATION.identity.version}`);
    log(` -> Build Type: ${MOCK_CONFIGURATION.identity.buildType.toUpperCase()}`);
    log(` -> Limits: MinLock=${MOCK_CONFIGURATION.presets.minSessionDuration}s, TestMode=${MOCK_CONFIGURATION.defaults.testModeDuration}s`);

    stopAllTimers();

    if (rewardHistory.length === 0 && deterrentConfig.enableRewardCode) {
        // Fresh start: Generate fake history
        const numberOfHistoricalCodes = 4;
        for (let i = 0; i < numberOfHistoricalCodes; i++) {
            rewardHistory.push(generateUniqueReward());
        }
        rewardHistory.reverse();
        log(`   -> Generated ${numberOfHistoricalCodes} historical reward codes.`);

        // Generate the "Current" code (Index 0)
        const newReward = generateUniqueReward();
        rewardHistory.unshift(newReward);
        log(`Generated new reward code for this session: ${newReward.code} (${newReward.checksum})`);
    } else if (deterrentConfig.enableRewardCode) {
        // Reboot scenario: Shift history and generate new current code
        log('   -> Shifting reward history for new session code.');
        // Remove oldest if we exceed history size (mock size 5)
        if (rewardHistory.length >= 5) {
            rewardHistory.pop();
        }
        const newReward = generateUniqueReward();
        rewardHistory.unshift(newReward);
        log(`Generated new reward code: ${newReward.code} (${newReward.checksum})`);
    }

    // Reset stats to config starting values if first run, otherwise keep accumulating in memory
    // (In mock, memory persistence = session persistence)
    if (streaks === undefined) streaks = MOCK_CONFIGURATION.initialStats.streaks;
    if (totalTimeLocked === undefined) totalTimeLocked = MOCK_CONFIGURATION.initialStats.totalLockedTime;
    if (completed === undefined) completed = MOCK_CONFIGURATION.initialStats.completed;
    if (aborted === undefined) aborted = MOCK_CONFIGURATION.initialStats.aborted;
    if (paybackAccumulated === undefined) paybackAccumulated = MOCK_CONFIGURATION.initialStats.paybackAccumulated;

    currentState = 'READY';
    currentSessionConfig = undefined;

    lockRemaining = 0;
    penaltyRemaining = 0;
    testRemaining = 0;
    triggerTimeout = 0;
    lastKeepAliveTime = 0;

    currentDelays = [0, 0, 0, 0];
    lockDurationTotal = 0;
    penaltyDurationConfig = 0;
};

/**
 * Triggers the full abort logic, moving from 'LOCKED' to 'ABORTED'.
 * Or safely resets if in 'ARMED'.
 * @param source The reason for the abort (e.g., 'API', 'Watchdog')
 * @returns true if the abort was successful
 */
const triggerAbort = (source: string): boolean => {
    // Safe Abort (Safety is ON)
    if (currentState === 'ARMED') {
        log(`🔓 Arming sequence canceled by ${source}. Returning to READY (No penalty).`);
        stopAllTimers();
        currentState = 'READY';
        return true;
    }

    // Safe Abort (Safety is ON)
    if (currentState === 'TESTING') {
        log(`🔬 Hardware Testing canceled by ${source}. Returning to READY.`);
        stopAllTimers();
        currentState = 'READY';
        return true;
    }

    if (currentState !== 'LOCKED') {
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
    if (deterrentConfig.enablePaybackTime) {
        const paybackToAdd = deterrentConfig.paybackTime;
        paybackAccumulated += paybackToAdd;
        log(`   -> Added ${paybackToAdd}s to payback bank. Total: ${paybackAccumulated}s`);
    }
    if (deterrentConfig.enableStreaks) {
        log(`   -> Streak reset to 0.`);
        streaks = 0; // Aborting resets streaks
    }

    // If Reward Code is Disabled, skip penalty phase.
    if (!deterrentConfig.enableRewardCode) {
        log(`   -> Reward Code disabled. Skipping penalty timer and moving to COMPLETED.`);
        completeSession();
        return true;
    }

    // Reward Code Enabled: Enforce Penalty
    log(`   -> Penalty timer started.`);
    currentState = 'ABORTED';
    lockRemaining = 0;
    penaltyRemaining = penaltyDurationConfig;

    // Start penalty timer
    penaltyInterval = setInterval(() => {
        if (penaltyRemaining > 0) penaltyRemaining--;
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

    currentState = 'LOCKED';
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
        if (currentSessionConfig?.triggerStrategy === 'STRAT_AUTO_COUNTDOWN') {
            // --- AUTO MODE ---
            // Tick down channels immediately
            let allZero = true;

            // Iterate delays array [ch1, ch2, ch3, ch4]
            for (let i = 0; i < 4; i++) {
                if (currentDelays[i] > 0) {
                    allZero = false;
                    currentDelays[i]--;
                    if (currentDelays[i] === 0) {
                        log(`Channel ${i + 1} closed (delay finished).`);
                    }
                }
            }

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
    currentState = 'READY';
    testRemaining = 0;
    lastKeepAliveTime = 0; // Disarm watchdog
};

/**
 * Starts the 1-second test mode interval.
 */
const startTestInterval = () => {
    // Use the limit from Config
    const duration = MOCK_CONFIGURATION.defaults.testModeDuration;
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
    currentState = 'COMPLETED';
    lastKeepAliveTime = 0; // Disarm watchdog
    lockRemaining = 0;
    penaltyRemaining = 0;
    testRemaining = 0;
    triggerTimeout = 0;
    currentDelays = [0, 0, 0, 0];

    completed++; // Increment stat

    if (deterrentConfig.enableStreaks) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = (bonjour() as any).publish({
        name: MOCK_DEVICE_ID,
        type: 'lobster-lock',
        port: PORT,
        protocol: 'tcp',
        txt: {
            mac: MOCK_CONFIGURATION.network.mac,
            deviceName: MOCK_CONFIGURATION.identity.name,
        },
    });

    service.on('up', () => {
        log(`mDNS service announced: ${MOCK_DEVICE_ID}._lobster-lock._tcp.local on port ${PORT}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service.on('error', (err: any) => {
        log(`mDNS error: ${err.message}`);
    });
};

// --- ⌨️ Keybinding Setup (for debugging) ---
const TIME_ADJUSTMENT_SECONDS = 60;
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (_, key) => {
    // Safety check: ensure key is defined
    if (!key) return;

    // CTRL+C to exit (Standard convention)
    if (key.ctrl && key.name === 'c') {
        process.exit();
    }

    // IGNORE other Control/Meta combinations to prevent accidental EOF (Ctrl+D) or shell signals
    if (key.ctrl || key.meta) return;

    // 'L' for Long-Press (Simulate Button)
    if (key.name === 'l') {
        log('⌨️  KEYPRESS: Simulated Long-Press (Button).');
        handlePhysicalButtonLongPress();
    }

    // 'D' for Double-Click (Simulate Button)
    if (key.name === 'd') {
        // Debounce / State Check: Only allow if we are strictly in ARMED state
        if (currentState === 'ARMED') {
            log('⌨️  KEYPRESS: Simulated Double-Click (Button).');
            handlePhysicalButtonDoubleClick();
        } else {
            // Optional: Log ignore to verify it's not "restarting"
            // log(`⌨️  Ignored 'd' press in state: ${currentState}`);
        }
    }

    // Up/Down arrows to adjust timers
    if (key.name === 'up' || key.name === 'down') {
        const adjustment = key.name === 'up' ? TIME_ADJUSTMENT_SECONDS : -TIME_ADJUSTMENT_SECONDS;
        const action = key.name === 'up' ? 'Increased' : 'Decreased';

        if (currentState === 'LOCKED') {
            lockRemaining = Math.max(0, lockRemaining + adjustment);
            log(`🔼🔽 ${action} lock time. New remaining: ${formatTime(lockRemaining)}`);
        } else if (currentState === 'ABORTED') {
            penaltyRemaining = Math.max(0, penaltyRemaining + adjustment);
            log(`🔼🔽 ${action} penalty time. New remaining: ${formatTime(penaltyRemaining)}`);
        }
    }
});

/**
 * Long-press = abort
 */
const handlePhysicalButtonLongPress = () => {
    if (currentState === 'LOCKED') {
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
    if (currentState === 'ARMED') {
        // In ARMED state, double-click triggers lock if strategy is buttonTrigger
        if (currentSessionConfig?.triggerStrategy === 'STRAT_BUTTON_TRIGGER') {
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
- POST /factory-reset
- POST /reboot`);
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
    if (currentState === 'LOCKED') {
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
    if (currentState !== 'READY') {
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
        id: MOCK_DEVICE_ID,
        identity: MOCK_CONFIGURATION.identity,
        network: MOCK_CONFIGURATION.network,
        features: MOCK_CONFIGURATION.hardware.features,
        channels: { ...channelConfig },
        presets: MOCK_CONFIGURATION.presets,
        deterrentConfig: deterrentConfig,
        defaults: MOCK_CONFIGURATION.defaults,
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
    if (currentState === 'LOCKED' || currentState === 'ARMED') {
        log(`API: /reward DENIED (Session ${currentState})`);
        return res.status(403).json({
            status: 'forbidden',
            message: 'Reward is locked away.',
        });
    }

    // 2. ABORTED: Hidden ONLY if penalty is still ticking
    if (currentState === 'ABORTED' && penaltyRemaining > 0) {
        log(`API: /reward DENIED (Penalty Active: ${penaltyRemaining}s)`);
        return res.status(403).json({
            status: 'forbidden',
            message: `Reward locked for penalty duration (${penaltyRemaining}s).`,
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
    if (currentState !== 'READY') {
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
    const defaultMin = MOCK_CONFIGURATION.presets.minSessionDuration;

    if (config.durationType === 'DUR_FIXED') {
        // Use the explicit 'duration' field for fixed
        resolvedDuration = config.durationFixed || defaultMin;
        log(`   -> Fixed Duration Resolved: ${resolvedDuration}s`);
    } else {
        // Range Logic: Calculate boundaries
        switch (config.durationType) {
            case 'DUR_RANGE_SHORT':
                min = 20;
                max = 45;
                break;
            case 'DUR_RANGE_MEDIUM':
                min = 60;
                max = 90;
                break;
            case 'DUR_RANGE_LONG':
                min = 120;
                max = 180;
                break;
            case 'DUR_RANDOM':
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
        log(`   -> ${config.durationType} Duration Resolved: ${resolvedDuration}s (Range: ${min}-${effectiveMax}s)`);
    }

    // Store config for this session
    currentSessionConfig = config;

    // Apply Payback logic
    lockDurationTotal = resolvedDuration + paybackAccumulated;
    if (paybackAccumulated > 0) {
        log(`   -> Added ${paybackAccumulated}s payback time. Total: ${lockDurationTotal}s`);
    }

    penaltyDurationConfig = deterrentConfig.rewardPenalty; // From static config

    // Parse channel delays from array [ch1, ch2, ch3, ch4]
    if (config.channelDelays && config.channelDelays.length === 4) {
        currentDelays = [...config.channelDelays];
    } else {
        currentDelays = [0, 0, 0, 0];
    }

    log(`🔒 /arm request. Strategy: ${currentSessionConfig?.triggerStrategy}. Total Lock Duration: ${lockDurationTotal}s.`);

    // Transition to ARMED
    currentState = 'ARMED';

    stopAllTimers();

    if (currentSessionConfig?.triggerStrategy === 'STRAT_BUTTON_TRIGGER') {
        // Manual Mode: Set timeout and wait
        triggerTimeout = MOCK_CONFIGURATION.defaults.armedTimeout;
        log('   -> Waiting for Button Trigger...');
    } else {
        // Auto Mode: Logs
        log('   -> Auto Sequence Started...');
    }

    // Start the Arming Loop (Handles both countdowns and button timeout)
    startArmedInterval();

    res.json({
        status: 'ARMED',
    });
});

/**
 * POST /start-test
 * Start a test session.
 */
app.post('/start-test', (_, res) => {
    if (currentState !== 'READY') {
        log('API: /start-test FAILED (not ready)');
        return res.status(409).json({
            status: 'error',
            message: 'Device must be in READY state to run test.',
        });
    }

    log(`🔬 /start-test request. Engaging relays for ${MOCK_CONFIGURATION.defaults.testModeDuration}s.`);
    currentState = 'TESTING';
    startTestInterval(); // Watchdog is NOT armed

    res.json({
        status: 'TESTING',
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
        res.json({ status: currentState === 'READY' ? 'READY' : 'ABORTED' });
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
 * POST /reboot
 * Simulates a remote reboot.
 * In production, this only works if currentState === 'completed' or 'ready'.
 */
app.post('/reboot', (_, res) => {
    // Match Firmware: Only allow reboot if ready or completed
    if (currentState !== 'READY' && currentState !== 'COMPLETED') {
        log('API: /reboot FAILED (Device active)');
        return res.status(403).json({
            status: 'error',
            message: 'Reboot denied. Device is active/locked. Use physical disconnect to abort.',
        });
    }

    log('API: /reboot received. Simulating safe restart.');

    res.json({ status: 'rebooting', message: 'Rebooting to clear memory session...' });

    // Simulate reboot delay
    setTimeout(initializeState, 2000);
});

/**
 * POST /factory-reset (Replaces /forget)
 * Simulates the device forgetting credentials and rebooting.
 */
app.post('/factory-reset', (_, res) => {
    if (currentState !== 'READY' && currentState !== 'COMPLETED') {
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
        state: currentState,
        verified: true,

        config: currentSessionConfig || {
            durationType: 'DUR_FIXED',
            durationFixed: 0,
            durationMin: 0,
            durationMax: 0,
            triggerStrategy: 'STRAT_AUTO_COUNTDOWN',
            channelDelays: [0, 0, 0, 0],
            hideTimer: false,
            disableLED: false,
        },

        timers: {
            lockDuration: lockDurationTotal,
            debtServed: 0,
            penaltyDuration: penaltyDurationConfig,
            lockRemaining: lockRemaining,
            penaltyRemaining: penaltyRemaining,
            testRemaining: testRemaining,
            triggerTimeout:
                currentState === 'ARMED' && currentSessionConfig?.triggerStrategy === 'STRAT_BUTTON_TRIGGER' ? triggerTimeout : 0,
            channelDelays: currentDelays,
        },

        stats: {
            streaks,
            aborted,
            completed,
            totalLockedTime: totalTimeLocked,
            paybackAccumulated: paybackAccumulated,
        },

        telemetry: {
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
