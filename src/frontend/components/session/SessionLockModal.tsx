import { EyeInvisibleOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Typography, Button, Modal, Statistic, Space } from 'antd';
import { formatSeconds } from '../../utils/time';
import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import { PressProgressBar } from '../device/PressProgressBar';

const { Title, Text } = Typography;

/**
 * A full-screen modal that appears when a session is active.
 */
export const SessionLockModal = () => {
    const { status, abortSession } = useSession();
    const { activeDevice } = useDeviceManager();

    const isLocked = status?.status === 'locked';

    // Access hideTimer from config object
    const isTimerHidden = status?.config?.hideTimer === true;

    // Check if the connected device supports the foot pedal feature
    const hasFootPedal = activeDevice?.features?.includes('footPedal');

    // Calculate time locally
    const timeRemaining = status?.timers?.lockRemaining || 0;

    const modalBodyStyle: React.CSSProperties = {
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px',
    };

    // Styling for the unified abort control group
    const abortControlStyle: React.CSSProperties = {
        marginTop: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
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
            <Title level={2} style={{ color: '#fff', marginBottom: 48, textAlign: 'center' }}>
                {isTimerHidden ? 'Session Locked: Tension Mode' : 'Session Locked'}
            </Title>
            <div style={{ textAlign: 'center' }}>
                {isTimerHidden ? (
                    // Show hidden icon
                    <div>
                        <EyeInvisibleOutlined style={{ fontSize: '80px', color: '#ffffff99' }} />
                        <Title level={3} style={{ color: '#fff', marginTop: 24 }}>
                            Timer is Hidden
                        </Title>
                    </div>
                ) : (
                    <Statistic
                        title={
                            <Title level={4} style={{ color: '#ffffff99' }}>
                                Time Remaining
                            </Title>
                        }
                        value={status ? formatSeconds(timeRemaining) : '00:00:00'}
                        valueStyle={{
                            color: '#fff',
                            fontSize: 'clamp(3rem, 10vw, 7rem)',
                            fontFamily: 'monospace',
                        }}
                    />
                )}
            </div>

            {/* Unified Abort Controls */}
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

                {/* Show hardware shortcut hint/progress if supported */}
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
                                <ThunderboltOutlined />
                                <Text style={{ color: 'inherit', fontSize: '12px' }}>Long-press pedal to abort</Text>
                            </Space>
                        </div>
                        <PressProgressBar />
                    </div>
                )}
            </div>
        </Modal>
    );
};
