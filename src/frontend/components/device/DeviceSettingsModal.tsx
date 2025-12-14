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
    Descriptions,
    Tag,
    Col,
    Row,
    Badge,
    theme,
    Divider,
} from 'antd';
import {
    WifiOutlined,
    UndoOutlined,
    ExclamationCircleOutlined,
    CheckCircleOutlined,
    UsbOutlined,
    FireOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    BulbOutlined,
    DashboardOutlined,
    SafetyCertificateOutlined,
    ToolOutlined,
    WarningOutlined,
    GlobalOutlined,
} from '@ant-design/icons';
import { useDeviceManager } from '../../context/useDeviceManager';
import { useState, useMemo } from 'react';
import { useSession } from '../../context/useSessionContext';
import { formatSeconds } from '../../utils/time';
import { DeviceFeature } from '../../../types';
import humanizeDuration from 'humanize-duration';

const { Text, Title } = Typography;
const { useModal } = Modal;

export const DeviceSettingsModal = () => {
    const { isDeviceSettingsModalOpen, closeDeviceSettingsModal, activeDevice, updateWifi, isUpdatingWifi, factoryResetDevice } =
        useDeviceManager();
    const { currentState, status } = useSession();
    const { token } = theme.useToken();

    const [form] = Form.useForm();
    const [modalApi, contextHolder] = useModal();
    const [error, setError] = useState<string | null>(null);

    // --- CONSTANTS ---
    // Fixed width for labels to ensure vertical alignment across all tables
    const descriptionLabelStyle: React.CSSProperties = { width: '180px' };

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
            icon: <ExclamationCircleOutlined style={{ color: token.colorWarning }} />,
            content: (
                <>
                    This will erase all settings (including WiFi) on
                    <Text strong> {activeDevice.identity?.name || activeDevice.identity?.name} </Text>
                    and put it back into provisioning mode.
                </>
            ),
            okText: 'Factory Reset',
            okType: 'danger',
            onOk() {
                factoryResetDevice(activeDevice.id);
                handleClose();
            },
        });
    };

    // --- Helper: Format Duration ---
    const formatDuration = (s: number) => humanizeDuration(s * 1000, { largest: 2, round: true });

    // =========================================================================
    // SECTION: DATA PREPARATION
    // =========================================================================

    // 1. Identity
    const identityItems = activeDevice?.identity
        ? [
              { key: 'name', label: 'Name', children: activeDevice.identity.name },
              { key: 'version', label: 'Version', children: <Tag>{activeDevice.identity.version}</Tag> },
              { key: 'build', label: 'Build', children: activeDevice.identity.buildType },
              { key: 'std', label: 'Standard', children: `C++${activeDevice.identity.cppStandard}` },
          ]
        : [];

    // 2. Network Stats
    const networkItems = activeDevice?.network
        ? [
              { key: 'ssid', label: 'SSID', children: <Text strong>{activeDevice.network.ssid}</Text> },
              {
                  key: 'rssi',
                  label: 'Signal Strength',
                  children: (
                      <Badge status={activeDevice.network.rssi > -70 ? 'success' : 'warning'} text={`${activeDevice.network.rssi} dBm`} />
                  ),
              },
              { key: 'ip', label: 'IP Address', children: activeDevice.network.ip },
              { key: 'mac', label: 'MAC Address', children: <Text code>{activeDevice.network.mac}</Text> },
              { key: 'hostname', label: 'Hostname', children: activeDevice.network.hostname },
              { key: 'gateway', label: 'Gateway', children: activeDevice.network.gateway },
          ]
        : [];

    // 3. Session Stats
    const { streaks = 0, totalLockedTime = 0, completed = 0, aborted = 0 } = status?.stats || {};
    const sessionStatItems = [
        {
            key: 'streaks',
            label: 'Streak',
            children: (
                <Space>
                    <FireOutlined style={{ color: token.colorWarning }} /> {streaks}
                </Space>
            ),
        },
        {
            key: 'completed',
            label: 'Completed',
            children: (
                <Space>
                    <CheckCircleOutlined style={{ color: token.colorSuccess }} /> {completed}
                </Space>
            ),
        },
        {
            key: 'aborted',
            label: 'Aborted',
            children: (
                <Space>
                    <CloseCircleOutlined style={{ color: token.colorError }} /> {aborted}
                </Space>
            ),
        },
        { key: 'timeLocked', label: 'Total Locked', children: formatSeconds(totalLockedTime) },
    ];

    // 4. System Defaults
    const defaults = activeDevice?.defaults;
    const systemItems = defaults
        ? [
              { key: 'longPress', label: 'Abort Hold Time', children: formatDuration(defaults.longPressDuration) },
              { key: 'armed', label: 'Arming Timeout', children: formatDuration(defaults.armedTimeout) },
              { key: 'keepAlive', label: 'Keep-Alive', children: formatDuration(defaults.keepAliveInterval) },
              { key: 'retries', label: 'Max Wi-Fi Retries', children: defaults.wifiMaxRetries },
          ]
        : [];

    // 5. Deterrent Configuration (Rules Tab)
    const det = activeDevice?.deterrentConfig;

    // Streaks (Standalone)
    const streakItems = det
        ? [{ key: 'streaks', label: 'Streaks', children: det.enableStreaks ? <Tag color="success">Enabled</Tag> : <Tag>Disabled</Tag> }]
        : [];

    // Reward Code Group
    const rewardItems = det
        ? [
              { key: 'status', label: 'Status', children: det.enableRewardCode ? <Tag color="success">Enabled</Tag> : <Tag>Disabled</Tag> },
              {
                  key: 'strat',
                  label: 'Strategy',
                  children: det.enableRewardCode ? (
                      det.rewardPenaltyStrategy === 'DETERRENT_RANDOM' ? (
                          'Randomized'
                      ) : (
                          'Fixed'
                      )
                  ) : (
                      <Text type="secondary" style={{ color: token.colorTextDisabled }}>
                          N/A
                      </Text>
                  ),
              },
              {
                  key: 'val',
                  label: 'Penalty',
                  children: det.enableRewardCode ? (
                      det.rewardPenaltyStrategy === 'DETERRENT_RANDOM' ? (
                          `${formatDuration(det.rewardPenaltyMin)} - ${formatDuration(det.rewardPenaltyMax)}`
                      ) : (
                          formatDuration(det.rewardPenalty)
                      )
                  ) : (
                      <Text type="secondary" style={{ color: token.colorTextDisabled }}>
                          N/A
                      </Text>
                  ),
              },
          ]
        : [];

    // Payback Group
    const paybackItems = det
        ? [
              {
                  key: 'status',
                  label: 'Status',
                  children: det.enablePaybackTime ? <Tag color="success">Enabled</Tag> : <Tag>Disabled</Tag>,
              },
              {
                  key: 'strat',
                  label: 'Strategy',
                  children: det.enablePaybackTime ? (
                      det.paybackTimeStrategy === 'DETERRENT_RANDOM' ? (
                          'Randomized'
                      ) : (
                          'Fixed'
                      )
                  ) : (
                      <Text type="secondary" style={{ color: token.colorTextDisabled }}>
                          N/A
                      </Text>
                  ),
              },
              {
                  key: 'val',
                  label: 'Payback',
                  children: det.enablePaybackTime ? (
                      det.paybackTimeStrategy === 'DETERRENT_RANDOM' ? (
                          `${formatDuration(det.paybackTimeMin)} - ${formatDuration(det.paybackTimeMax)}`
                      ) : (
                          formatDuration(det.paybackTime)
                      )
                  ) : (
                      <Text type="secondary" style={{ color: token.colorTextDisabled }}>
                          N/A
                      </Text>
                  ),
              },
          ]
        : [];

    // 6. Timing Presets (Rules Tab)
    const presets = activeDevice?.presets;

    const limitItems = presets
        ? [
              {
                  key: 'global',
                  label: 'Global Hard Limits',
                  children: (
                      <Text strong>
                          {formatDuration(presets.minSessionDuration)} - {formatDuration(presets.maxSessionDuration)}
                      </Text>
                  ),
              },
          ]
        : [];

    const rangeItems = presets
        ? [
              { key: 'short', label: 'Short Range', children: `${formatDuration(presets.shortMin)} - ${formatDuration(presets.shortMax)}` },
              {
                  key: 'medium',
                  label: 'Medium Range',
                  children: `${formatDuration(presets.mediumMin)} - ${formatDuration(presets.mediumMax)}`,
              },
              { key: 'long', label: 'Long Range', children: `${formatDuration(presets.longMin)} - ${formatDuration(presets.longMax)}` },
          ]
        : [];

    // 7. Features (Hardware Tab)
    const getFeatureTagInfo = (feature: DeviceFeature) => {
        switch (feature) {
            case 'footPedal':
                return { label: 'Foot Pedal', icon: <UsbOutlined /> };
            case 'startCountdown':
                return { label: 'Auto Countdown', icon: <ClockCircleOutlined /> };
            case 'statusLed':
                return { label: 'Status LED', icon: <BulbOutlined /> };
            default:
                return { label: feature, icon: <CheckCircleOutlined /> };
        }
    };

    // Enabled Channels
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

    // =========================================================================
    // SECTION: TABS CONFIGURATION
    // =========================================================================

    const tabItems = [
        // --- TAB 1: DASHBOARD ---
        {
            key: 'dashboard',
            label: (
                <Space>
                    <DashboardOutlined /> Dashboard
                </Space>
            ),
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card size="small" title="Device Status">
                        <Descriptions bordered items={identityItems} size="small" column={2} labelStyle={descriptionLabelStyle} />
                    </Card>
                    <Card size="small" title="Session Statistics">
                        <Descriptions bordered items={sessionStatItems} size="small" column={2} labelStyle={descriptionLabelStyle} />
                    </Card>
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Build: {activeDevice?.identity?.buildDate} {activeDevice?.identity?.buildTime}
                        </Text>
                    </div>
                </Space>
            ),
        },

        // --- TAB 2: WI-FI ---
        {
            key: 'wifi',
            label: (
                <Space>
                    <WifiOutlined /> Wi-Fi
                </Space>
            ),
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Card
                        size="small"
                        title={
                            <Space>
                                <GlobalOutlined /> Current Connection
                            </Space>
                        }
                    >
                        <Descriptions bordered items={networkItems} size="small" column={2} labelStyle={descriptionLabelStyle} />
                    </Card>
                    <Card title="Update Credentials" size="small">
                        <Spin spinning={isUpdatingWifi}>
                            <Form form={form} layout="vertical" onFinish={handleWifiUpdate}>
                                <Alert
                                    message="Reboot Required"
                                    description="The device must be rebooted after saving for new credentials to take effect."
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
                                <Form.Item name="ssid" label="SSID" rules={[{ required: true, message: 'SSID is required' }]}>
                                    <Input prefix={<WifiOutlined />} placeholder="Network Name" />
                                </Form.Item>
                                <Form.Item name="pass" label="Password" rules={[{ required: true, message: 'Password is required' }]}>
                                    <Input.Password placeholder="Network Password" />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                                    <Button type="primary" htmlType="submit" loading={isUpdatingWifi} disabled={currentState !== 'READY'}>
                                        Save Credentials
                                    </Button>
                                </Form.Item>
                            </Form>
                        </Spin>
                    </Card>
                </Space>
            ),
        },

        // --- TAB 3: RULES (Deterrents & Presets) ---
        {
            key: 'rules',
            label: (
                <Space>
                    <SafetyCertificateOutlined /> Rules
                </Space>
            ),
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card size="small" title="Deterrent Configuration">
                        <Descriptions
                            bordered
                            items={streakItems}
                            size="small"
                            column={1}
                            style={{ marginBottom: 16 }}
                            labelStyle={descriptionLabelStyle}
                        />

                        <Divider orientation="left" plain style={{ fontSize: '12px', margin: '8px 0' }}>
                            Reward Code
                        </Divider>
                        <Descriptions bordered items={rewardItems} size="small" column={1} labelStyle={descriptionLabelStyle} />

                        <Divider orientation="left" plain style={{ fontSize: '12px', margin: '16px 0 8px 0' }}>
                            Debt Payback
                        </Divider>
                        <Descriptions bordered items={paybackItems} size="small" column={1} labelStyle={descriptionLabelStyle} />
                    </Card>

                    <Card size="small" title="Session Timing Presets">
                        <Descriptions bordered items={limitItems} size="small" column={1} labelStyle={descriptionLabelStyle} />
                        <Divider orientation="left" style={{ margin: '16px 0 8px 0', fontSize: '12px' }} plain>
                            Randomization Ranges
                        </Divider>
                        <Descriptions bordered items={rangeItems} size="small" column={1} labelStyle={descriptionLabelStyle} />
                    </Card>
                </Space>
            ),
        },

        // --- TAB 4: HARDWARE ---
        {
            key: 'hardware',
            label: (
                <Space>
                    <ToolOutlined /> Hardware
                </Space>
            ),
            children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card size="small" title="Physical Configuration">
                        <Descriptions bordered size="small" column={1} labelStyle={descriptionLabelStyle}>
                            <Descriptions.Item label="Enabled Channels">{enabledChannelsString}</Descriptions.Item>
                        </Descriptions>
                        <Divider style={{ margin: '12px 0' }} orientation="left" plain>
                            Detected Features
                        </Divider>
                        <Space wrap>
                            {activeDevice?.features && activeDevice.features.length > 0 ? (
                                activeDevice.features.map((feature) => {
                                    const { label, icon } = getFeatureTagInfo(feature);
                                    return (
                                        <Tag icon={icon} color="blue" key={feature}>
                                            {label}
                                        </Tag>
                                    );
                                })
                            ) : (
                                <Text type="secondary">No features detected</Text>
                            )}
                        </Space>
                    </Card>
                    <Card size="small" title="System Defaults">
                        <Descriptions bordered items={systemItems} size="small" column={2} labelStyle={descriptionLabelStyle} />
                    </Card>
                </Space>
            ),
        },

        // --- TAB 5: ADVANCED (Danger Zone) ---
        {
            key: 'advanced',
            label: (
                <Space>
                    <WarningOutlined /> Advanced
                </Space>
            ),
            children: (
                <Card
                    title={
                        <Space>
                            <WarningOutlined style={{ color: token.colorError }} /> Danger Zone
                        </Space>
                    }
                    size="small"
                    style={{ borderColor: token.colorErrorBorder }}
                    headStyle={{ backgroundColor: token.colorErrorBg, color: token.colorError }}
                >
                    <Row justify="space-between" align="middle">
                        <Col span={16}>
                            <Title level={5} style={{ margin: 0, color: token.colorTextHeading }}>
                                Factory Reset
                            </Title>
                            <Text type="secondary">
                                This action is irreversible. It will erase all Wi-Fi settings, session history, streaks, and accumulated
                                debt. The device will return to Provisioning Mode.
                            </Text>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Button
                                type="primary"
                                danger
                                size="large"
                                icon={<UndoOutlined />}
                                onClick={showFactoryResetConfirm}
                                disabled={currentState !== 'READY'}
                            >
                                Reset Device
                            </Button>
                        </Col>
                    </Row>
                </Card>
            ),
        },
    ];

    return (
        <>
            {contextHolder}
            <Modal
                title={`Device Settings: ${activeDevice?.identity?.name || activeDevice?.identity?.name || ''}`}
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
                <Tabs defaultActiveKey="dashboard" items={tabItems} />
            </Modal>
        </>
    );
};
