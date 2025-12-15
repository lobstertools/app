import { Typography, Button, Alert, Space, List, theme } from 'antd';
import { DesktopOutlined, RightOutlined, HddOutlined, CloudOutlined, DisconnectOutlined, LoadingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface PreparationStageProps {
    currentState: string;
    enableRewardCode: boolean;
    openDeviceModal: () => void;
    onContinue: () => void;
}

export const PreparationStage = ({ currentState, enableRewardCode, openDeviceModal, onContinue }: PreparationStageProps) => {
    const { token } = theme.useToken();

    /**
     * Helper to determine the text/state of the "Continue" button.
     */
    const getContinueButtonProps = () => {
        let text = 'Continue to Configuration';
        let disabled = false;
        let icon = <RightOutlined />;
        let onClick = onContinue;

        switch (currentState) {
            case 'no_device_selected':
                text = 'Select a Device to Continue';
                disabled = false;
                icon = <HddOutlined />;
                onClick = openDeviceModal;
                break;
            case 'server_unreachable':
                text = 'Server Unreachable';
                disabled = true;
                icon = <CloudOutlined />;
                break;
            case 'device_unreachable':
                text = 'Device Unreachable';
                disabled = true;
                icon = <DisconnectOutlined />;
                break;
            case 'TESTING':
                text = 'Testing Hardware...';
                disabled = true;
                icon = <LoadingOutlined />;
                break;
        }

        return { text, disabled, icon, onClick };
    };

    const continueButtonProps = getContinueButtonProps();

    return (
        <div style={{ width: '100%' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {enableRewardCode && (
                    <div>
                        <Title level={5}>Prepare Your Reward Lock</Title>
                        <Text type="secondary">
                            Before continuing, program your physical lock using the combination pattern shown on the right.
                        </Text>
                        <List
                            size="small"
                            bordered
                            style={{
                                marginTop: '16px',
                                backgroundColor: token.colorFillAlter,
                            }}
                            dataSource={[
                                'Place the lock in the open position.',
                                'On the back of the lock, slide the reset lever to the "up" position (towards "R").',
                                'Insert the shackle into the lock and squeeze firmly twice to clear it.',
                                'Pull up the shackle to re-open it.',
                                'Enter the new combination pattern (from the image on the right).',
                                'Slide the reset lever back to the "down" position.',
                                'Place the lock onto the box containing your reward.',
                                'Insert the shackle and squeeze firmly to secure it.',
                            ]}
                            renderItem={(item, index) => (
                                <List.Item>
                                    <Text>
                                        <Text strong>{index + 1}.</Text> {item}
                                    </Text>
                                </List.Item>
                            )}
                        />
                    </div>
                )}

                <Alert
                    message="Disable Sleep Mode"
                    description="To ensure you can always access the controls, please go to your system settings and temporarily disable sleep mode and the screensaver."
                    type="info"
                    showIcon
                    icon={<DesktopOutlined />}
                />
                <Button
                    type="primary"
                    size="large"
                    onClick={continueButtonProps.onClick}
                    style={{ width: '100%' }}
                    icon={continueButtonProps.icon}
                    disabled={continueButtonProps.disabled}
                >
                    {continueButtonProps.text}
                </Button>
            </Space>
        </div>
    );
};
