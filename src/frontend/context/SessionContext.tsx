import { useMemo, ReactNode, useCallback, useEffect, useState } from 'react';
import { notification, Alert } from 'antd';
import axios from 'axios';

import { Reward, SessionStatus, ComputedAppStatus, SessionArmRequest } from '../../types';

import { apiClient } from '../lib/apiClient';
import { useDeviceManager } from './useDeviceManager';
import { SessionContext, SessionContextState, SessionFormData } from './useSessionContext';

/**
 * Main state provider component.
 */
export const SessionProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<SessionStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLocking, setIsLocking] = useState(false);
    const [rewardHistory, setRewardHistory] = useState<Reward[]>([]);

    const { activeDevice, connectionHealth } = useDeviceManager();

    // 1. Compute the high-level application state
    const currentState = useMemo<ComputedAppStatus>(() => {
        if (!activeDevice) {
            return 'no_device_selected';
        }

        // Connection health check
        if (connectionHealth.server.status === 'error') return 'server_unreachable';
        if (connectionHealth.device.status === 'error') return 'device_unreachable';
        if (connectionHealth.server.status === 'pending' || connectionHealth.device.status === 'pending') {
            return 'connecting';
        }

        // Trust device status (ready, armed, locked, aborted, etc.)
        return status?.status || 'connecting';
    }, [activeDevice, connectionHealth, status]);

    // --- API Interactions ---

    /**
     * Fetches the main /session/status JSON from the active device.
     */
    const fetchSessionStatus = useCallback(async () => {
        if (!activeDevice) return;
        try {
            const response = await apiClient.get<SessionStatus>(`/devices/${activeDevice.id}/session/status`);
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
            const response = await apiClient.get<Reward[]>(`/devices/${activeDevice.id}/session/reward`);
            setRewardHistory(response.data);
        } catch (err: unknown) {
            console.error('Failed to fetch reward history', err);
            setRewardHistory([]);
        }
    }, [activeDevice]);

    /**
     * Sends the /arm command (formerly /start) to the device.
     */
    const sendArmCommand = useCallback(
        async (payload: SessionArmRequest) => {
            if (!activeDevice) return;
            if (currentState !== 'ready') {
                notification.error({
                    message: 'Device Busy',
                    description: 'Device must be READY to arm a new session.',
                });
                return fetchSessionStatus();
            }

            setIsLocking(true);
            try {
                // Endpoint changed from /start to /arm
                await apiClient.post(`/devices/${activeDevice.id}/session/arm`, payload);

                const modeMsg =
                    payload.triggerStrategy === 'buttonTrigger' ? 'Waiting for Button Press...' : 'Countdown Started';

                notification.success({
                    message: 'Device Armed',
                    description: modeMsg,
                });
                await fetchSessionStatus();
            } catch (err: unknown) {
                let msg = 'Failed to arm the device.';
                if (axios.isAxiosError(err)) {
                    msg = err.response?.data?.message || err.message;
                } else if (err instanceof Error) {
                    msg = err.message;
                }

                setError(msg);
                notification.error({ message: 'Arm Failed', description: msg });
                await fetchSessionStatus();
            } finally {
                setIsLocking(false);
            }
        },
        [activeDevice, currentState, fetchSessionStatus]
    );

    /**
     * Processes Form Data -> SessionArmRequest
     */
    const startSession = (values: SessionFormData) => {
        if (!activeDevice) return;

        const {
            type,
            timeRangeSelection,
            duration,
            penaltyDuration,
            hideTimer,
            rangeMin,
            rangeMax,
            useMultiChannelDelay,
            delayCh1,
            delayCh2,
            delayCh3,
            delayCh4,
            triggerStrategy, // NEW
        } = values;

        // --- Duration Calculation ---
        let finalDurationMinutes: number;
        const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

        switch (type) {
            case 'time-range':
                if (timeRangeSelection === 'short') finalDurationMinutes = getRandom(20, 45);
                else if (timeRangeSelection === 'medium') finalDurationMinutes = getRandom(60, 90);
                else finalDurationMinutes = getRandom(120, 180);
                break;
            case 'random':
                if (!rangeMin || !rangeMax || rangeMin > rangeMax) {
                    notification.error({
                        message: 'Invalid Range',
                        description: 'Min > Max.',
                    });
                    return;
                }
                finalDurationMinutes = getRandom(rangeMin, rangeMax);
                break;
            case 'fixed':
            default:
                finalDurationMinutes = duration || 30;
                break;
        }

        // --- Delay Object Construction ---
        const delaysObject = { ch1: 0, ch2: 0, ch3: 0, ch4: 0 };
        const commonDelay = delayCh1 || 0;

        if (useMultiChannelDelay) {
            if (activeDevice.channels.ch1) delaysObject.ch1 = delayCh1 || 0;
            if (activeDevice.channels.ch2) delaysObject.ch2 = delayCh2 || 0;
            if (activeDevice.channels.ch3) delaysObject.ch3 = delayCh3 || 0;
            if (activeDevice.channels.ch4) delaysObject.ch4 = delayCh4 || 0;
        } else {
            if (activeDevice.channels.ch1) delaysObject.ch1 = commonDelay;
            if (activeDevice.channels.ch2) delaysObject.ch2 = commonDelay;
            if (activeDevice.channels.ch3) delaysObject.ch3 = commonDelay;
            if (activeDevice.channels.ch4) delaysObject.ch4 = commonDelay;
        }

        // --- Build Payload ---
        const payload: SessionArmRequest = {
            triggerStrategy, // Pass strategy (autoCountdown vs buttonTrigger)
            duration: finalDurationMinutes,
            hideTimer,
            delays: delaysObject,
            penaltyDuration,
        };

        sendArmCommand(payload);
    };

    /**
     * Sends the /abort command to the device.
     */
    const abortSession = useCallback(async () => {
        if (!activeDevice) return;
        const stateBeforeAbort = status?.status;
        try {
            await apiClient.post(`/devices/${activeDevice.id}/session/abort`);

            if (stateBeforeAbort === 'armed') {
                notification.info({
                    message: 'Arming Cancelled',
                    description: 'The session start was cancelled. No penalty.',
                });
            } else if (stateBeforeAbort === 'locked') {
                notification.warning({
                    message: 'Session Aborted',
                    description: 'Penalty timer has started.',
                });
            } else if (stateBeforeAbort === 'testing') {
                notification.info({
                    message: 'Test Stopped',
                    description: 'Hardware test stopped.',
                });
            }

            await fetchSessionStatus();
        } catch (err: unknown) {
            let msg = 'Failed to abort session.';
            if (axios.isAxiosError(err)) {
                msg = err.response?.data?.message || err.message;
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
            notification.success({ message: 'Test Mode Started' });
            await fetchSessionStatus();
        } catch (err: unknown) {
            notification.error({
                message: 'Test Failed',
                description: 'Could not start test mode.',
            });
        }
    }, [activeDevice, currentState, fetchSessionStatus]);

    // --- Polling Effects ---

    useEffect(() => {
        if (!activeDevice || currentState === 'server_unreachable' || currentState === 'no_device_selected') {
            return;
        }

        fetchSessionStatus();

        let pollInterval: number;
        switch (currentState) {
            case 'locked':
            case 'armed': // Poll fast during arming to see countdowns or button press
            case 'aborted':
            case 'testing':
                pollInterval = 500;
                break;
            case 'ready':
            case 'completed':
                pollInterval = 5000;
                break;
            default:
                pollInterval = 2500;
                break;
        }
        const timer = setInterval(fetchSessionStatus, pollInterval);
        return () => clearInterval(timer);
    }, [activeDevice, currentState, fetchSessionStatus, connectionHealth]);

    /**
     * Effect to fetch reward history when the device is in a valid state.
     */
    useEffect(() => {
        const canFetchHistory = ['ready', 'completed', 'testing'].includes(currentState);
        if (canFetchHistory) fetchRewardHistory();
        else setRewardHistory([]);
    }, [currentState, fetchRewardHistory]);

    /**
     * Effect to add a keyboard shortcut ('b' key) for abort.
     */
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'b' && ['locked', 'armed', 'testing'].includes(currentState)) {
                notification.warning({
                    message: 'Abort Triggered via Keyboard',
                });
                abortSession();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentState, abortSession]);

    // --- Computed Values for UI ---

    /**
     * Determines the "Main Timer" to show in the UI.
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
            case 'armed':
                // If waiting for button, show the timeout.
                // If auto-counting down, this might be 0, but 'channelDelays' handles the UI.
                return status.triggerStrategy === 'buttonTrigger' ? status.triggerTimeoutRemaining || 0 : 0;
            default:
                return 0;
        }
    }, [status]);

    /**
     * Maps the channel delays for the UI.
     * Only relevant when status is 'armed'.
     */
    const channelDelays = useMemo(() => {
        // If we are armed and in auto-countdown mode, show the ticking delays.
        // If we are armed and in button mode, we technically have delays set,
        // but they aren't ticking yet, so we could show them as static or hide them.
        if (!status || status.status !== 'armed') return [];

        return [status.delays?.ch1 ?? 0, status.delays?.ch2 ?? 0, status.delays?.ch3 ?? 0, status.delays?.ch4 ?? 0];
    }, [status]);

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
