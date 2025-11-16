import {
    Modal,
    Button,
    Card,
    Tabs,
    Form,
    Input,
    Spin,
    Alert,
    message,
    Typography,
    Space,
    Divider,
    Descriptions,
    Tag,
    Col,
    Row,
    Tooltip,
} from 'antd';
import {
    WifiOutlined,
    InfoCircleOutlined,
    UndoOutlined,
    ExclamationCircleOutlined,
    CheckCircleOutlined,
    UsbOutlined,
    FireOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import { useDeviceManager } from '../../context/useDeviceManager';
import { useState } from 'react';
import { useSession } from '../../context/useSessionContext';
import { formatSeconds } from '../../utils/time';

const { Text } = Typography;
const { useModal } = Modal;

/**
 * A modal that displays device configuration and allows
 * updating Wi-Fi or factory resetting.
 */
export const DeviceSettingsModal = () => {
    const {
        isDeviceSettingsModalOpen,
        closeDeviceSettingsModal,
        activeDevice,
        updateWifi,
        isUpdatingWifi,
        factoryResetDevice,
    } = useDeviceManager();
    const { currentState, status } = useSession();

    const [form] = Form.useForm();
    const [modalApi, contextHolder] = useModal();
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        form.resetFields();
        setError(null);
        closeDeviceSettingsModal();
    };

    const handleWifiUpdate = async (values: { ssid: string; pass: string }) => {
        if (!activeDevice) return;

        setError(null);
        const success = await updateWifi(
            activeDevice.id,
            values.ssid,
            values.pass
        );
        if (success) {
            message.success(
                'Wi-Fi updated. Please reboot the device to apply.'
            );
            form.resetFields();
        } else {
            setError(
                'Failed to update Wi-Fi. The device may not be in the READY state.'
            );
        }
    };

    const showFactoryResetConfirm = () => {
        if (!activeDevice) return;
        modalApi.confirm({
            title: 'Are you sure you want to factory reset this device?',
            icon: <ExclamationCircleOutlined />,
            content: (
                <>
                    This will erase all settings (including WiFi) on
                    <Text strong> {activeDevice.name} </Text>
                    and put it back into provisioning mode.
                </>
            ),
            okText: 'Factory Reset',
            okType: 'danger',
            onOk() {
                factoryResetDevice(activeDevice.id);
                handleClose(); // Close this modal after reset
            },
        });
    };

    // --- Device Config Items ---
    const configItems = [
        {
            key: 'channels',
            label: 'Channels',
            children: activeDevice?.numberOfChannels || 'N/A',
        },
        {
            key: 'abortDelay',
            label: 'Abort Delay',
            children: `${activeDevice?.config?.abortDelaySeconds || 'N/A'} sec`,
        },
        {
            key: 'streaks',
            label: 'Streaks Enabled',
            children: activeDevice?.config?.countStreaks ? 'Yes' : 'No',
        },
        {
            key: 'payback',
            label: 'Time Payback',
            children: activeDevice?.config?.enableTimePayback ? 'Yes' : 'No',
        },
        {
            key: 'paybackMins',
            label: 'Payback Amount',
            children: `${activeDevice?.config?.abortPaybackMinutes || 'N/A'} min`,
            span: 2,
        },
    ];

    // --- Session Stat Items  ---
    const {
        streaks = 0,
        totalLockedSessionSeconds = 0,
        completedSessions = 0,
        abortedSessions = 0,
    } = status || {};

    const sessionStatItems = [
        {
            key: 'streaks',
            label: (
                <Tooltip title="Current Session Streak">
                    <Space>
                        <FireOutlined />
                        Streak
                    </Space>
                </Tooltip>
            ),
            children: streaks,
        },
        {
            key: 'timeLocked',
            label: (
                <Tooltip title="Total Time Locked">
                    <Space>
                        <ClockCircleOutlined />
                        Time Locked
                    </Space>
                </Tooltip>
            ),
            children: formatSeconds(totalLockedSessionSeconds),
        },
        {
            key: 'completed',
            label: (
                <Tooltip title="Total Sessions Completed">
                    <Space>
                        <CheckCircleOutlined />
                        Completed Sessions
                    </Space>
                </Tooltip>
            ),
            children: completedSessions,
        },
        {
            key: 'aborted',
            label: (
                <Tooltip title="Total Sessions Aborted">
                    <Space>
                        <CloseCircleOutlined />
                        Aborted Sessions
                    </Space>
                </Tooltip>
            ),
            children: abortedSessions,
        },
    ];

    const hasLedFeature = activeDevice?.features?.includes('LED_Indicator');
    const hasPedalFeature = activeDevice?.features?.includes('Abort_Pedal');

    const tabItems = [
        {
            key: 'wifi',
            label: (
                <Space>
                    <WifiOutlined />
                    Wi-Fi Settings
                </Space>
            ),
            children: (
                <Spin spinning={isUpdatingWifi}>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleWifiUpdate}
                    >
                        <Alert
                            message="A device reboot is required to apply new Wi-Fi settings."
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        {error && (
                            <Alert
                                message="Update Failed"
                                description={error}
                                type="error"
                                showIcon
                                closable
                                onClose={() => setError(null)}
                                style={{ marginBottom: 16 }}
                            />
                        )}
                        <Form.Item
                            name="ssid"
                            label="New Wi-Fi Name (SSID)"
                            rules={[
                                { required: true, message: 'SSID is required' },
                            ]}
                        >
                            <Input placeholder="Your 2.4GHz Wi-Fi Network Name" />
                        </Form.Item>
                        <Form.Item
                            name="pass"
                            label="New Wi-Fi Password"
                            rules={[
                                {
                                    required: true,
                                    message: 'Password is required',
                                },
                            ]}
                        >
                            <Input.Password placeholder="Your Wi-Fi Password" />
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={isUpdatingWifi}
                                disabled={currentState !== 'ready'}
                            >
                                Save Wi-Fi Credentials
                            </Button>
                        </Form.Item>
                    </Form>
                </Spin>
            ),
        },
        {
            key: 'info',
            label: (
                <Space>
                    <InfoCircleOutlined />
                    Info & Reset
                </Space>
            ),
            children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Divider orientation="left">Session Statistics</Divider>
                    <Descriptions
                        bordered
                        items={sessionStatItems}
                        size="small"
                        column={2}
                    />

                    <Divider orientation="left">Device Configuration</Divider>
                    <Descriptions bordered items={configItems} size="small" />

                    <Divider orientation="left">Detected Features</Divider>
                    <Space>
                        <Tag
                            icon={<CheckCircleOutlined />}
                            color={hasLedFeature ? 'success' : 'default'}
                        >
                            LED Indicator
                        </Tag>
                        <Tag
                            icon={<UsbOutlined />}
                            color={hasPedalFeature ? 'success' : 'default'}
                        >
                            Abort Pedal
                        </Tag>
                    </Space>

                    <Divider orientation="left" style={{ marginTop: 24 }}>
                        Danger Zone
                    </Divider>
                    <Card size="small">
                        <Row justify="space-between" align="middle">
                            {/* Left Side: Text */}
                            <Col span={18}>
                                <Space direction="vertical" size={0}>
                                    <Text strong>Factory Reset Device</Text>
                                    <Text type="secondary">
                                        Erase all settings (including Wi-Fi) and
                                        all session data (streaks, debt) from
                                        the device and put it back into
                                        provisioning mode.
                                    </Text>
                                </Space>
                            </Col>

                            {/* Right Side: Button */}
                            <Col span={6} style={{ textAlign: 'right' }}>
                                <Button
                                    type="default" // Changed from 'primary'
                                    danger
                                    icon={<UndoOutlined />}
                                    onClick={showFactoryResetConfirm}
                                    disabled={currentState !== 'ready'}
                                >
                                    Factory Reset
                                </Button>
                            </Col>
                        </Row>
                    </Card>
                </Space>
            ),
        },
    ];

    return (
        <>
            {contextHolder}
            <Modal
                title={`Device Settings: ${activeDevice?.name || ''}`}
                open={isDeviceSettingsModalOpen}
                onCancel={handleClose}
                width={800}
                wrapClassName="backdrop-blur-modal"
                footer={[
                    <Button key="close" onClick={handleClose}>
                        Close
                    </Button>,
                ]}
            >
                <Tabs defaultActiveKey="wifi" items={tabItems} />
            </Modal>
        </>
    );
};