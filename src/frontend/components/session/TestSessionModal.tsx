import { Modal, Button, Typography, Statistic, Space } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import { formatSeconds } from '../../utils/time';

const { Title, Text } = Typography;

export const TestSessionModal = () => {
    const { currentState, sessionTimeRemaining, abortSession } = useSession();
    const { activeDevice } = useDeviceManager();

    // The modal is only visible when the state is specifically 'testing'
    const isOpen = currentState === 'testing';

    // Check if the connected device supports the foot pedal feature
    const hasFootPedal = activeDevice?.features?.includes('footPedal');

    return (
        <Modal
            open={isOpen}
            footer={null}
            closable={false}
            maskClosable={false}
            centered
            width={400}
            styles={{
                body: { textAlign: 'center', padding: '20px' },
            }}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>
                        Hardware Test Active
                    </Title>
                    <Text type="secondary">Relays are currently engaged.</Text>
                </div>

                <div
                    style={{
                        background: 'rgba(0,0,0,0.03)',
                        padding: '20px',
                        borderRadius: '8px',
                    }}
                >
                    <Statistic
                        title="Time Remaining"
                        value={formatSeconds(sessionTimeRemaining)}
                        valueStyle={{
                            fontSize: '3rem',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                        }}
                    />
                </div>

                <div style={{ width: '100%' }}>
                    <Text strong style={{ display: 'block', marginBottom: 16 }}>
                        Press <Text code>b</Text> to abort
                    </Text>

                    <Button danger size="large" type="primary" onClick={abortSession} block>
                        Stop Test Now
                    </Button>

                    {hasFootPedal && (
                        <Space style={{ marginTop: 16, color: 'rgba(0, 0, 0, 0.45)' }}>
                            <ThunderboltOutlined />
                            <Text type="secondary">Double-click foot pedal to abort</Text>
                        </Space>
                    )}
                </div>
            </Space>
        </Modal>
    );
};
