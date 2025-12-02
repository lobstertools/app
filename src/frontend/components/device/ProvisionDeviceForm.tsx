import {
    Form,
    Input,
    Button,
    InputNumber,
    Checkbox,
    Spin,
    Alert,
    Typography,
    Divider,
    Row,
    Col,
    Steps,
    Space,
    Switch,
    theme as antdTheme,
} from 'antd';
import { useState } from 'react';
import { WifiOutlined, SafetyCertificateOutlined, RightOutlined, LeftOutlined, SaveOutlined } from '@ant-design/icons';
import { DiscoveredDevice, DeviceProvisioningData } from '../../../types';
import { useDeviceManager } from '../../context/useDeviceManager';

/**
 * This form collects WiFi credentials and the static device config
 * and sends it via the provisionDevice function from the context.
 */
interface ProvisionDeviceFormProps {
    device: DiscoveredDevice;
    onSuccess: () => void;
}

const { Text, Title } = Typography;

export const ProvisionDeviceForm = ({ device, onSuccess }: ProvisionDeviceFormProps) => {
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Get theme tokens for the "inset" styling
    const { token } = antdTheme.useToken();

    // Watchers for conditional rendering
    const enablePaybackTime = Form.useWatch('enablePaybackTime', form);

    // Use the context for provisioning and loading state
    const { provisionDevice, isProvisioning } = useDeviceManager();

    // Styling for the dependent configuration
    const dependentConfigStyle = {
        paddingLeft: 12,
        marginLeft: 4,
        borderLeft: `2px solid ${token.colorBorderSecondary}`,
        marginTop: 8,
        marginBottom: 8,
    };

    /**
     * validate fields for the current step before moving forward
     */
    const handleNext = async () => {
        try {
            // Validate only fields relevant to step 0
            await form.validateFields(['ssid', 'pass', 'ch1Enabled', 'ch2Enabled', 'ch3Enabled', 'ch4Enabled']);
            setCurrentStep(1);
        } catch (e) {
            // Validation failed, fields will be highlighted
        }
    };

    const handlePrev = () => {
        setCurrentStep(0);
    };

    /**
     * Handles the form submission.
     */
    const handleFinish = async (values: any) => {
        setError(null);

        // 1. Calculate Seconds from Minutes Input
        const minutesInput = values.enablePaybackTime ? values.paybackTimeMinutes : 0;
        const paybackDurationSeconds = minutesInput * 60;

        // 2. Construct the strict payload matching DeviceProvisioningData interface
        // Note: Because we used display:none for steps, values.ssid etc are guaranteed to be here.
        const payload: DeviceProvisioningData = {
            ssid: values.ssid,
            pass: values.pass,
            enableStreaks: !!values.enableStreaks,
            enablePaybackTime: !!values.enablePaybackTime,
            paybackDurationSeconds: paybackDurationSeconds,
            enableRewardCode: !!values.enableRewardCode,
            ch1Enabled: !!values.ch1Enabled,
            ch2Enabled: !!values.ch2Enabled,
            ch3Enabled: !!values.ch3Enabled,
            ch4Enabled: !!values.ch4Enabled,
        };

        // Call the context function
        const success = await provisionDevice(device.id, payload);

        if (success) {
            onSuccess();
        } else {
            // Error notification is handled by the context,
            // but we can set a local error for the form Alert as backup.
            setError('Provisioning failed. Please check the console or server logs.');
        }
    };

    const steps = [
        {
            title: 'Connection & Hardware',
            icon: <WifiOutlined />,
        },
        {
            title: 'Deterrents',
            icon: <SafetyCertificateOutlined />,
        },
    ];

    // --- RENDER STEPS ---

    const renderConnectionStep = () => (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Wi-Fi Section */}
            <div>
                <Title level={5}>1. Wi-Fi Connection</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Enter the credentials for your 2.4GHz network. The device does not support 5GHz.
                </Text>

                <Form.Item
                    name="ssid"
                    label="Network Name (SSID)"
                    rules={[{ required: true, message: 'SSID is required' }]}
                    style={{ marginBottom: 16 }}
                >
                    <Input placeholder="WiFi Network Name" />
                </Form.Item>

                <Form.Item
                    name="pass"
                    label="Password"
                    rules={[{ required: true, message: 'Password is required' }]}
                    style={{ marginBottom: 0 }}
                >
                    <Input.Password placeholder="WiFi Password" />
                </Form.Item>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* Hardware Section */}
            <div>
                <Title level={5}>2. Hardware Mapping</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Select which physical outputs on the controller are connected to MagLocks.
                </Text>

                <div
                    style={{
                        backgroundColor: token.colorFillAlter,
                        padding: '16px',
                        borderRadius: token.borderRadius,
                        border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                >
                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item name="ch1Enabled" valuePropName="checked" noStyle>
                                <Checkbox style={{ display: 'flex', marginBottom: 8 }}>Channel 1</Checkbox>
                            </Form.Item>
                            <Form.Item name="ch2Enabled" valuePropName="checked" noStyle>
                                <Checkbox style={{ display: 'flex' }}>Channel 2</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="ch3Enabled" valuePropName="checked" noStyle>
                                <Checkbox style={{ display: 'flex', marginBottom: 8 }}>Channel 3</Checkbox>
                            </Form.Item>
                            <Form.Item name="ch4Enabled" valuePropName="checked" noStyle>
                                <Checkbox style={{ display: 'flex' }}>Channel 4</Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>
                </div>
            </div>
        </Space>
    );

    const renderDeterrentsStep = () => (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                Configure behavioral deterrents to discourage aborting sessions early. These settings are stored on the
                device.
            </Text>

            {/* 1. Streak Tracking */}
            <div>
                <Title level={5}>1. Session Streaks</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    Track consecutive successful sessions. This creates a "Streak" badge in the app to provide
                    motivation.
                </Text>
                <Form.Item name="enableStreaks" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* 2. Payback Time */}
            <div>
                <Title level={5}>2. Time Payback</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    Discourages bailing out. When a session is aborted (via pedal, UI, or power loss), a "time debt" is
                    created and added to the start of your next session.
                </Text>
                <Form.Item name="enablePaybackTime" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>

                {/* Dependent Configuration: Inset Style */}
                {enablePaybackTime && (
                    <div style={dependentConfigStyle}>
                        <Form.Item label="Payback Penalty (Minutes)" style={{ marginBottom: 0 }} required={true}>
                            <Space.Compact>
                                <Form.Item
                                    name="paybackTimeMinutes"
                                    noStyle
                                    rules={[
                                        {
                                            required: true,
                                            message: 'Please set the payback time',
                                        },
                                    ]}
                                >
                                    <InputNumber min={10} max={120} style={{ width: 200 }} placeholder="e.g. 15" />
                                </Form.Item>
                                <Button disabled style={{ pointerEvents: 'none' }}>
                                    min
                                </Button>
                            </Space.Compact>
                        </Form.Item>
                        <Text type="secondary" style={{ fontSize: '0.85em', marginTop: 4, display: 'block' }}>
                            This duration is added to your next session for every abort.
                        </Text>
                    </div>
                )}
            </div>

            <Divider style={{ margin: '8px 0' }} />

            {/* 3. Reward Code */}
            <div>
                <Title level={5}>3. Reward Code</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    Generates a random directional code (Up, Down, Left, Right) for a Master Lock 1500iD. This code is
                    visible at the start to lock away your reward. When fully completing the session the code is shown
                    again immediately. If aborted, it is shown only after the penalty time expires.
                </Text>
                <Form.Item name="enableRewardCode" valuePropName="checked" style={{ marginBottom: 0 }}>
                    <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                </Form.Item>
            </div>
        </Space>
    );

    return (
        <Spin spinning={isProvisioning}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Steps current={currentStep} items={steps} />

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    preserve={true} // Ensure values are kept even if components unmount
                    initialValues={{
                        // Deterrent Defaults
                        enableStreaks: true,
                        enablePaybackTime: true,
                        enableRewardCode: true,
                        paybackTimeMinutes: 15,
                        // Hardware Defaults
                        ch1Enabled: true,
                        ch2Enabled: true,
                        ch3Enabled: false,
                        ch4Enabled: false,
                    }}
                >
                    {error && (
                        <Form.Item>
                            <Alert message="Error" description={error} type="error" showIcon />
                        </Form.Item>
                    )}

                    {/* Step Content: We use display styling to hide/show so DOM elements remain active */}
                    <div style={{ marginTop: 24 }}>
                        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>{renderConnectionStep()}</div>
                        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>{renderDeterrentsStep()}</div>
                    </div>

                    {/* Navigation Buttons */}
                    <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between' }}>
                        {currentStep > 0 && (
                            <Button onClick={handlePrev} icon={<LeftOutlined />}>
                                Back
                            </Button>
                        )}
                        {currentStep === 0 && (
                            <Button
                                type="primary"
                                onClick={handleNext}
                                icon={<RightOutlined />}
                                style={{ marginLeft: 'auto' }}
                            >
                                Next
                            </Button>
                        )}
                        {currentStep === 1 && (
                            <Button type="primary" htmlType="submit" loading={isProvisioning} icon={<SaveOutlined />}>
                                Provision Device
                            </Button>
                        )}
                    </div>
                </Form>
            </Space>
        </Spin>
    );
};
