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
} from 'antd';
import { useState } from 'react';
import { DiscoveredDevice, DeviceProvisioningData } from '../../../types';
import { useDeviceManager } from '../../context/DeviceManagerContext';

/**
 * This form collects WiFi credentials and the static device config
 * and sends it via the provisionDevice function from the context.
 */
interface ProvisionDeviceFormProps {
    device: DiscoveredDevice;
    onSuccess: () => void;
}

const { Text } = Typography;

export const ProvisionDeviceForm = ({
    device,
    onSuccess,
}: ProvisionDeviceFormProps) => {
    const [form] = Form.useForm();
    const [error, setError] = useState<string | null>(null);

    // Get the "payback" fields based on the "enable" checkbox
    const enablePayback = Form.useWatch('enableTimePayback', form);

    // Use the context for provisioning and loading state
    const { provisionDevice, isProvisioning } = useDeviceManager();

    /**
     * Handles the form submission.
     */
    const handleFinish = async (values: DeviceProvisioningData) => {
        setError(null);

        // Ensure numeric values are numbers, not strings
        const payload: DeviceProvisioningData = {
            ...values,
            abortDelaySeconds: Number(values.abortDelaySeconds),
            abortPaybackMinutes: Number(values.abortPaybackMinutes),
        };

        // Call the context function
        const success = await provisionDevice(device.id, payload);

        if (success) {
            onSuccess();
        } else {
            // Error notification is handled by the context,
            // but we can set a local error for the form Alert.
            setError(
                'Provisioning failed. Please check the console or server logs.'
            );
        }
    };

    return (
        <Spin spinning={isProvisioning}>
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{
                    abortDelaySeconds: 3,
                    countStreaks: true,
                    enableTimePayback: true,
                    abortPaybackMinutes: 15,
                }}
            >
                {error && (
                    <Form.Item>
                        <Alert
                            message="Error"
                            description={error}
                            type="error"
                            showIcon
                        />
                    </Form.Item>
                )}

                <Text type="secondary">
                    These settings are sent once and stored on the device.
                </Text>

                {/* --- Added Info Block --- */}
                <Alert
                    message="Settings are Permanent"
                    description="These settings are permanent. A factory reset is required to change them, which erases all data (streaks, debt, etc.)"
                    type="warning"
                    showIcon
                    style={{ marginTop: 16 }}
                />

                <Divider>Wi-Fi Credentials</Divider>

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
                    rules={[
                        { required: true, message: 'Password is required' },
                    ]}
                >
                    <Input.Password placeholder="Your Wi-Fi Password" />
                </Form.Item>

                <Divider>Device Configuration</Divider>

                {/* --- Abort Pedal Section --- */}
                <Form.Item
                    name="abortDelaySeconds"
                    label="Abort Pedal Hold Time (Seconds)"
                    rules={[{ required: true }]}
                    help="The number of seconds the abort pedal must be held down to trigger an early session abort. This helps prevent accidental presses."
                >
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>

                <Divider style={{ marginTop: '48px' }}>
                    Abort Deterrents
                </Divider>

                {/* --- Streaks Section --- */}
                <Form.Item
                    name="countStreaks"
                    valuePropName="checked"
                    help="The device will track consecutive completed sessions. This 'Streak' is visible as a badge in the app to provide motivation and a reminder of your success."
                >
                    <Checkbox>Enable Session Streaks</Checkbox>
                </Form.Item>

                {/* --- Payback Section --- */}
                <Form.Item
                    name="enableTimePayback"
                    valuePropName="checked"
                    help="Discourages bailing out. When a session is aborted (via pedal, UI, or power loss), a 'time debt' is created and added to the start of your next session."
                >
                    <Checkbox>
                        Enable Time Payback for aborted sessions
                    </Checkbox>
                </Form.Item>

                {enablePayback && (
                    <Form.Item
                        name="abortPaybackMinutes"
                        label="Payback Time per Abort (Minutes)"
                        rules={[{ required: true }]}
                    >
                        <InputNumber
                            min={1}
                            max={180}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                )}

                <Form.Item style={{ marginTop: 16 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={isProvisioning}
                        block
                    >
                        Provision Device
                    </Button>
                </Form.Item>
            </Form>
        </Spin>
    );
};
