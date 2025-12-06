import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import { Typography, Button, Card, Spin, Divider, Row, Col, Statistic, Descriptions, Tag, Space, theme as antdTheme } from 'antd';
import { ThunderboltOutlined, FieldTimeOutlined, EyeInvisibleOutlined, HistoryOutlined } from '@ant-design/icons';
import { formatSeconds } from '../../utils/time';
import { useMemo } from 'react';
import { PressProgressBar } from '../device/PressProgressBar';

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

    // Helper: Determine if we are in Debug/Seconds or Release/Minutes mode
    const isDebugMode = useMemo(() => {
        return activeDevice?.buildType === 'debug' || activeDevice?.buildType === 'mock';
    }, [activeDevice?.buildType]);

    const unitLabel = isDebugMode ? 'sec' : 'min';

    // Helper: Safely access the active configuration from the status
    // This allows the component to know "What did I just arm?"
    const activeConfig = useMemo(() => status?.config, [status]);

    // --- Early Return ---
    if (!status || !activeDevice) return <Spin />;

    // Use the strategy from the active config (or fallback to status for robustness)
    const isManualTrigger = activeConfig?.triggerStrategy === 'buttonTrigger';

    // --- HELPER: Configuration Summary ---
    const renderConfigSummary = () => {
        const lockDurationTotal = status.lockDuration || 0;
        const accruedDebtSeconds = status.stats?.pendingPayback || 0;
        const enablePayback = activeDevice?.deterrents?.enablePaybackTime || false;
        const abortCostSeconds = activeDevice?.deterrents?.paybackDuration || 0;
        const enableRewardCode = activeDevice?.deterrents?.enableRewardCode ?? true;
        const penaltyDurationSeconds = activeDevice?.deterrents?.rewardPenaltyDuration || 0;

        // --- Duration Display Logic ---
        let durationDisplay = <Text strong>{formatSeconds(lockDurationTotal)}</Text>;
        let durationLabel = 'Total Duration';

        if (activeConfig) {
            const { durationType, durationMin, durationMax } = activeConfig;

            if (durationType === 'fixed') {
                durationDisplay = <Text strong>{formatSeconds(lockDurationTotal)}</Text>;
            } else {
                durationLabel = 'Duration Range';
                const minDisplay = isDebugMode ? durationMin : Math.floor((durationMin || 0) / 60);
                const maxDisplay = isDebugMode ? durationMax : Math.floor((durationMax || 0) / 60);

                durationDisplay = (
                    <Space direction="vertical" size={0}>
                        <Text strong>
                            {minDisplay} - {maxDisplay} {unitLabel}
                        </Text>
                        <Tag color="purple" style={{ marginTop: 4 }}>
                            <EyeInvisibleOutlined /> {durationType.toUpperCase()}
                        </Tag>
                    </Space>
                );
            }
        }

        let penaltyDisplay = <Text>{formatSeconds(penaltyDurationSeconds)}</Text>;
        if (!isDebugMode) {
            penaltyDisplay = (
                <span>
                    {Math.floor(penaltyDurationSeconds / 60)} {unitLabel}
                </span>
            );
        }

        return (
            <Card
                size="small"
                style={{
                    marginTop: 24,
                    marginBottom: 16,
                    textAlign: 'left',
                    background: token.colorFillAlter,
                    borderColor: token.colorBorderSecondary,
                }}
            >
                <Descriptions
                    title="Session Summary"
                    size="small"
                    column={1}
                    bordered
                    styles={{ label: { width: '140px', verticalAlign: 'top' } }}
                >
                    {/* DURATION + ACCRUED DEBT */}
                    <Descriptions.Item label={durationLabel}>
                        <Space direction="vertical" size={0}>
                            {durationDisplay}
                            {accruedDebtSeconds > 0 && (
                                <Text type="danger" style={{ fontSize: '0.85em', marginTop: 4 }}>
                                    <HistoryOutlined style={{ marginRight: 4 }} />+ {formatSeconds(accruedDebtSeconds)} (Accrued Debt)
                                </Text>
                            )}
                        </Space>
                    </Descriptions.Item>

                    {/* IMMEDIATE PENALTY (Only if Reward Code is Enabled) */}
                    {enableRewardCode && (
                        <Descriptions.Item label="Abort Penalty">
                            <Text strong>{penaltyDisplay}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                                Cooldown before revealing the reward code if session is aborted.
                            </Text>
                        </Descriptions.Item>
                    )}

                    {/* FUTURE ABORT COST (Risk) */}
                    {enablePayback && (
                        <Descriptions.Item
                            label={
                                <Space size={4}>
                                    <Text type="danger">Abort Cost</Text>
                                </Space>
                            }
                        >
                            <Text type="danger" strong>
                                +{formatSeconds(abortCostSeconds)}
                            </Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: '0.75rem' }}>
                                Future payback time if you abort <b>during the session</b>.
                            </Text>
                        </Descriptions.Item>
                    )}
                </Descriptions>
            </Card>
        );
    };

    // --- RENDER: Manual Trigger View ---
    if (isManualTrigger) {
        const timeout = status.timers.triggerTimeout ?? 0;

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

                {renderConfigSummary()}

                {/* Progress Bar for Manual Abort */}
                <div style={{ marginBottom: 12, textAlign: 'left' }}>
                    <PressProgressBar />
                </div>

                <Button danger onClick={abortSession} size="large" style={{ width: '100%' }}>
                    Cancel Arming
                </Button>
            </div>
        );
    }

    // --- RENDER: Auto Countdown View ---
    const activeDelays: { id: number; val: number }[] = [];
    const delays = status.channelDelaysRemaining || {};

    if (activeDevice.channels.ch1) activeDelays.push({ id: 1, val: delays.ch1 ?? 0 });
    if (activeDevice.channels.ch2) activeDelays.push({ id: 2, val: delays.ch2 ?? 0 });
    if (activeDevice.channels.ch3) activeDelays.push({ id: 3, val: delays.ch3 ?? 0 });
    if (activeDevice.channels.ch4) activeDelays.push({ id: 4, val: delays.ch4 ?? 0 });

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

            {renderConfigSummary()}

            {/* Progress Bar for Manual Abort */}
            <div style={{ marginBottom: 12, textAlign: 'left' }}>
                <PressProgressBar />
            </div>

            <Button danger onClick={abortSession} size="large" style={{ width: '100%' }}>
                Cancel Start
            </Button>
        </div>
    );
};
