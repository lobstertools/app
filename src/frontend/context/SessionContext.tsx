import {
    useContext,
    useMemo,
    createContext,
    ReactNode,
    useCallback,
    useEffect,
    useState,
} from 'react';
import { notification, Alert } from 'antd';

import {
    Reward,
    SessionContextState,
    SessionFormData,
    SessionStatusResponse,
    ComputedAppStatus,
} from '../../types';

import { useDeviceManager } from './DeviceManagerContext';
import { apiClient } from '../lib/apiClient';
import axios from 'axios';

export const MAX_CHANNELS_TO_RENDER = 4;

// Create the context
const SessionContext = createContext<SessionContextState | undefined>(
    undefined
);

/**
 * Custom hook to easily access the SessionContext.
 */
export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};

/**
 * Main state provider component.
 */
export const SessionProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<SessionStatusResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLocking, setIsLocking] = useState(false);
    const [rewardHistory, setRewardHistory] = useState<Reward[]>([]);

    const { activeDevice, connectionHealth } = useDeviceManager();

    const currentState = useMemo<ComputedAppStatus>(() => {
        if (!activeDevice) {
            return 'no_device_selected';
        }

        // 1. Check connection health first
        if (connectionHealth.server.status === 'error') {
            return 'server_unreachable';
        }
        if (connectionHealth.device.status === 'error') {
            return 'device_unreachable';
        }
        if (
            connectionHealth.server.status === 'pending' ||
            connectionHealth.device.status === 'pending'
        ) {
            return 'connecting';
        }

        // 2. If all links are 'ok', trust the device's own status
        return status?.status || 'connecting';
    }, [activeDevice, connectionHealth, status]);

    // --- Session Functions ---

    /**
     * Fetches the main /session/status JSON from the active device.
     */
    const fetchSessionStatus = useCallback(async () => {
        if (!activeDevice) {
            return;
        }
        try {
            const response = await apiClient.get<SessionStatusResponse>(
                `/devices/${activeDevice.id}/session/status`
            );
            setStatus(response.data);
        } catch (err: unknown) {
            console.warn('Failed to fetch session status:', err);
        }
    }, [activeDevice]);

    /**
     * Fetches the reward history from the device.
     */
    const fetchRewardHistory = useCallback(async () => {
        if (!activeDevice) return;
        try {
            const response = await apiClient.get<Reward[]>(
                `/devices/${activeDevice.id}/session/reward`
            );
            setRewardHistory(response.data);
        } catch (err: unknown) {
            console.error('Failed to fetch reward history', err);
            notification.error({ message: 'Could not fetch reward codes.' });
            setRewardHistory([]);
        }
    }, [activeDevice]);

    /**
     * Sends the final /start command to the device with session payload.
     */
    const sendLockCommand = useCallback(
        async (payload: unknown) => {
            // 'payload' is intentionally any for this function
            if (!activeDevice) return;
            if (currentState !== 'ready') {
                notification.error({
                    message: 'Error',
                    description: 'Device is not ready to start a new session.',
                });
                return fetchSessionStatus();
            }

            setIsLocking(true);
            try {
                await apiClient.post(
                    `/devices/${activeDevice.id}/session/start`,
                    payload
                );
                notification.success({
                    message: 'Session Starting',
                    description: `Device is now in countdown mode.`,
                });
                await fetchSessionStatus(); // Re-sync immediately
            } catch (err: unknown) {
                let msg = 'Failed to start the lock session.';
                if (axios.isAxiosError(err)) {
                    msg = err.response?.data?.message || err.message;
                } else if (err instanceof Error) {
                    msg = err.message;
                }

                setError(msg);
                notification.error({
                    message: 'Lock Failed',
                    description: msg,
                });
                await fetchSessionStatus();
            } finally {
                setIsLocking(false);
            }
        },
        [activeDevice, currentState, fetchSessionStatus]
    );

    /**
     * Processes the form data and calls sendLockCommand.
     */
    const startSession = (values: SessionFormData) => {
        if (!activeDevice) return;

        const {
            type,
            timeRangeSelection,
            duration,
            penaltyDuration,
            rangeMin,
            rangeMax,
            hideTimer,
            startDelays,
        } = values;

        // --- Calculate final duration ---
        let finalDurationMinutes: number;
        const getRandom = (min: number, max: number) =>
            Math.floor(Math.random() * (max - min + 1)) + min;
        switch (type) {
            case 'time-range':
                if (timeRangeSelection === 'short')
                    finalDurationMinutes = getRandom(20, 45);
                else if (timeRangeSelection === 'medium')
                    finalDurationMinutes = getRandom(60, 90);
                else /* long */ finalDurationMinutes = getRandom(120, 180);
                break;
            case 'random':
                if (!rangeMin || !rangeMax || rangeMin > rangeMax) {
                    notification.error({
                        message: 'Invalid Range',
                        description:
                            'Minimum duration cannot be greater than the maximum.',
                    });
                    return;
                }
                finalDurationMinutes = getRandom(rangeMin, rangeMax);
                break;
            case 'fixed':
                finalDurationMinutes = duration || 30;
                break;
            default:
                notification.error({
                    message: 'Invalid session type specified.',
                });
                return;
        }

        // --- Calculate final delays ---
        const numChannels = Math.min(
            activeDevice.numberOfChannels || 1,
            MAX_CHANNELS_TO_RENDER
        );
        let delaysToUse: number[] = [];

        if (startDelays.length > 1) {
            delaysToUse = startDelays.slice(0, numChannels);
        } else {
            const singleDelay = startDelays[0] || 0;
            delaysToUse = Array(numChannels).fill(singleDelay);
        }

        // --- Build payload and send ---
        const payload = {
            duration: finalDurationMinutes,
            penaltyDuration,
            hideTimer,
            delays: delaysToUse,
        };

        sendLockCommand(payload);
    };

    /**
     * Sends the /abort command to the device.
     */
    const abortSession = useCallback(async () => {
        if (!activeDevice) return;
        const stateBeforeAbort = status?.status;
        try {
            await apiClient.post(`/devices/${activeDevice.id}/session/abort`);

            if (stateBeforeAbort === 'countdown')
                notification.info({
                    message: 'Start Canceled',
                    description:
                        'The session start was successfully canceled. No penalty.',
                });
            else if (stateBeforeAbort === 'locked')
                notification.warning({
                    message: 'Session Aborted',
                    description: 'Penalty timer has started.',
                });
            else if (stateBeforeAbort === 'testing')
                notification.info({
                    message: 'Test Stopped',
                    description: 'Hardware test has been stopped.',
                });

            await fetchSessionStatus(); // Re-sync immediately
        } catch (err: unknown) {
            let msg = 'Failed to abort session.';
            if (axios.isAxiosError(err)) {
                msg = err.response?.data?.message || err.message;
            } else if (err instanceof Error) {
                msg = err.message;
            }

            setError(msg);
            notification.error({ message: 'Abort Failed', description: msg });
        }
    }, [activeDevice, fetchSessionStatus, status]);

    /**
     * Sends the /start-test command to the device.
     */
    const startTestSession = useCallback(async () => {
        if (!activeDevice) return;
        if (currentState !== 'ready') {
            notification.info({ message: 'Device is not ready.' });
            return;
        }
        try {
            await apiClient.post(`/devices/${activeDevice.id}/session/test`);
            notification.success({
                message: 'Test Mode Started',
                description: 'Relays will engage for 60 seconds.',
            });
            await fetchSessionStatus(); // Re-sync immediately
        } catch (err: unknown) {
            console.error('Failed to start test session:', err);
            notification.error({
                message: 'Test Failed',
                description: 'Could not start test mode.',
            });
        }
    }, [activeDevice, currentState, fetchSessionStatus]);

    // --- Main State Effects ---

    /**
     * This is the "brain" for polling session status.
     */
    useEffect(() => {
        if (!activeDevice) {
            return; // No device, nothing to poll
        }

        if (
            currentState === 'server_unreachable' ||
            currentState === 'no_device_selected'
        ) {
            return; // Stop polling if we know we can't reach the server
        }

        fetchSessionStatus(); // Run once immediately

        let pollInterval: number;
        switch (currentState) {
            case 'locked':
            case 'countdown':
            case 'aborted':
            case 'testing':
                pollInterval = 500;
                break;
            case 'ready':
            case 'completed':
                pollInterval = 5000;
                break;
            case 'device_unreachable':
            case 'connecting':
            default:
                pollInterval = 2500;
                break;
        }
        const sessionPollTimer = setInterval(fetchSessionStatus, pollInterval);
        return () => {
            clearInterval(sessionPollTimer);
        };
    }, [activeDevice, currentState, fetchSessionStatus, connectionHealth]);

    /**
     * Effect to fetch reward history when the device is in a valid state.
     */
    useEffect(() => {
        const canFetchHistory =
            currentState === 'ready' ||
            currentState === 'completed' ||
            currentState === 'testing';

        if (canFetchHistory) {
            fetchRewardHistory();
        } else {
            setRewardHistory([]);
        }
    }, [currentState, fetchRewardHistory]);

    /**
     * Effect to add a keyboard shortcut ('b' key) for abort.
     */
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                event.key === 'b' &&
                (currentState === 'locked' ||
                    currentState === 'countdown' ||
                    currentState === 'testing')
            ) {
                notification.warning({
                    message: 'Stop/Abort Triggered',
                    description:
                        "Stop/Abort command triggered via keyboard shortcut ('b').",
                });
                abortSession();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentState, abortSession]);

    /**
     * Memoized value for the main session timer.
     */
    const sessionTimeRemaining = useMemo(() => {
        if (!status) return 0;
        switch (status.status) {
            case 'locked':
                return status.lockSecondsRemaining || 0;
            case 'aborted':
                return status.penaltySecondsRemaining || 0;
            case 'testing':
                return status.testSecondsRemaining || 0;
            default:
                return 0;
        }
    }, [status]);

    /**
     * Memoized value for the channel countdown timers.
     */
    const channelDelays = useMemo(() => {
        if (!status || status.status !== 'countdown') return [];
        return status.countdownSecondsRemaining || [];
    }, [status]);

    // Package all state and functions into the context value
    const contextValue: SessionContextState = {
        status,
        currentState,
        rewardHistory,
        sessionTimeRemaining,
        channelDelays,
        isLocking,
        startSession,
        abortSession,
        startTestSession,
    };

    return (
        <SessionContext.Provider value={contextValue}>
            {children}
            {/* Global error popup */}
            {error && (
                <Alert
                    type="error"
                    message={error}
                    showIcon
                    closable
                    onClose={() => setError(null)}
                    style={{
                        position: 'fixed',
                        bottom: 24,
                        right: 24,
                        zIndex: 2000,
                        maxWidth: 400,
                    }}
                />
            )}
        </SessionContext.Provider>
    );
};
