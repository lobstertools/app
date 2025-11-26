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

import { DeviceFeature, Reward, SessionStatus, TriggerStrategy } from '../types/';

const app = express();
const PORT = 3003;
app.use(cors());
app.use(express.json());

// --- Mock Static Device Config (from provisioning) ---
const DEVICE_ID = 'Mock-LobsterLock';
const DEVICE_VERSION = 'v1.4-mock';
const NUMBER_OF_CHANNELS = 4;

const FEATURES: DeviceFeature[] = ['footPedal', 'startCountdown', 'statusLed'];

const TEST_DURATION_SECONDS = 60; // 60 second test
const ARMED_TIMEOUT_SECONDS = 600; // 10 minutes to press button

// These settings mimic what would be saved in flash from provisioning
const ENABLE_STREAKS = true;
const ENABLE_PAYBACK_TIME = true;
const PAYBACK_DURATION_SECONDS = 600; // 10 Minutes

let streaks = 0;
let totalTimeLockedSeconds = 0;
let completed = 0;
let aborted = 0;
let pendingPaybackSeconds = 0;

// State Machine
// 'armed' replaces the old 'countdown' state logic
let currentState: 'ready' | 'armed' | 'locked' | 'aborted' | 'completed' | 'testing' = 'ready';
let currentStrategy: TriggerStrategy = 'autoCountdown';

// Timers
let lockSecondsRemaining = 0;
let penaltySecondsRemaining = 0;
let testSecondsRemaining = 0;
let triggerTimeoutRemaining = 0;

let currentDelays = { ch1: 0, ch2: 0, ch3: 0, ch4: 0 };
let hideTimer = false;

let lockSecondsConfig = 0;
let penaltySecondsConfig = 0;
let rewardHistory: Reward[] = [];

// --- Keep-Alive Watchdog (LOCKED state only) ---
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
 */
const initializeState = () => {
    log('Initializing state (simulating device boot).');
    log(`   -> Device: ${DEVICE_ID} ${DEVICE_VERSION}`);
    log(`   -> Channels: ${NUMBER_OF_CHANNELS}`);
    log(`   -> Features: ${FEATURES.join(', ')}`);
    log(`   -> Config: Payback ${PAYBACK_DURATION_SECONDS}s, Streaks ${ENABLE_STREAKS}`);

    stopAllTimers();

    rewardHistory = [];
    // Generate some fake historical codes
    const numberOfHistoricalCodes = 4;
    for (let i = 0; i < numberOfHistoricalCodes; i++) {
        rewardHistory.push(generateUniqueReward());
    }

    // No real need to reverse since they are random, but mimicking structure
    rewardHistory.reverse();
    log(`   -> Generated ${numberOfHistoricalCodes} historical reward codes.`);

    // Generate the one "current" code
    const newReward = generateUniqueReward();
    rewardHistory.unshift(newReward);
    log(`Generated new reward code for this session: ${newReward.code.substring(0, 8)}... (${newReward.checksum})`);

    streaks = 5;
    totalTimeLockedSeconds = 50000;
    completed = 12;
    aborted = 2;
    pendingPaybackSeconds = 600;

    currentState = 'ready';
    currentStrategy = 'autoCountdown';

    lockSecondsRemaining = 0;
    penaltySecondsRemaining = 0;
    testSecondsRemaining = 0;
    triggerTimeoutRemaining = 0;
    lastKeepAliveTime = 0; // Disarm watchdog

    currentDelays = { ch1: 0, ch2: 0, ch3: 0, ch4: 0 };
    hideTimer = false;
    lockSecondsConfig = 0;
    penaltySecondsConfig = 0;
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
    log(`🔓 Session aborted by ${source}! Penalty timer started.`);
    if (lockInterval) clearInterval(lockInterval);
    lockInterval = null;

    currentState = 'aborted';
    lastKeepAliveTime = 0; // <-- DISARM WATCHDOG

    // Add to debt bank if enabled
    if (ENABLE_PAYBACK_TIME) {
        const paybackToAdd = PAYBACK_DURATION_SECONDS;
        pendingPaybackSeconds += paybackToAdd;
        log(`   -> Added ${paybackToAdd}s to payback bank. Total: ${pendingPaybackSeconds}s`);
    }
    if (ENABLE_STREAKS) {
        log(`   -> Streak reset to 0.`);
        streaks = 0; // Aborting resets streaks
    }

    lockSecondsRemaining = 0;
    penaltySecondsRemaining = penaltySecondsConfig;
    aborted++; // Increment stat

    // Start penalty timer
    penaltyInterval = setInterval(() => {
        if (penaltySecondsRemaining > 0) penaltySecondsRemaining--;
        else completeSession();
    }, 1000);

    return true;
};

