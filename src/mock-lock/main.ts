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
 * (e.g., `/status`, `/start`), allowing for frontend
 * development without hardware.
 * =================================================================
 */

import express from 'express';
import cors from 'cors';
import readline from 'readline';
import bonjour from 'bonjour';

import { SessionStatusResponse } from '../types/';

const app = express();
const PORT = 3003;
app.use(cors());
app.use(express.json());

// --- Mock Static Device Config (from provisioning) ---
const DEVICE_ID = 'Mock-LobsterLock';
const DEVICE_VERSION = 'v1.4-mock';
const NUMBER_OF_CHANNELS = 4;
const FEATURES = ['LED_Indicator', 'Abort_Padel'];
const TEST_DURATION_SECONDS = 60; // 60 second test

// These settings mimic what would be saved in flash from provisioning
const ABORT_DELAY_SECONDS = 3;
const COUNT_STREAKS = true;
const ENABLE_TIME_PAYBACK = true;
const ABORT_PAYBACK_MINUTES = 10;

interface Reward {
    code: string;
    timestamp: string;
}

let streaks = 0;
let totalLockedSessionSeconds = 0;
let completedSessions = 0;
let abortedSessions = 0;
let pendingPaybackSeconds = 0;

let currentState = 'ready';
let lockSecondsRemaining = 0;
let penaltySecondsRemaining = 0;
let testSecondsRemaining = 0;
let countdownSecondsRemaining: number[] = new Array(NUMBER_OF_CHANNELS).fill(0);
let hideTimer = false;

let lockSecondsConfig = 0;
let penaltySecondsConfig = 0;
let rewardHistory: Reward[] = [];

let lockInterval: NodeJS.Timeout | null = null;
let penaltyInterval: NodeJS.Timeout | null = null;
let countdownInterval: NodeJS.Timeout | null = null;
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
 * Generates a 32-character reward code.
 */
const generateSessionCode = (): string => {
    const chars = ['U', 'D', 'L', 'R'];
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
};

/**
 * Clears all active session timers.
 */
