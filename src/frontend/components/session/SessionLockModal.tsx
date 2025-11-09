import { EyeInvisibleOutlined, StopOutlined } from '@ant-design/icons';
import { Typography, Button, Modal, Statistic } from 'antd';
import { secondsRemainingToHuman } from '../../utils/time';
import { useSession } from '../../context/useSessionContext';

const { Title } = Typography;

/**
 * A full-screen modal that appears when a session is active.
 */
export const SessionLockModal = () => {
    const { status, abortSession, sessionTimeRemaining } = useSession();

    const isLocked = status?.status === 'locked';
    const isTimerHidden = status?.hideTimer === true;
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
            <Title
                level={2}
                style={{ color: '#fff', marginBottom: 48, textAlign: 'center' }}
            >
                {isTimerHidden
                    ? 'Session Locked: Tension Mode'
                    : 'Session Locked'}
            </Title>
            <div style={{ textAlign: 'center' }}>
                {isTimerHidden ? (
                    // Show hidden icon
                    <div>
                        <EyeInvisibleOutlined
                            style={{ fontSize: '80px', color: '#ffffff99' }}
                        />
                        <Title
                            level={3}
                            style={{ color: '#fff', marginTop: 24 }}
                        >
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
                        value={
                            status
                                ? secondsRemainingToHuman(sessionTimeRemaining)
                                : '00:00:00'
                        }
                        valueStyle={{
                            color: '#fff',
                            fontSize: 'clamp(3rem, 10vw, 7rem)',
                            fontFamily: 'monospace',
                        }}
                    />
                )}
            </div>
            <Button
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={abortSession}
                size="large"
                style={{ minWidth: '300px', marginTop: 64 }}
            >
                Abort Session
            </Button>
        </Modal>
    );
};
