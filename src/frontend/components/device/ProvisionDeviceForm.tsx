import {
    Form,
    Input,
    Button,
    InputNumber,
    Checkbox,
    Spin,
    Alert,
    Typography,
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

                <Form.Item
                    name="ssid"
                    label="Wi-Fi Name (SSID)"
                    rules={[{ required: true, message: 'SSID is required' }]}
                    style={{ marginTop: 16 }}
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

                <Form.Item
                    name="abortDelaySeconds"
                    label="Abort Padel Hold Time (Seconds)"
                    rules={[{ required: true }]}
                >
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item name="countStreaks" valuePropName="checked">
                    <Checkbox>
                        Count consecutive successful sessions (Streaks)
                    </Checkbox>
                </Form.Item>

                <Form.Item name="enableTimePayback" valuePropName="checked">
                    <Checkbox>
                        Enable Time Payback for aborted sessions
                    </Checkbox>
                </Form.Item>

                {enablePayback && (
                    <Form.Item
                        name="abortPaybackMinutes"
                        label="Payback Time per Abort (Minutes)"
                        rules={[{ required: true }]}
                        style={{ paddingLeft: 24 }}
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
