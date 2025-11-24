import { Form, Input, Button, InputNumber, Checkbox, Spin, Alert, Typography, Divider, Row, Col, Card } from 'antd';
import { useState } from 'react';
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

const { Text } = Typography;

export const ProvisionDeviceForm = ({ device, onSuccess }: ProvisionDeviceFormProps) => {
    const [form] = Form.useForm();
    const [error, setError] = useState<string | null>(null);

    // Watch the "enablePaybackTime" field to conditionally render the minutes input
    const enablePaybackTime = Form.useWatch('enablePaybackTime', form);

    // Use the context for provisioning and loading state
    const { provisionDevice, isProvisioning } = useDeviceManager();

    /**
     * Handles the form submission.
     */
    const handleFinish = async (values: DeviceProvisioningData) => {
        setError(null);

        // Construct the payload:
        // If enablePaybackTime is false, force paybackTimeMinutes to 0.
        // Otherwise, use the value from the form.
        const payload: DeviceProvisioningData = {
            ...values,
            paybackTimeMinutes: values.enablePaybackTime ? values.paybackTimeMinutes : 0,
        };

        // Call the context function
        const success = await provisionDevice(device.id, payload);

        if (success) {
            onSuccess();
        } else {
            // Error notification is handled by the context,
            // but we can set a local error for the form Alert.
            setError('Provisioning failed. Please check the console or server logs.');
        }
    };

    return (
        <Spin spinning={isProvisioning}>
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{
                    enableStreaks: true,
                    enablePaybackTime: true,
                    paybackTimeMinutes: 15,
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

                <Text type="secondary">These settings are sent once and stored on the device.</Text>

                <Alert
                    message="Review Your Configuration"
                    description="Wi-Fi settings can be updated later. Session preferences (Payback, Streaks) are stored permanently in the session config until a factory reset."
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                />

                <Divider orientation="left">Wi-Fi Credentials</Divider>

                {/* --- Wi-Fi Section --- */}
                <Form.Item
                    name="ssid"
                    label="Wi-Fi Name (SSID)"
                    rules={[{ required: true, message: 'SSID is required' }]}
                >
                    <Input placeholder="Your 2.4GHz Wi-Fi Network Name" />
                </Form.Item>

                <Form.Item
                    name="pass"
                    label="Wi-Fi Password"
                    rules={[{ required: true, message: 'Password is required' }]}
                >
                    <Input.Password placeholder="Your Wi-Fi Password" />
                </Form.Item>

                <Divider orientation="left">Hardware Configuration</Divider>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                    Select which outputs are physically connected to MagLocks.
                </Text>

                <Card size="small" style={{ marginBottom: 24 }}>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item name="ch1Enabled" valuePropName="checked" noStyle>
                                <Checkbox>Ch 1</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="ch2Enabled" valuePropName="checked" noStyle>
                                <Checkbox>Ch 2</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="ch3Enabled" valuePropName="checked" noStyle>
                                <Checkbox>Ch 3</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item name="ch4Enabled" valuePropName="checked" noStyle>
                                <Checkbox>Ch 4</Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Divider orientation="left">Abort Deterrents</Divider>

                {/* --- Streaks Section --- */}
                <Form.Item
                    name="enableStreaks"
                    valuePropName="checked"
                    help="The device will track consecutive completed sessions. This 'Streak' is visible as a badge in the app to provide motivation."
                >
                    <Checkbox>Enable Session Streaks</Checkbox>
                </Form.Item>

                {/* --- Payback Section --- */}
                <Form.Item
                    name="enablePaybackTime"
                    valuePropName="checked"
                    help="Discourages bailing out. When a session is aborted (via pedal, UI, or power loss), a 'time debt' is created and added to the start of your next session."
                >
                    <Checkbox>Enable Time Payback for aborted sessions</Checkbox>
                </Form.Item>

                {/* Conditionally render the minutes input based on the checkbox */}
                {enablePaybackTime && (
                    <Form.Item
                        name="paybackTimeMinutes"
                        label="Payback Time per Abort (10 to 60 Minutes)"
                        rules={[
                            {
                                required: true,
                                message: 'Please set the payback time',
                            },
                        ]}
                    >
                        <InputNumber min={10} max={60} style={{ width: '100%' }} />
                    </Form.Item>
                )}

                <Form.Item style={{ marginTop: 16 }}>
                    <Button type="primary" htmlType="submit" loading={isProvisioning} block>
                        Provision Device
                    </Button>
                </Form.Item>
            </Form>
        </Spin>
    );
};
