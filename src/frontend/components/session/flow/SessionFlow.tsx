import { Space, Spin, Steps, Typography, App } from 'antd';
import { useEffect, useMemo, useState } from 'react';

// Stages
import { PreparationStage } from './stages/1_PreparationStage';
import { ConfigStage } from './stages/2_ConfigStage';
import { ActiveStage } from './stages/3_ActiveStage';
import { CompletionStage } from './stages/4_CompletionStage';

import { SessionArmedModal } from '../SessionArmedModal';
import { useDeviceManager } from '../../../context/useDeviceManager';
import { useKeyboard } from '../../../context/useKeyboardContext';
import { useSession } from '../../../context/useSessionContext';
import { SessionActiveModal } from '../SessionActiveModal';

const { Text } = Typography;

export const SessionFlow = () => {
    const { currentState, status } = useSession();
    const { activeDevice, openDeviceModal } = useDeviceManager();
    const { registerStartConfigAction } = useKeyboard();
    const { notification } = App.useApp();

    const [viewStep, setViewStep] = useState(0);

    // Reset view when returning to 'READY' state
    useEffect(() => {
        if (currentState === 'READY') {
            setViewStep(0);
        }
    }, [currentState]);

    // Check deterrent configuration
    const enableRewardCode = activeDevice?.deterrentConfig?.enableRewardCode ?? true;

    // --- Keyboard Shortcut Registration ---
    useEffect(() => {
        registerStartConfigAction(() => {
            if (currentState === 'no_device_selected') {
                notification.info({ message: 'Please select a device first.' });
                openDeviceModal();
                return;
            }

            if (currentState === 'READY') {
                if (viewStep === 0) {
                    setViewStep(1);
                    notification.success({
                        message: 'Configuration Started',
                        description: 'Moved to configuration step.',
                        duration: 1.5,
                    });
                } else if (viewStep === 1) {
                    notification.info({
                        message: 'Already Configuring',
                        description: 'You are already in the configuration step.',
                        duration: 1.5,
                    });
                }
            }
        });
    }, [currentState, viewStep, openDeviceModal, registerStartConfigAction, notification]);

    // Determines which step the <Steps> component highlights
    const currentUiStep = useMemo(() => {
        if (currentState === 'no_device_selected') return 0;
        if (currentState === 'server_unreachable' || currentState === 'device_unreachable' || currentState === 'connecting') return 0;

        if (currentState === 'READY' || currentState === 'TESTING') return viewStep;
        if (currentState === 'ARMED') return 2;
        if (currentState === 'LOCKED' || currentState === 'ABORTED') return 3;
        if (currentState === 'COMPLETED') return 4;
        return 0;
    }, [currentState, viewStep]);

    const stepItems = [
        { title: 'Prepare' },
        { title: 'Configure' },
        { title: 'Arming' },
        { title: 'Active' },
        { title: enableRewardCode ? 'Reward' : 'Complete' },
    ];

    const penaltyTimeRemaining = useMemo(() => {
        if (status?.state === 'ABORTED') {
            return status.timers.penaltyRemaining || 0;
        }
        return 0;
    }, [status]);

    /**
     * Main render logic for the component.
     */
    const renderStage = () => {
        if (currentState === 'connecting') {
            return (
                <div
                    style={{
                        height: '150px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '16px',
                    }}
                >
                    <Spin size="large" />
                    <Text>Connecting...</Text>
                </div>
            );
        }

        // Logic to handle the "Prepare" view on initial load or error states
        if (
            currentState === 'no_device_selected' ||
            (currentUiStep === 0 && (currentState === 'device_unreachable' || currentState === 'server_unreachable'))
        ) {
            return (
                <PreparationStage
                    currentState={currentState}
                    enableRewardCode={enableRewardCode}
                    openDeviceModal={openDeviceModal}
                    onContinue={() => setViewStep(1)}
                />
            );
        }

        switch (currentUiStep) {
            case 0:
                return (
                    <PreparationStage
                        currentState={currentState}
                        enableRewardCode={enableRewardCode}
                        openDeviceModal={openDeviceModal}
                        onContinue={() => setViewStep(1)}
                    />
                );
            case 1:
                return <ConfigStage />;
            case 2:
                // We reuse the existing CountdownDisplay component
                return <SessionArmedModal />;
            case 3:
                return (
                    <ActiveStage
                        currentState={currentState}
                        enableRewardCode={enableRewardCode}
                        penaltyTimeRemaining={penaltyTimeRemaining}
                    />
                );
            case 4:
                return <CompletionStage />;
            default:
                return null;
        }
    };

    return (
        <>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Steps current={currentUiStep} items={stepItems} />
                <div style={{ marginTop: 0 }}>{renderStage()}</div>
            </Space>
            <SessionActiveModal />
        </>
    );
};
