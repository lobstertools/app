import { Modal, Button, Typography, Statistic, Space } from 'antd';
import { useSession } from '../../context/useSessionContext';
import { formatSeconds } from '../../utils/time';

const { Title, Text } = Typography;

export const TestSessionModal = () => {
    const { currentState, sessionTimeRemaining, abortSession } = useSession();

    // The modal is only visible when the state is specifically 'testing'
    const isOpen = currentState === 'testing';

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

                <Text strong style={{ display: 'block' }}>
                    Press <Text code>b</Text> to emergency stop
                </Text>

                <Button danger size="large" type="primary" onClick={abortSession} block>
                    Stop Test Now
                </Button>
            </Space>
        </Modal>
    );
};
