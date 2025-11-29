import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { App } from 'antd';

import { KeyboardContext, KeyboardContextState } from './useKeyboardContext';
import { useSession } from './useSessionContext';
import { useDeviceManager } from './useDeviceManager';
import { KeyboardHelpModal } from '../components/app/KeyboardHelpModal';

export const KeyboardProvider = ({ children }: { children: ReactNode }) => {
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const { notification } = App.useApp();

    // We use a ref for the start config action so the effect
    // doesn't need to re-bind when the callback changes.
    const startConfigActionRef = useRef<(() => void) | null>(null);

    // Consume existing contexts to trigger actions
    const { currentState, abortSession, startTestSession } = useSession();
    const { openDeviceModal, openDeviceSettingsModal, activeDevice, openDeviceLogs } = useDeviceManager();

    const openHelp = useCallback(() => setIsHelpOpen(true), []);
    const closeHelp = useCallback(() => setIsHelpOpen(false), []);

    const registerStartConfigAction = useCallback((cb: () => void) => {
        startConfigActionRef.current = cb;
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // 1. Ignore shortcuts if user is typing in an input field
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // 2. Handle Keys
            switch (event.key) {
                case 'b': // Break / Abort
                    if (['locked', 'armed', 'testing'].includes(currentState)) {
                        notification.warning({
                            message: 'Abort Triggered via Keyboard',
                            duration: 2,
                        });
                        abortSession();
                    }
                    break;

                case 't': // Test
                    if (currentState === 'ready') {
                        startTestSession();
                    }
                    break;

                case 'm': // Device Manager
                    // Prevent opening if we are in a critical state
                    if (['locked', 'armed'].includes(currentState)) {
                        notification.warning({ message: 'Cannot switch devices while active.' });
                    } else {
                        openDeviceModal();
                    }
                    break;

                case 's': // Start Config
                    if (startConfigActionRef.current) {
                        startConfigActionRef.current();
                    }
                    break;

                case 'l': // Shows logs
                    openDeviceLogs();
                    break;

                case 'd': // Device Settings
                    if (activeDevice === null) {
                        notification.warning({
                            message: 'Cannot open settings without active device. Select a device first.',
                        });
                        openDeviceModal();
                        return;
                    }

                    // Prevent opening if we are in a critical state
                    if (['locked', 'armed'].includes(currentState) && activeDevice !== null) {
                        notification.warning({ message: 'Cannot configure devices while active.' });
                    } else {
                        openDeviceSettingsModal();
                    }
                    break;
                case '?': // Help
                    setIsHelpOpen((prev) => !prev);
                    break;

                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        currentState,
        abortSession,
        startTestSession,
        openDeviceModal,
        openDeviceSettingsModal,
        activeDevice,
        notification,
        openDeviceLogs,
    ]);

    const contextValue: KeyboardContextState = {
        isHelpOpen,
        openHelp,
        closeHelp,
        registerStartConfigAction,
    };

    return (
        <KeyboardContext.Provider value={contextValue}>
            {children}
            <KeyboardHelpModal />
        </KeyboardContext.Provider>
    );
};
