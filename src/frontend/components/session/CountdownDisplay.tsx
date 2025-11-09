import { useSession } from '../../context/useSessionContext';
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
import { secondsRemainingToHuman } from '../../utils/time';

const { Title } = Typography;

/**
 * Renders the countdown display panel.
 * Shows timers for each channel and the main "time to lock".
 */
export const CountdownDisplay = () => {
    const { status, abortSession, channelDelays } = useSession();
    const { token } = antdTheme.useToken();

    if (!status) return <Spin />;

    const delays = channelDelays || [];
    const timeToLock = Math.max(0, ...delays); // Longest delay is the time to lock
    const closedCount = delays.filter((d) => d === 0).length; // Count relays already on

    return (
        <div style={{ padding: '24px 8px', textAlign: 'center' }}>
            <Title level={2}>Session Starting...</Title>
            <Statistic
                title="Main Lock Engages In"
                value={secondsRemainingToHuman(timeToLock)}
                valueStyle={{ fontSize: '3rem', fontFamily: 'monospace' }}
            />
            <Divider />
            <Title level={5}>
                Channel Status ({closedCount} / {delays.length} closed)
            </Title>
            <Row
                gutter={[16, 16]}
                style={{ maxWidth: 400, margin: '16px auto' }}
            >
                {delays.map((delay, index) => (
                    <Col span={12} key={index}>
                        <Card
                            size="small"
                            style={{
                                background:
                                    delay === 0
                                        ? token.colorSuccessBg
                                        : token.colorBgContainer,
                            }}
                        >
                            <Statistic
                                title={`Channel ${index + 1}`}
                                value={delay > 0 ? `${delay}s` : 'CLOSED'}
                                valueStyle={{
                                    fontSize: '1.2rem',
                                    color:
                                        delay === 0
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