/**
 * Starts the main 1-second lock interval.
 */
const startLockInterval = () => {
    log(`Starting main lock timer for ${lockSecondsConfig} seconds.`);
    stopAllTimers();

    currentState = 'locked';
    lockSecondsRemaining = lockSecondsConfig;
    lastKeepAliveTime = Date.now(); // <-- ARM WATCHDOG

    lockInterval = setInterval(() => {
        // --- Watchdog Check (LOCKED state only) ---
        if (lastKeepAliveTime > 0 && Date.now() - lastKeepAliveTime > KEEP_ALIVE_TIMEOUT_MS) {
            log('Keep-alive watchdog timeout. Aborting session.');
            triggerAbort('Watchdog');
            return; // Stop processing
        }

        if (lockSecondsRemaining > 0) {
            lockSecondsRemaining--;
            totalTimeLockedSeconds++;
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
    log(`Device ARMED. Strategy: ${currentStrategy}`);
    stopAllTimers();

    armedInterval = setInterval(() => {
        if (currentStrategy === 'autoCountdown') {
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
            if (triggerTimeoutRemaining > 0) {
                triggerTimeoutRemaining--;
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
    testSecondsRemaining = 0;
    lastKeepAliveTime = 0; // Disarm watchdog
};

/**
 * Starts the 1-second test mode interval.
 */
const startTestInterval = () => {
    log(`Starting test mode timer for ${TEST_DURATION_SECONDS} seconds.`);
    stopAllTimers();
    testSecondsRemaining = TEST_DURATION_SECONDS;
    // NOTE: Watchdog is NOT armed here

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
    lastKeepAliveTime = 0; // Disarm watchdog
    lockSecondsRemaining = 0;
    penaltySecondsRemaining = 0;
    testSecondsRemaining = 0;
    triggerTimeoutRemaining = 0;
    currentDelays = { ch1: 0, ch2: 0, ch3: 0, ch4: 0 };

    completed++; // Increment stat

    if (ENABLE_STREAKS) {
        streaks++;
        log(`Streak count incremented to: ${streaks}`);
    }

    // Generate a new code for the *next* session
    const newReward = generateUniqueReward();
    rewardHistory.unshift(newReward);

    // Keep buffer size reasonable (simulate C++ circular buffer somewhat)
    if (rewardHistory.length > 10) {
        rewardHistory.pop();
    }

    log(`Generated new reward code for next session: ${newReward.code.substring(0, 8)}... (${newReward.checksum})`);
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

    // 'L' for Long Press (Simulate Button)
    if (key.name === 'l') {
        log('⌨️  KEYPRESS: Simulated Long Press (Button).');
        handlePhysicalButtonLongPress();
    }

    // Up/Down arrows to adjust timers
    if (key.name === 'up' || key.name === 'down') {
        const adjustment = key.name === 'up' ? TIME_ADJUSTMENT_SECONDS : -TIME_ADJUSTMENT_SECONDS;
        const action = key.name === 'up' ? 'Increased' : 'Decreased';

        if (currentState === 'locked') {
            lockSecondsRemaining = Math.max(0, lockSecondsRemaining + adjustment);
            log(`🔼🔽 ${action} lock time. New remaining: ${formatTime(lockSecondsRemaining)}`);
        } else if (currentState === 'aborted') {
            penaltySecondsRemaining = Math.max(0, penaltySecondsRemaining + adjustment);
            log(`🔼🔽 ${action} penalty time. New remaining: ${formatTime(penaltySecondsRemaining)}`);
        } else if (currentState === 'armed') {
            log(`🔼🔽 Timer adjustment disabled during arming.`);
        } else if (currentState === 'testing') {
            log(`🔼🔽 Timer adjustment disabled during test mode.`);
        }
    }
});

/**
 * Simulates the logic within the C++ handleLongPress function.
 */
const handlePhysicalButtonLongPress = () => {
    if (currentState === 'armed') {
        // In ARMED state, long press triggers lock if strategy is buttonTrigger
        if (currentStrategy === 'buttonTrigger') {
            log('Button Trigger Received! Locking session.');
            startLockInterval();
        } else {
            log('Button Press ignored (Auto mode active).');
        }
    } else if (currentState === 'locked') {
        // In LOCKED state, long press triggers abort
        log('Button Abort Triggered (Emergency Stop).');
        triggerAbort('Physical Button');
    } else {
        log(`Button Press ignored in state: ${currentState}`);
    }
};

// -----------------------------

// =================================================================
// --- API Endpoints ---
// =================================================================

/**
 * GET / (Root)
 * Simple info endpoint.
 */
app.get('/', (req, res) => {
    res.type('text/plain').send(`Mock Lobster-Lock API ${DEVICE_VERSION} (Reboot to Reset)
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
app.get('/log', (req, res) => {
    res.type('text/plain').send(logBuffer.join('\n'));
});

/**
 * POST /keepalive
 * "Pets" the watchdog to prevent a timeout.
 */
app.post('/keepalive', (req, res) => {
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
app.get('/details', (req, res) => {
    log('API: /details requested.');
    res.json({
        id: DEVICE_ID,
        name: DEVICE_ID,
        address: '127.0.0.1',
        version: DEVICE_VERSION,
        features: FEATURES,
        numberOfChannels: NUMBER_OF_CHANNELS,
        buildType: 'mock',
        // Mock all channels enabled
        channels: {
            ch1: true,
            ch2: true,
            ch3: true,
            ch4: true,
        },
        // New deterrents structure
        deterrents: {
            enableStreaks: ENABLE_STREAKS,
            enablePaybackTime: ENABLE_PAYBACK_TIME,
            paybackDurationSeconds: PAYBACK_DURATION_SECONDS,
        },
    } as any);
});

/**
 * GET /reward
 * Retrieve code history. Only allowed if not in an active session.
 */
app.get('/reward', (req, res) => {
    if (currentState === 'locked' || currentState === 'aborted' || currentState === 'armed') {
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

    // Read from JSON payload (req.body)
    const {
        triggerStrategy, // 'autoCountdown' | 'buttonTrigger'
        lockDurationSeconds,
        penaltyDurationSeconds,
        hideTimer: shouldHideTimer,
        channelDelaysSeconds, // nested object { ch1: x, ... }
    } = req.body;

    const durationSec = Number(lockDurationSeconds);
    const penaltySec = Number(penaltyDurationSeconds);

    if (isNaN(durationSec) || durationSec < 1) {
        log(`API: /arm FAILED (invalid duration: ${durationSec})`);
        return res.status(400).json({
            status: 'error',
            message: 'Invalid duration.',
        });
    }

    if (isNaN(penaltySec) || penaltySec < 1) {
        log(`API: /arm FAILED (invalid penalty duration: ${penaltySec})`);
        return res.status(400).json({
            status: 'error',
            message: 'Invalid penalty duration.',
        });
    }

    if (!channelDelaysSeconds || typeof channelDelaysSeconds !== 'object') {
        log(`API: /arm FAILED (invalid delays object)`);
        return res.status(400).json({
            status: 'error',
            message: `Invalid 'channelDelaysSeconds' object.`,
        });
    }

    // Clear any old intervals
    stopAllTimers();

    // Store config for this session
    lockSecondsConfig = durationSec + pendingPaybackSeconds;
    penaltySecondsConfig = penaltySec;
    hideTimer = shouldHideTimer || false;

    // Determine Strategy
    currentStrategy = triggerStrategy === 'buttonTrigger' ? 'buttonTrigger' : 'autoCountdown';

    // Parse channel delays from object
    currentDelays.ch1 = Number(channelDelaysSeconds.ch1 || 0);
    currentDelays.ch2 = Number(channelDelaysSeconds.ch2 || 0);
    currentDelays.ch3 = Number(channelDelaysSeconds.ch3 || 0);
    currentDelays.ch4 = Number(channelDelaysSeconds.ch4 || 0);

    log(`🔒 /arm request. Strategy: ${currentStrategy}. Duration: ${durationSec}s.`);

    // Transition to ARMED
    currentState = 'armed';

    if (currentStrategy === 'buttonTrigger') {
        // Manual Mode: Set timeout and wait
        triggerTimeoutRemaining = ARMED_TIMEOUT_SECONDS;
        log('   -> Waiting for Button Trigger...');
    } else {
        // Auto Mode: Logs
        log('   -> Auto Sequence Started...');
    }

    // Start the Arming Loop (Handles both countdowns and button timeout)
    startArmedInterval();

    res.json({
        status: 'armed',
        triggerStrategy: currentStrategy,
    });
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

    log(`🔬 /start-test request. Engaging relays for ${TEST_DURATION_SECONDS}s.`);
    currentState = 'testing';
    startTestInterval(); // Watchdog is NOT armed

    res.json({
        status: 'testing',
        testSecondsRemaining: testSecondsRemaining,
    });
});

/**
 * POST /abort
 * Aborts an active session.
 */
app.post('/abort', (req, res) => {
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
app.post('/debug/button-press', (req, res) => {
    log('API: /debug/button-press received.');
    handlePhysicalButtonLongPress();
    res.json({ message: 'Button press simulated' });
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
 * Returns camelCase SessionStatusResponse
 */
app.get('/status', (req, res) => {
    res.json({
        status: currentState,
        // Send strategy context only if ARMED
        triggerStrategy: currentState === 'armed' ? currentStrategy : undefined,
        triggerTimeoutRemainingSeconds:
            currentState === 'armed' && currentStrategy === 'buttonTrigger' ? triggerTimeoutRemaining : undefined,

        lockSecondsRemaining,
        penaltySecondsRemaining,
        testSecondsRemaining,
        hideTimer: hideTimer,

        // Nested Delays Object
        channelDelaysRemainingSeconds: {
            ch1: currentDelays.ch1,
            ch2: currentDelays.ch2,
            ch3: currentDelays.ch3,
            ch4: currentDelays.ch4,
        },

        // Nested Stats Object
        stats: {
            streaks,
            aborted,
            completed,
            totalTimeLockedSeconds: totalTimeLockedSeconds,
            pendingPaybackSeconds,
        },
    } as SessionStatus);
});

// --- Server Start ---
// Bind to '0.0.0.0' to allow external access, not just 'localhost'.
app.listen(PORT, '0.0.0.0', () => {
    log(`Mock ESP server running at http://localhost:${PORT}`);
    initializeState();
    startMDNS();
    log(`⌨️  KEYBINDINGS ENABLED: Use UP/DOWN arrow keys in this terminal to adjust the timer.`);
    log(`   Use 'L' key to simulate LONG PRESS (Start/Abort).`);
    log(`   Use CTRL+C to exit.`);
});
