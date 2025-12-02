import {
    Modal,
    Button,
    Typography,
    Statistic,
    Space,
    Row,
    Col,
    Card,
    Descriptions,
    Tag,
    Progress,
    Divider,
} from 'antd';
import {
    ThunderboltOutlined,
    WifiOutlined,
    DashboardOutlined,
    SafetyCertificateOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons';
import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import { formatSeconds } from '../../utils/time';

const { Text } = Typography;

export const TestSessionModal = () => {
    const { currentState, sessionTimeRemaining, abortSession, status } = useSession();
    const { activeDevice } = useDeviceManager();

    // The modal is only visible when the state is specifically 'testing'
    const isOpen = currentState === 'testing';
    const hw = status?.hardwareStatus;

    // --- Logic for Button State ---
    // Use the static config from Device Details, defaulting to 3000ms if not yet loaded
    const longPressThresholdMs = activeDevice?.longPressMs || 3000;
    const currentPressMs = hw?.currentPressDurationMs || 0;
    const isPressed = hw?.buttonPressed || false;
    const isLongPress = isPressed && currentPressMs >= longPressThresholdMs;

    // Helper to calculate signal strength percentage from RSSI (approximate)
    const getSignalPercent = (rssi: number) => {
        if (rssi >= -50) return 100;
        if (rssi <= -90) return 0;
        return Math.round(((rssi + 90) / 40) * 100);
    };

    const getSignalColor = (rssi: number) => {
        if (rssi >= -60) return '#52c41a'; // Green
        if (rssi >= -75) return '#faad14'; // Yellow
        return '#ff4d4f'; // Red
    };

    // Helper to convert camelCase to Human Readable
    const toHumanReadable = (str: string) => {
        if (str === 'statusLed') return 'Status LED';
        const result = str.replace(/([A-Z])/g, ' $1');
        return result.charAt(0).toUpperCase() + result.slice(1);
    };

    // Helper for Button Tag Visuals
    const getButtonTag = () => {
        if (!isPressed) {
            return <Tag color="default">RELEASED</Tag>;
        }
        if (isLongPress) {
            return <Tag color="green">LONG PRESS</Tag>;
        }
        return <Tag color="processing">HOLDING...</Tag>;
    };

    return (
        <Modal
            open={isOpen}
            footer={null}
            closable={false}
            maskClosable={false}
            centered
            width={840}
            title={
                <Space>
                    <DashboardOutlined />
                    <span>Hardware Diagnostics</span>
                </Space>
            }
        >
            <Row gutter={[24, 24]}>
                {/* LEFT COLUMN: Real-time Telemetry & Controls */}
                <Col span={12}>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* 1. Main Timer - Background Removed */}
                        <Card size="small" style={{ textAlign: 'center' }}>
                            <Statistic
                                title="Test Remaining"
                                value={formatSeconds(sessionTimeRemaining)}
                                valueStyle={{
                                    fontSize: '2.5rem',
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold',
                                    color: '#1890ff',
                                }}
                            />
                        </Card>

                        {/* 2. Hardware Telemetry Card */}
                        <Card size="small" title="Live Telemetry">
                            <Space direction="vertical" style={{ width: '100%' }}>
                                {/* Button State */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text>
                                        <ThunderboltOutlined /> Pedal/Button:
                                    </Text>
                                    <div style={{ fontSize: '14px', padding: '4px 0' }}>{getButtonTag()}</div>
                                </div>
                                {isPressed && (
                                    <div style={{ textAlign: 'right' }}>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Duration: {(currentPressMs / 1000).toFixed(1)}s /{' '}
                                            {(longPressThresholdMs / 1000).toFixed(1)}s
                                        </Text>
                                    </div>
                                )}

                                <Divider style={{ margin: '8px 0' }} />

                                {/* Signal Strength */}
                                <div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 4,
                                        }}
                                    >
                                        <Text>
                                            <WifiOutlined /> Signal (RSSI):
                                        </Text>
                                        <Text strong>{hw?.rssi} dBm</Text>
                                    </div>
                                    <Progress
                                        percent={getSignalPercent(hw?.rssi || -90)}
                                        strokeColor={getSignalColor(hw?.rssi || -90)}
                                        showInfo={false}
                                        size="small"
                                    />
                                </div>

                                <Divider style={{ margin: '8px 0' }} />

                                {/* System Vitals */}
                                <Descriptions column={1} size="small" bordered={false}>
                                    <Descriptions.Item label="Free Heap">
                                        <Text code>{((hw?.freeHeap || 0) / 1024).toFixed(1)} KB</Text>
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Uptime">
                                        {formatSeconds(hw?.uptimeSeconds || 0)}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Internal Temp">
                                        {hw?.internalTempC !== 'N/A' ? `${hw?.internalTempC}°C` : 'N/A'}
                                    </Descriptions.Item>
                                </Descriptions>
                            </Space>
                        </Card>

                        {/* 3. Controls */}
                        <Button danger size="large" type="primary" onClick={abortSession} block>
                            Stop Hardware Test
                        </Button>
                        <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center', display: 'block' }}>
                            Or long-press foot pedal to abort
                        </Text>
                    </Space>
                </Col>

                {/* RIGHT COLUMN: Static Device Details */}
                <Col span={12}>
                    <Card
                        size="small"
                        title={
                            <Space>
                                <InfoCircleOutlined />
                                <span>Device Details</span>
                            </Space>
                        }
                        style={{ height: '100%' }}
                    >
                        <Descriptions column={1} size="small" bordered layout="vertical">
                            <Descriptions.Item label="Device Name">
                                <Text strong>{activeDevice?.name}</Text>
                            </Descriptions.Item>

                            <Descriptions.Item label="Firmware Version">
                                <Tag color="blue">{activeDevice?.version || 'Unknown'}</Tag>
                            </Descriptions.Item>

                            <Descriptions.Item label="Build Type">
                                <Tag color={activeDevice?.buildType === 'release' ? 'green' : 'orange'}>
                                    {activeDevice?.buildType?.toUpperCase()}
                                </Tag>
                            </Descriptions.Item>

                            {/* Merged Network Line */}
                            <Descriptions.Item label="Network Interface">
                                <Space split={<Divider type="vertical" />}>
                                    <Text copyable>
                                        {activeDevice?.address}:{activeDevice?.port}
                                    </Text>
                                    <Text copyable>{activeDevice?.mac}</Text>
                                </Space>
                            </Descriptions.Item>

                            {/* Section 1: Hardware Features (Read Only) */}
                            <Descriptions.Item label="Hardware Features">
                                <Space size={[0, 8]} wrap>
                                    {activeDevice?.features.length ? (
                                        activeDevice.features.map((f) => (
                                            <Tag key={f} color="geekblue">
                                                {toHumanReadable(f)}
                                            </Tag>
                                        ))
                                    ) : (
                                        <Text type="secondary">None</Text>
                                    )}
                                </Space>
                            </Descriptions.Item>

                            {/* Section 2: Session Deterrents (Configurable) */}
                            <Descriptions.Item label="Session Deterrents">
                                <Space size={[0, 8]} wrap>
                                    {activeDevice?.deterrents.enableRewardCode && <Tag color="gold">Reward Code</Tag>}
                                    {activeDevice?.deterrents.enableStreaks && <Tag color="purple">Streaks</Tag>}
                                    {activeDevice?.deterrents.enablePaybackTime && <Tag color="red">Payback Time</Tag>}
                                    {!activeDevice?.deterrents.enableRewardCode &&
                                        !activeDevice?.deterrents.enableStreaks &&
                                        !activeDevice?.deterrents.enablePaybackTime && (
                                            <Text type="secondary">None Enabled</Text>
                                        )}
                                </Space>
                            </Descriptions.Item>

                            <Descriptions.Item label="Hardware Channels">
                                <Space size="small">
                                    <Tag color={activeDevice?.channels.ch1 ? 'cyan' : 'default'}>CH1</Tag>
                                    <Tag color={activeDevice?.channels.ch2 ? 'cyan' : 'default'}>CH2</Tag>
                                    <Tag color={activeDevice?.channels.ch3 ? 'cyan' : 'default'}>CH3</Tag>
                                    <Tag color={activeDevice?.channels.ch4 ? 'cyan' : 'default'}>CH4</Tag>
                                </Space>
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: 20, textAlign: 'center' }}>
                            <Space align="center" style={{ color: '#8c8c8c' }}>
                                <SafetyCertificateOutlined style={{ fontSize: '24px' }} />
                                <Text type="secondary">Secure Session</Text>
                            </Space>
                        </div>
                    </Card>
                </Col>
            </Row>
        </Modal>
    );
};
