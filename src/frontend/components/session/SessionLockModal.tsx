import { EyeInvisibleOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Typography, Button, Modal, Statistic, Space } from 'antd';
import { formatSeconds } from '../../utils/time';
import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';

const { Title, Text } = Typography;

/**
 * A full-screen modal that appears when a session is active.
 */
export const SessionLockModal = () => {
    const { status, abortSession, sessionTimeRemaining } = useSession();
    const { activeDevice } = useDeviceManager();

    const isLocked = status?.status === 'locked';
    const isTimerHidden = status?.hideTimer === true;

    // Check if the connected device supports the foot pedal feature
    const hasFootPedal = activeDevice?.features?.includes('footPedal');

    const modalBodyStyle: React.CSSProperties = {
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px',
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
                    // Show timer
                    <Statistic
                        title={
                            <Title level={4} style={{ color: '#ffffff99' }}>
                                Time Remaining
                            </Title>
                        }
                        value={status ? formatSeconds(sessionTimeRemaining) : '00:00:00'}
                        valueStyle={{
                            color: '#fff',
                            fontSize: 'clamp(3rem, 10vw, 7rem)',
                            fontFamily: 'monospace',
                        }}
                    />
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 64 }}>
                <Button
                    type="primary"
                    danger
                    icon={<StopOutlined />}
                    onClick={abortSession}
                    size="large"
                    style={{ minWidth: '300px' }}
                >
                    Abort Session
                </Button>

                {/* Show hardware shortcut hint if supported */}
                {hasFootPedal && (
                    <Space style={{ marginTop: 16, color: 'rgba(255, 255, 255, 0.65)' }}>
                        <ThunderboltOutlined />
                        <Text style={{ color: 'inherit' }}>Long-press foot pedal to abort</Text>
                    </Space>
                )}
            </div>
        </Modal>
    );
};