const stopAllTimers = () => {
    if (lockInterval) clearInterval(lockInterval);
    if (penaltyInterval) clearInterval(penaltyInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (testInterval) clearInterval(testInterval);
    lockInterval = null;
    penaltyInterval = null;
    countdownInterval = null;
    testInterval = null;
};

/**
 * Resets the mock device to its default "boot" state.
 */
const initializeState = () => {
    log('Initializing state (simulating device boot).');
    log(`   -> Device: ${DEVICE_ID} ${DEVICE_VERSION}`);
    log(`   -> Channels: ${NUMBER_OF_CHANNELS}`);
    log(`   -> Features: ${FEATURES.join(', ')}`);
    log(
        `   -> Config: Payback ${ABORT_PAYBACK_MINUTES} min, Streaks ${COUNT_STREAKS}`
    );

    stopAllTimers();

    rewardHistory = [];
    // Generate some fake historical codes
    const numberOfHistoricalCodes = 4;
    for (let i = 1; i <= numberOfHistoricalCodes; i++) {
        const pastDate = new Date();
        pastDate.setDate(
            pastDate.getDate() - (i * 7 + Math.floor(Math.random() * 3))
        );
        const historicalReward: Reward = {
            code: generateSessionCode(),
            timestamp: pastDate.toISOString(),
        };
        rewardHistory.push(historicalReward);
    }

    rewardHistory.reverse();
    log(`   -> Generated ${numberOfHistoricalCodes} historical reward codes.`);

    // Generate the one "current" code
    const newCode: Reward = {
        code: generateSessionCode(),
        timestamp: new Date().toISOString(),
    };
    rewardHistory.unshift(newCode);
    log(
        `Generated new reward code for this session: ${newCode.code.substring(0, 8)}...`
    );

    streaks = 5;
    totalLockedSessionSeconds = 50000;
    completedSessions = 12;
    abortedSessions = 2;
    pendingPaybackSeconds = 600;

    currentState = 'ready';
    lockSecondsRemaining = 0;
    penaltySecondsRemaining = 0;
    testSecondsRemaining = 0;

    countdownSecondsRemaining = new Array(NUMBER_OF_CHANNELS).fill(0);
    hideTimer = false;
    lockSecondsConfig = 0;
    penaltySecondsConfig = 0;
};

/**
 * Starts the main 1-second lock interval.
 */
const startLockInterval = () => {
    log(`Starting main lock timer for ${lockSecondsConfig} seconds.`);
    stopAllTimers();

    lockSecondsRemaining = lockSecondsConfig;

    lockInterval = setInterval(() => {
        if (lockSecondsRemaining > 0) {
            lockSecondsRemaining--;
            totalLockedSessionSeconds++;
        } else {
            completeSession();
        }
    }, 1000);
};

/**
 * Starts the 1-second countdown interval for channel delays.
 */
const startCountdownInterval = () => {
    log(`Starting countdown timer...`);
    stopAllTimers();

    countdownInterval = setInterval(() => {
        let allZero = true;
        for (let i = 0; i < NUMBER_OF_CHANNELS; i++) {
            if (countdownSecondsRemaining[i] > 0) {
                allZero = false;
                countdownSecondsRemaining[i]--;
                if (countdownSecondsRemaining[i] === 0) {
                    log(`Channel ${i + 1} closed (delay finished).`);
                }
            }
        }

        // When all delays hit 0, transition to LOCKED
        if (allZero) {
            log('Countdown complete. Starting main lock.');
            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = null;
            currentState = 'locked';
            startLockInterval();
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
    testSecondsRemaining = 0;
};

/**
 * Starts the 1-second test mode interval.
 */
const startTestInterval = () => {
    log(`Starting test mode timer for ${TEST_DURATION_SECONDS} seconds.`);
    stopAllTimers();
    testSecondsRemaining = TEST_DURATION_SECONDS;

    testInterval = setInterval(() => {
        if (testSecondsRemaining > 0) {
            testSecondsRemaining--;
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
    log('Session COMPLETED. Awaiting mock server restart to reset.');
    stopAllTimers();
    currentState = 'completed';
    lockSecondsRemaining = 0;
    penaltySecondsRemaining = 0;
    testSecondsRemaining = 0;
    countdownSecondsRemaining.fill(0);

    if (COUNT_STREAKS) {
        streaks++;
        log(`Streak count incremented to: ${streaks}`);
    }
    // Generate a new code for the *next* session
    const newCode: Reward = {
        code: generateSessionCode(),
        timestamp: new Date().toISOString(),
    };
    rewardHistory.unshift(newCode);
    log(`Generated new reward code for next session.`);
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
        name: DEVICE_ID,
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

process.stdin.on('keypress', (str, key) => {
    // CTRL+C to exit
    if (key.ctrl && key.name === 'c') process.exit();

    // Up/Down arrows to adjust timers
    if (key.name === 'up' || key.name === 'down') {
        const adjustment =
            key.name === 'up'
                ? TIME_ADJUSTMENT_SECONDS
                : -TIME_ADJUSTMENT_SECONDS;
        const action = key.name === 'up' ? 'Increased' : 'Decreased';

        if (currentState === 'locked') {
            lockSecondsRemaining = Math.max(
                0,
                lockSecondsRemaining + adjustment
            );
            log(
                `🔼🔽 ${action} lock time. New remaining: ${formatTime(lockSecondsRemaining)}`
            );
        } else if (currentState === 'aborted') {
            penaltySecondsRemaining = Math.max(
                0,
                penaltySecondsRemaining + adjustment
            );
            log(
                `🔼🔽 ${action} penalty time. New remaining: ${formatTime(penaltySecondsRemaining)}`
            );
        } else if (currentState === 'countdown') {
            log(`🔼🔽 Timer adjustment disabled during countdown.`);
        } else if (currentState === 'testing') {
            log(`🔼🔽 Timer adjustment disabled during test mode.`);
        }
    }
});
// -----------------------------

// =================================================================
// --- API Endpoints ---
// =================================================================

/**
 * GET / (Root)
 * Simple info endpoint.
 */
app.get('/', (req, res) => {
    res.type('text/plain')
        .send(`Mock Lobster-Lock API ${DEVICE_VERSION} (Reboot to Reset)
Endpoints:
- GET /status
- GET /details
- POST /start
- POST /abort
- POST /start-test
- GET /reward
- GET /log
- POST /factory-reset`);
});

/**
 * GET /log
 * Dumps the in-memory log buffer.
 */
app.get('/log', (req, res) => {
    res.type('text/plain').send(logBuffer.join('\n'));
});

/**
 * GET /details
 * Returns the static device configuration (ActiveDevice)
 */
app.get('/details', (req, res) => {
    log('API: /details requested.');
    // This matches the ActiveDevice type
    res.json({
        id: DEVICE_ID,
        name: DEVICE_ID,
        address: '127.0.0.1', // Address is illustrative here
        version: DEVICE_VERSION,
        features: FEATURES,
        numberOfChannels: NUMBER_OF_CHANNELS,
        abortDelaySeconds: ABORT_DELAY_SECONDS,
        countStreaks: COUNT_STREAKS,
        enableTimePayback: ENABLE_TIME_PAYBACK,
        abortPaybackMinutes: ABORT_PAYBACK_MINUTES,
    });
});

/**
 * GET /reward
 * Retrieve code history. Only allowed if not in an active session.
 */
app.get('/reward', (req, res) => {
    if (
        currentState === 'locked' ||
        currentState === 'aborted' ||
        currentState === 'countdown'
    ) {
        log('API: /reward FAILED (session active)');
        return res.status(403).json({
            status: 'forbidden',
            message: 'Reward is not yet available.',
        });
    }
    log(`API: /reward requested. Sending ${rewardHistory.length} codes.`);
    res.json(rewardHistory);
});

/**
 * POST /start
 * Start a new lock session.
 */
app.post('/start', (req, res) => {
    if (currentState !== 'ready') {
        log('API: /start FAILED (not ready)');
        return res.status(409).json({
            status: 'error',
            message: 'Device is not ready. Cannot start a new lock.',
        });
    }

    // Read from JSON payload (req.body)
    const {
        duration, // in minutes
        penaltyDuration, // in minutes
        hideTimer: shouldHideTimer,
        delays, // in seconds
    } = req.body;

    const durationMins = Number(duration);
    const penaltyMins = Number(penaltyDuration);

    if (isNaN(durationMins) || durationMins < 1) {
        log(`API: /start FAILED (invalid duration: ${durationMins})`);
        return res.status(400).json({
            status: 'error',
            message: 'Invalid duration.',
        });
    }

    if (isNaN(penaltyMins) || penaltyMins < 1) {
        log(`API: /start FAILED (invalid penalty duration: ${penaltyMins})`);
        return res.status(400).json({
            status: 'error',
            message: 'Invalid penalty duration.',
        });
    }

    if (!Array.isArray(delays) || delays.length !== NUMBER_OF_CHANNELS) {
        log(`API: /start FAILED (invalid delays array)`);
        return res.status(400).json({
            status: 'error',
            message: `Invalid 'delays' array. Expected ${NUMBER_OF_CHANNELS} items.`,
        });
    }

    // Clear any old intervals
    stopAllTimers();

    // Store config for this session
    // Add any pending payback time to the lock duration
    lockSecondsConfig = durationMins * 60 + pendingPaybackSeconds;
    penaltySecondsConfig = penaltyMins * 60;
    hideTimer = shouldHideTimer || false; // Default to false

    // Parse channel delays
    let maxDelay = 0;
    countdownSecondsRemaining = delays.map((d) => {
        const delay = Number(d || 0);
        if (delay > maxDelay) maxDelay = delay;
        return delay;
    });

    log(
        `🔒 /start request. Base Duration: ${durationMins} min. Payback: ${pendingPaybackSeconds}s. Total: ${lockSecondsConfig}s. Hide: ${hideTimer}.`
    );
    log(
        `   -> Channel Delays: [${countdownSecondsRemaining.join(', ')}]s. Max Delay: ${maxDelay}s.`
    );

    if (maxDelay === 0) {
        // No delays, lock immediately
        log('   -> No delays. Locking immediately.');
        currentState = 'locked';
        startLockInterval();
        res.json({ status: 'locked', durationSeconds: lockSecondsRemaining });
    } else {
        // Start countdown
        log('   -> Starting countdown...');
        currentState = 'countdown';
        lockSecondsRemaining = 0; // Main timer not running yet
        startCountdownInterval();
        res.json({
            status: 'countdown',
            channelDelays: countdownSecondsRemaining,
        });
    }
});

/**
 * POST /start-test
 * Start a test session.
 */
app.post('/start-test', (req, res) => {
    if (currentState !== 'ready') {
        log('API: /start-test FAILED (not ready)');
        return res.status(409).json({
            status: 'error',
            message: 'Device must be in READY state to run test.',
        });
    }

    log(
        `🔬 /start-test request. Engaging relays for ${TEST_DURATION_SECONDS}s.`
    );
    currentState = 'testing';
    startTestInterval();

    res.json({
        status: 'testing',
        testTimeRemainingSeconds: testSecondsRemaining,
    });
});

/**
 * POST /abort
 * Aborts an active session (countdown, locked, or testing).
 */
app.post('/abort', (req, res) => {
    if (currentState === 'countdown') {
        log('🔓 Countdown aborted by user. No penalty.');
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = null;
        countdownSecondsRemaining.fill(0);
        currentState = 'ready';
        res.json({ status: 'ready', message: 'Countdown canceled.' });
    } else if (currentState === 'locked') {
        log('🔓 Session aborted by user! Penalty timer started.');
        if (lockInterval) clearInterval(lockInterval);
        lockInterval = null;

        currentState = 'aborted';

        // Add to debt bank if enabled
        if (ENABLE_TIME_PAYBACK) {
            // Use the static payback config
            const paybackToAdd = ABORT_PAYBACK_MINUTES * 60;
            pendingPaybackSeconds += paybackToAdd;
            log(
                `   -> Added ${paybackToAdd}s to payback bank. Total: ${pendingPaybackSeconds}s`
            );
        }
        if (COUNT_STREAKS) {
            log(`   -> Streak reset to 0.`);
            streaks = 0; // Aborting resets streaks
        }

        lockSecondsRemaining = 0;
        penaltySecondsRemaining = penaltySecondsConfig;

        penaltyInterval = setInterval(() => {
            if (penaltySecondsRemaining > 0) penaltySecondsRemaining--;
            else completeSession();
        }, 1000);
        res.json({
            status: 'aborted',
            penaltySeconds: penaltySecondsRemaining,
        });
    } else if (currentState === 'testing') {
        log('🔓 Test mode aborted by user.');
        stopTestMode();
        res.json({ status: 'ready', message: 'Test mode stopped.' });
    } else {
        log('API: /abort FAILED (not abortable)');
        return res.status(409).json({
            status: 'error',
            message: 'Device is not in a state that can be aborted.',
        });
    }
});

/**
 * POST /factory-reset (Replaces /forget)
 * Simulates the device forgetting credentials and rebooting.
 */
app.post('/factory-reset', (req, res) => {
    if (currentState !== 'ready' && currentState !== 'completed') {
        log('API: /factory-reset FAILED (session active)');
        return res.status(409).json({
            status: 'error',
            message:
                'Device is in an active session. Cannot reset while locked, in countdown, or in penalty.',
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
 * Returns camelCase SessionStatusResponse
 */
app.get('/status', (req, res) => {
    res.json({
        status: currentState,
        lockSecondsRemaining,
        penaltySecondsRemaining,
        testSecondsRemaining,
        hideTimer: hideTimer,
        countdownSecondsRemaining,

        // Accumulated stats
        streaks,
        abortedSessions,
        completedSessions,
        totalLockedSessionSeconds,
        pendingPaybackSeconds,
    } as SessionStatusResponse);
});

// --- Server Start ---
// Bind to '0.0.0.0' to allow external access, not just 'localhost'.
app.listen(PORT, '0.0.0.0', () => {
    log(`Mock ESP server running at http://localhost:${PORT}`);
    initializeState();
    startMDNS();
    log(
        `⌨️  KEYBINDINGS ENABLED: Use UP/DOWN arrow keys in this terminal to adjust the timer.`
    );
    log(`   Use CTRL+C to exit.`);
});
