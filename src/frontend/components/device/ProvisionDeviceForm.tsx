import {
    Form,
    Input,
    Button,
    Space,
    Switch,
    InputNumber,
    Tooltip,
    Typography,
} from 'antd';
import { DiscoveredDevice, DeviceProvisioningData } from '../../../types';
import { useDeviceManager } from '../../context/DeviceManagerContext';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ProvisionDeviceFormProps {
    device: DiscoveredDevice;
}

/**
 * This form collects WiFi credentials and the static device config
 * and sends it via the provisionDevice function.
 */
export const ProvisionDeviceForm = ({ device }: ProvisionDeviceFormProps) => {
    const { provisionDevice, isProvisioning } = useDeviceManager();
    const [form] = Form.useForm();

    // This watcher is used to conditionally render the payback input
    const timePaybackEnabled = Form.useWatch('enableTimePayback', form);

    const onFinish = async (values: any) => {
        const data: DeviceProvisioningData = {
            ssid: values.ssid,
            pass: values.pass,
            abortDelaySeconds: values.abortDelaySeconds,
            countStreaks: values.countStreaks,
            enableTimePayback: values.enableTimePayback,
            abortPaybackMinutes: values.abortPaybackMinutes || 0,
        };

        const success = await provisionDevice(device.id, data);
        if (success) {
            form.resetFields();
        }
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
                abortDelaySeconds: 3,
                countStreaks: true,
                enableTimePayback: true,
                abortPaybackMinutes: 10,
            }}
        >
            <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Provision Device</Text>
                <Form.Item
                    name="ssid"
                    label="SSID (WiFi Name)"
                    rules={[{ required: true, message: 'SSID is required' }]}
                >
                    <Input placeholder="Your 2.4GHz WiFi network name" />
                </Form.Item>
                <Form.Item name="pass" label="WiFi Password">
                    <Input.Password placeholder="Your WiFi password" />
                </Form.Item>

                <Form.Item
                    name="abortDelaySeconds"
                    label="Abort Delay (seconds)"
                    tooltip="How long the abort button must be held to trigger."
                    rules={[{ required: true, message: 'Delay is required' }]}
                >
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                </Form.Item>

                <Space
                    align="center"
                    style={{
                        width: '100%',
                        justifyContent: 'space-between',
                    }}
                >
                    <Text>
                        Count Streaks
                        <Tooltip title="Track consecutive completed sessions.">
                            <InfoCircleOutlined
                                style={{ marginLeft: 8, color: 'gray' }}
                            />
                        </Tooltip>
                    </Text>
                    <Form.Item
                        name="countStreaks"
                        valuePropName="checked"
                        noStyle
                    >
                        <Switch />
                    </Form.Item>
                </Space>

                {/* 1. The 'Enable Time Payback' switch */}
                <Space
                    align="center"
                    style={{
                        width: '100%',
                        justifyContent: 'space-between',
                    }}
                >
                    <Text>
                        Enable Time Payback
                        <Tooltip title="Aborted sessions add 'payback' time to your next session.">
                            <InfoCircleOutlined
                                style={{ marginLeft: 8, color: 'gray' }}
                            />
                        </Tooltip>
                    </Text>
                    <Form.Item
                        name="enableTimePayback"
                        valuePropName="checked"
                        noStyle
                    >
                        <Switch />
                    </Form.Item>
                </Space>

                {/* 2. The 'Payback Time' input, conditionally rendered */}
                {timePaybackEnabled && (
                    <Form.Item
                        name="abortPaybackMinutes"
                        label="Payback Time (minutes)"
                        tooltip="Time added as 'payback' for each aborted session."
                        rules={[
                            { required: true, message: 'Payback is required' },
                        ]}
                    >
                        <InputNumber
                            min={1}
                            max={60}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                )}

                <Form.Item style={{ marginBottom: 0 }}>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={isProvisioning}
                        style={{ width: '100%' }}
                    >
                        Provision
                    </Button>
                </Form.Item>
            </Space>
        </Form>
    );
};
