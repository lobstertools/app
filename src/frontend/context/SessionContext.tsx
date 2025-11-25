import { useMemo, ReactNode, useCallback, useEffect, useState } from 'react';
import { notification, Alert } from 'antd';
import axios from 'axios';

import { Reward, SessionStatus, ComputedAppStatus, SessionArmRequest } from '../../types';

import { apiClient } from '../lib/apiClient';
import { useDeviceManager } from './useDeviceManager';
import { SessionContext, SessionContextState } from './useSessionContext';

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
     * Starts the session.
     * The payload is now fully constructed in the UI component.
     */
    const startSession = (payload: SessionArmRequest) => {
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
                return status.triggerStrategy === 'buttonTrigger' ? status.triggerTimeoutRemainingSeconds || 0 : 0;
            default:
                return 0;
        }
    }, [status]);

    /**
     * Maps the channel delays for the UI.
     * Only relevant when status is 'armed'.
     */
    const channelDelaysRemaining = useMemo(() => {
        // If we are armed and in auto-countdown mode, show the ticking delays.
        if (!status || status.status !== 'armed') return [];

        const d = status.channelDelaysRemainingSeconds || {};
        return [d.ch1 ?? 0, d.ch2 ?? 0, d.ch3 ?? 0, d.ch4 ?? 0];
    }, [status]);

    const contextValue: SessionContextState = {
        status,
        currentState,
        rewardHistory,
        sessionTimeRemaining,
        channelDelaysRemaining,
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
