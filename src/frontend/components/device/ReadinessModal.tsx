import { Modal, Typography, Space, Alert, Result, theme as antdTheme } from 'antd';
import { LoadingOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useSession } from '../../context/useSessionContext';

const { Text } = Typography;

export const ReadinessModal = () => {
    const { currentState } = useSession();
    const { token } = antdTheme.useToken();

    // Only visible during the validation phase
    const isOpen = currentState === 'validating';

    return (
        <Modal open={isOpen} footer={null} closable={false} maskClosable={false} centered width={600}>
            <Result
                icon={<LoadingOutlined style={{ fontSize: 72, color: token.colorPrimary }} spin />}
                title="Verifying Connectivity..."
                subTitle="Establishing link status with hardware peripherals."
                extra={
                    <div style={{ marginTop: 24, textAlign: 'left' }}>
                        <Alert
                            message="Hardware Safety Check"
                            description={
                                <Space direction="vertical" size="small">
                                    <Text>The device is currently verifying peripheral integrity.</Text>
                                    <Text strong>Please ensure the Abort Pedal is securely connected.</Text>
                                </Space>
                            }
                            type="warning"
                            showIcon
                            icon={<SafetyCertificateOutlined />}
                            style={{
                                border: `1px solid ${token.colorWarningBorder}`,
                                backgroundColor: token.colorWarningBg,
                            }}
                        />
                    </div>
                }
            />
        </Modal>
    );
};
