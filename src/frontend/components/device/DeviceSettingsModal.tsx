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
    BulbOutlined,
} from '@ant-design/icons';
import { useDeviceManager } from '../../context/useDeviceManager';
import { useState, useMemo } from 'react';
import { useSession } from '../../context/useSessionContext';
import { formatSeconds } from '../../utils/time';
import { DeviceFeature } from '../../../types';

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
        const success = await updateWifi(activeDevice.id, values.ssid, values.pass);
        if (success) {
            message.success('Wi-Fi updated. Please reboot the device to apply.');
            form.resetFields();
        } else {
            setError('Failed to update Wi-Fi. The device may not be in the READY state.');
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

    // Calculate display string for enabled channels
    const enabledChannelsString = useMemo(() => {
        if (!activeDevice?.channels) return 'N/A';
        const { ch1, ch2, ch3, ch4 } = activeDevice.channels;
        const list = [];
        if (ch1) list.push('1');
        if (ch2) list.push('2');
        if (ch3) list.push('3');
        if (ch4) list.push('4');

        if (list.length === 0) return 'None';
        if (list.length === 4) return 'All (4)';
        return list.join(', ');
    }, [activeDevice]);

    // --- Device Config Items ---

    const paybackDurationSeconds = activeDevice?.deterrents?.paybackDurationSeconds || 0;
    const paybackTimeMinutes = Math.floor(paybackDurationSeconds / 60);

    const configItems = [
        {
            key: 'channels',
            label: 'Enabled Channels',
            children: enabledChannelsString,
        },
        {
            key: 'streaks',
            label: 'Streaks Enabled',
            children: activeDevice?.deterrents?.enableStreaks ? 'Yes' : 'No',
        },
        {
            key: 'rewardCode',
            label: 'Reward Code Enabled',
            children: activeDevice?.deterrents?.enableRewardCode ? 'Yes' : 'No',
        },
        {
            key: 'payback',
            label: 'Payback Time Enabled',
            children: activeDevice?.deterrents?.enablePaybackTime ? 'Yes' : 'No',
        },
        {
            key: 'paybackMins',
            label: 'Payback Time',
            children: `${paybackTimeMinutes} min`,
            span: 2,
        },
    ];

    // --- Session Stat Items  ---
    const { streaks = 0, totalTimeLockedSeconds = 0, completed = 0, aborted = 0 } = status?.stats || {};

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
            children: formatSeconds(totalTimeLockedSeconds),
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
            children: completed,
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
            children: aborted,
        },
    ];

    // --- Feature Tags Generation ---
    const getFeatureTagInfo = (feature: DeviceFeature) => {
        switch (feature) {
            case 'footPedal':
                return { label: 'Foot Pedal', icon: <UsbOutlined /> };
            case 'startCountdown':
                return {
                    label: 'Auto Countdown',
                    icon: <ClockCircleOutlined />,
                };
            case 'statusLed':
                return { label: 'Status LED', icon: <BulbOutlined /> };
            default:
                // Fallback for unknown/future features
                return { label: feature, icon: <CheckCircleOutlined /> };
        }
    };

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
                    <Form form={form} layout="vertical" onFinish={handleWifiUpdate}>
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
                            rules={[{ required: true, message: 'SSID is required' }]}
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
                    <Descriptions bordered items={sessionStatItems} size="small" column={2} />

                    <Divider orientation="left">Device Configuration</Divider>
                    <Descriptions bordered items={configItems} size="small" />

                    <Divider orientation="left">Detected Features</Divider>
                    <Space wrap>
                        {activeDevice?.features && activeDevice.features.length > 0 ? (
                            activeDevice.features.map((feature) => {
                                const { label, icon } = getFeatureTagInfo(feature);
                                return (
                                    <Tag icon={icon} color="success" key={feature}>
                                        {label}
                                    </Tag>
                                );
                            })
                        ) : (
                            <Text type="secondary">No features detected</Text>
                        )}
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
                                        Erase all settings (including Wi-Fi) and all session data (streaks, debt) from
                                        the device and put it back into provisioning mode.
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
