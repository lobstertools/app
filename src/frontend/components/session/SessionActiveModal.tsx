import {
    EyeInvisibleOutlined,
    StopOutlined,
    ThunderboltOutlined,
    PlusOutlined,
    MinusOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import { Typography, Button, Modal, Space, Tooltip, Tag, theme } from 'antd';
import { useState, useEffect, useRef } from 'react';
import { formatSeconds } from '../../utils/time';
import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import { PressProgressBar } from '../device/PressProgressBar';

const { Title, Text } = Typography;

export const SessionActiveModal = () => {
    const { status, abortSession, addTime, removeTime } = useSession();
    const { activeDevice } = useDeviceManager();
    const { token } = theme.useToken();

    // --- Timer Stability Logic ---
    // We use a deadline-based approach to prevent flickering when server polling occurs.
    const [timeLeft, setTimeLeft] = useState(status?.timers?.lockRemaining || 0);
    const deadlineRef = useRef<number>(Date.now() + (status?.timers?.lockRemaining || 0) * 1000);

    const isLocked = status?.state === 'LOCKED';
    const isTimerHidden = status?.config?.hideTimer === true;
    const isTimeModifyEnabled = activeDevice?.deterrentConfig.enableTimeModification === true;
    const hasFootPedal = activeDevice?.features?.includes('footPedal');

    const serverLockRemaining = status?.timers?.lockRemaining || 0;

    // 1. Sync with Server (Drift Correction)
    useEffect(() => {
        if (!status) return;
        const now = Date.now();
        const serverRemainingMs = serverLockRemaining * 1000;
        const projectedDeadline = now + serverRemainingMs;
        const currentDeadline = deadlineRef.current;

        // If the server time deviates by more than 1.5 seconds (drift or manual time change),
        // we snap our local deadline to the server's truth.
        // Otherwise, we ignore small network jitters to keep the countdown smooth.
        if (Math.abs(projectedDeadline - currentDeadline) > 1500) {
            deadlineRef.current = projectedDeadline;
            setTimeLeft(serverLockRemaining); // Immediate update for snapiness
        }
    }, [serverLockRemaining, status]);

    // 2. Local Ticker (High frequency for smoothness, updates 'timeLeft' state)
    useEffect(() => {
        if (!isLocked) return;

        const tick = () => {
            const remainingMs = deadlineRef.current - Date.now();
            const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
            setTimeLeft(remainingSec);
        };

        // Tick immediately and then interval
        tick();
        const timerId = setInterval(tick, 200); // 5Hz update for responsiveness
        return () => clearInterval(timerId);
    }, [isLocked]);

    // --- Phase Detection Logic ---
    const sessionDebtTarget = status?.timers?.potentialDebtServed || 0;

    // "Paying Debt" if we are in the final segment allocated to debt
    const isPayingDebt = sessionDebtTarget > 0 && timeLeft <= sessionDebtTarget;

    // --- Styles ---
    const modalBodyStyle: React.CSSProperties = {
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px',
        // Ensure background matches theme if Modal content is transparent
        backgroundColor: token.colorBgContainer,
    };

    const abortControlStyle: React.CSSProperties = {
        marginTop: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        background: token.colorFillAlter,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
    };

    return (
        <Modal
            open={isLocked}
            closable={false}
            centered
            footer={null}
            width="100%"
            styles={{ body: modalBodyStyle }}
            wrapClassName="backdrop-blur-modal"
        >
            <Title level={2} style={{ marginBottom: 48, textAlign: 'center' }}>
                {isTimerHidden ? 'Session Locked: Tension Mode' : 'Session Locked'}
            </Title>

            <div style={{ textAlign: 'center' }}>
                {isTimerHidden ? (
                    <div>
                        <EyeInvisibleOutlined style={{ fontSize: '80px', color: token.colorTextDisabled }} />
                        <Title level={3} style={{ marginTop: 24 }}>
                            Timer is Hidden
                        </Title>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {/* Main Timer Row with Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
                            {isTimeModifyEnabled && (
                                <Tooltip title="Remove Time">
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={<MinusOutlined />}
                                        onClick={removeTime}
                                        style={{
                                            background: 'transparent',
                                            borderColor: token.colorBorder,
                                            color: token.colorText,
                                        }}
                                    />
                                </Tooltip>
                            )}

                            <div style={{ textAlign: 'center', minWidth: '280px' }}>
                                <div
                                    style={{
                                        fontSize: 'clamp(4rem, 12vw, 8rem)',
                                        fontFamily: 'monospace',
                                        fontWeight: 'bold',
                                        lineHeight: 1,
                                        transition: 'color 0.3s ease',
                                        color: token.colorTextHeading,
                                    }}
                                >
                                    {status ? formatSeconds(timeLeft) : '00:00:00'}
                                </div>
                            </div>

                            {isTimeModifyEnabled && (
                                <Tooltip title="Add Time">
                                    <Button
                                        shape="circle"
                                        size="large"
                                        icon={<PlusOutlined />}
                                        onClick={addTime}
                                        style={{
                                            background: 'transparent',
                                            borderColor: token.colorBorder,
                                            color: token.colorText,
                                        }}
                                    />
                                </Tooltip>
                            )}
                        </div>

                        {/* Minimalist Phase Indicator */}
                        <div style={{ marginTop: 16, height: '24px' }}>
                            {isPayingDebt ? (
                                <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: '14px', padding: '4px 12px' }}>
                                    PAYING DEBT
                                </Tag>
                            ) : (
                                // Optional: Show nothing or a subtle "Session Time" label
                                sessionDebtTarget > 0 && <Text type="secondary">Session Time</Text>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div style={abortControlStyle}>
                <Button
                    type="primary"
                    danger
                    icon={<StopOutlined />}
                    onClick={abortSession}
                    size="large"
                    block
                    style={{ height: '50px', fontSize: '16px' }}
                >
                    Abort Session
                </Button>

                {hasFootPedal && (
                    <div style={{ width: '100%', marginTop: 20 }}>
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 8,
                            }}
                        >
                            <Space size="small">
                                <ThunderboltOutlined style={{ color: token.colorTextSecondary }} />
                                <Text style={{ color: token.colorTextSecondary, fontSize: '12px' }}>Long-press pedal to abort</Text>
                            </Space>
                        </div>
                        <PressProgressBar hideTitle={true} />
                    </div>
                )}
            </div>
        </Modal>
    );
};
