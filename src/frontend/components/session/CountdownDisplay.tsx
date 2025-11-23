import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import {
    Typography,
    Button,
    Card,
    Spin,
    Divider,
    Row,
    Col,
    Statistic,
    theme as antdTheme,
} from 'antd';
import { formatSeconds } from '../../utils/time';

const { Title } = Typography;

/**
 * Renders the countdown display panel.
 * Shows timers for each channel and the main "time to lock".
 */
export const CountdownDisplay = () => {
    const { status, abortSession } = useSession();
    const { activeDevice } = useDeviceManager();
    const { token } = antdTheme.useToken();

    if (!status || !activeDevice) return <Spin />;

    // Extract individual channel delays from status object
    // Only render channels that are physically enabled in the device config
    const activeDelays = [];

    if (activeDevice.channels.ch1) {
        activeDelays.push({ id: 1, val: status.delays?.ch1 ?? 0 });
    }
    if (activeDevice.channels.ch2) {
        activeDelays.push({ id: 2, val: status.delays?.ch2 ?? 0 });
    }
    if (activeDevice.channels.ch3) {
        activeDelays.push({ id: 3, val: status.delays?.ch3 ?? 0 });
    }
    if (activeDevice.channels.ch4) {
        activeDelays.push({ id: 4, val: status.delays?.ch4 ?? 0 });
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
            <Row
                gutter={[16, 16]}
                style={{ maxWidth: 400, margin: '16px auto' }}
            >
                {activeDelays.map((delay) => (
                    <Col span={12} key={delay.id}>
                        <Card
                            size="small"
                            style={{
                                background:
                                    delay.val === 0
                                        ? token.colorSuccessBg
                                        : token.colorBgContainer,
                            }}
                        >
                            <Statistic
                                title={`Ch ${delay.id}`}
                                value={
                                    delay.val > 0 ? `${delay.val}s` : 'CLOSED'
                                }
                                valueStyle={{
                                    fontSize: '1.2rem',
                                    color:
                                        delay.val === 0
                                            ? token.colorSuccess
                                            : token.colorText,
                                }}
                            />
                        </Card>
                    </Col>
                ))}
            </Row>
            <Divider />
            <Button
                danger
                onClick={abortSession}
                size="large"
                style={{ width: '100%' }}
            >
                Cancel Start (No Penalty)
            </Button>
        </div>
    );
};
