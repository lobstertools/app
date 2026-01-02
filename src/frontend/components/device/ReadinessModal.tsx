import { Modal, Typography, Steps, Result, theme as antdTheme } from 'antd';
import { LoadingOutlined, WifiOutlined, SafetyCertificateOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useSession } from '../../context/useSessionContext';

const { Text } = Typography;

export const ReadinessModal = () => {
    const { currentState } = useSession();
    const { token } = antdTheme.useToken();

    // Only visible during the validation phase
    const isOpen = currentState === 'verifying_hardware';

    return (
        <Modal open={isOpen} footer={null} closable={false} maskClosable={false} centered width={600}>
            <Result
                icon={<SafetyCertificateOutlined style={{ color: token.colorPrimary }} />}
                title="Connect Abort Button to Continue"
                subTitle={
                    <Text type="secondary" style={{ fontSize: 16 }}>
                        The system is waiting for the safety hardware to be detected.
                    </Text>
                }
                extra={
                    <div style={{ marginTop: 32, padding: '0 24px', textAlign: 'left' }}>
                        <Steps
                            direction="vertical"
                            current={1}
                            items={[
                                {
                                    title: 'Wi-Fi Connection',
                                    description: 'Device online',
                                    status: 'finish',
                                    icon: <WifiOutlined />,
                                },
                                {
                                    title: 'Safety Check',
                                    description: (
                                        <Text strong style={{ color: token.colorPrimary }}>
                                            Waiting for Abort Button signal...
                                        </Text>
                                    ),
                                    status: 'process',
                                    icon: <LoadingOutlined />,
                                },
                                {
                                    title: 'Ready',
                                    description: 'Unlocks the dashboard. You can run a complete hardware check in "Test Mode" after this.',
                                    status: 'wait',
                                    icon: <CheckCircleOutlined />,
                                },
                            ]}
                        />
                    </div>
                }
            />
        </Modal>
    );
};
