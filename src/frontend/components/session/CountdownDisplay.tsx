import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import { Typography, Button, Card, Spin, Divider, Row, Col, Statistic, theme as antdTheme } from 'antd';
import { ThunderboltOutlined, FieldTimeOutlined } from '@ant-design/icons';
import { formatSeconds } from '../../utils/time';

const { Title, Text } = Typography;

/**
 * Renders the "ARMED" state display panel.
 *
 * Adapts based on the active strategy:
 * 1. Auto Countdown: Shows timers for each channel.
 * 2. Button Trigger: Shows instructions to press the physical button + timeout.
 */
export const CountdownDisplay = () => {
    const { status, abortSession } = useSession();
    const { activeDevice } = useDeviceManager();
    const { token } = antdTheme.useToken();

    if (!status || !activeDevice) return <Spin />;

    const isManualTrigger = status.triggerStrategy === 'buttonTrigger';

    // --- RENDER: Manual Trigger View ---
    if (isManualTrigger) {
        const timeout = status.triggerTimeoutRemainingSeconds ?? 0;

        return (
            <div style={{ padding: '24px 8px', textAlign: 'center' }}>
                <ThunderboltOutlined
                    style={{
                        fontSize: 48,
                        color: token.colorPrimary,
                        marginBottom: 16,
                    }}
                />
                <Title level={2} style={{ marginTop: 0 }}>
                    Waiting for Trigger
                </Title>
                <Text type="secondary" style={{ fontSize: '1.1rem' }}>
                    Double-click the button on the device to start the session.
                </Text>

                <Divider />

                <Statistic
                    title="Request Timeout"
                    value={formatSeconds(timeout)}
                    valueStyle={{ fontSize: '2.5rem', fontFamily: 'monospace' }}
                    prefix={<FieldTimeOutlined />}
                />

                <Divider />

                <Button danger onClick={abortSession} size="large" style={{ width: '100%' }}>
                    Cancel Arming
                </Button>
            </div>
        );
    }

    // --- RENDER: Auto Countdown View ---

    // Extract individual channel delays from status object
    // Only render channels that are physically enabled in the device config
    const activeDelays = [];

    const delays = status.channelDelaysRemainingSeconds || {};

    if (activeDevice.channels.ch1) {
        activeDelays.push({ id: 1, val: delays.ch1 ?? 0 });
    }
    if (activeDevice.channels.ch2) {
        activeDelays.push({ id: 2, val: delays.ch2 ?? 0 });
    }
    if (activeDevice.channels.ch3) {
        activeDelays.push({ id: 3, val: delays.ch3 ?? 0 });
    }
    if (activeDevice.channels.ch4) {
        activeDelays.push({ id: 4, val: delays.ch4 ?? 0 });
    }

    const maxDelay = Math.max(0, ...activeDelays.map((d) => d.val));
    const closedCount = activeDelays.filter((d) => d.val === 0).length;

    return (
        <div style={{ padding: '24px 8px', textAlign: 'center' }}>
            <Title level={2}>Session Starting...</Title>
            <Statistic
                title="All Locks Engage In"
                value={formatSeconds(maxDelay)}
                valueStyle={{ fontSize: '3rem', fontFamily: 'monospace' }}
            />
            <Divider />
            <Title level={5}>Channel Status ({closedCount} Closed)</Title>
            <Row gutter={[16, 16]} style={{ maxWidth: 400, margin: '16px auto' }}>
                {activeDelays.map((delay) => (
                    <Col span={12} key={delay.id}>
                        <Card
                            size="small"
                            style={{
                                background: delay.val === 0 ? token.colorSuccessBg : token.colorBgContainer,
                            }}
                        >
                            <Statistic
                                title={`Ch ${delay.id}`}
                                value={delay.val > 0 ? `${delay.val}s` : 'CLOSED'}
                                valueStyle={{
                                    fontSize: '1.2rem',
                                    color: delay.val === 0 ? token.colorSuccess : token.colorText,
                                }}
                            />
                        </Card>
                    </Col>
                ))}
            </Row>
            <Divider />
            <Button danger onClick={abortSession} size="large" style={{ width: '100%' }}>
                Cancel Start (No Penalty)
            </Button>
        </div>
    );
};
