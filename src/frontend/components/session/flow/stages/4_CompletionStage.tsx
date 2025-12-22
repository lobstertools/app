import { Button, Card, Alert, Result, Statistic, Row, Col, Divider, Tag, Space } from 'antd';
import {
    PoweroffOutlined,
    UnlockOutlined,
    WarningOutlined,
    ReloadOutlined,
    FireOutlined,
    ClockCircleOutlined,
    HistoryOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import { gold, red, green } from '@ant-design/colors';
import { useSession } from '../../../../context/useSessionContext';
import { formatSeconds } from '../../../../utils/time';
import { useDeviceManager } from '../../../../context/useDeviceManager';

export const CompletionStage = () => {
    const { activeDevice, rebootDevice } = useDeviceManager();
    const { status } = useSession();
    const enableRewardCode = activeDevice?.deterrentConfig.enableRewardCode ?? false;

    // 1. Determine Context & Config
    const isAborted = status?.outcome === 'ABORTED';
    const detConfig = activeDevice?.deterrentConfig;

    // Feature Flags
    const showStreaks = detConfig?.enableStreaks ?? false;
    const showPayback = detConfig?.enablePaybackTime ?? false;

    // 2. Data Points
    const duration = isAborted ? 0 : status?.timers?.lockDuration || 0;
    const debtServed = isAborted ? 0 : status?.timers?.potentialDebtServed || 0;
    const debtRemaining = status?.stats?.paybackAccumulated || 0;
    const streakCount = status?.stats?.streaks || 0;

    // 3. UI Theme Configuration
    // If it was aborted, we show a Warning outcome, but the text needs to be specific.
    const resultStatus = isAborted ? 'warning' : 'success';
    const mainIcon = isAborted ? <WarningOutlined /> : <UnlockOutlined />;

    // Corrected Text Logic
    const mainTitle = isAborted ? 'Session Aborted' : 'Session Complete';
    const subTitle = isAborted
        ? 'The session was terminated early. Any penalties have been applied.'
        : 'Congratulations! You have successfully completed your session.';

    return (
        <Card variant="borderless" style={{ background: 'transparent' }}>
            {/* A. Main Outcome Header */}
            <Result status={resultStatus} icon={mainIcon} title={mainTitle} subTitle={subTitle} style={{ padding: '0 0 24px 0' }} />

            <Divider style={{ margin: '0 0 24px 0' }} />

            {/* C. Session Statistics Grid */}
            <Row gutter={[16, 16]}>
                {/* 1. Standard Stats */}
                <Col span={showPayback ? 12 : 24}>
                    <Card
                        size="small"
                        title={
                            <Space>
                                <ClockCircleOutlined />
                                <span>Session Stats</span>
                            </Space>
                        }
                        // Added height: 100% to match the Debt Report card
                        style={{ height: '100%' }}
                    >
                        <Statistic title="Total Locked Time" value={formatSeconds(duration)} valueStyle={{ fontSize: '1.2rem' }} />
                        {showStreaks && (
                            <div style={{ marginTop: 16 }}>
                                <Statistic
                                    title="Current Streak"
                                    value={streakCount}
                                    prefix={<FireOutlined style={{ color: gold[5] }} />}
                                    valueStyle={{ fontSize: '1.2rem' }}
                                />
                            </div>
                        )}
                    </Card>
                </Col>

                {/* 2. Payback / Debt Stats (Conditional) */}
                {showPayback && (
                    <Col span={12}>
                        <Card
                            size="small"
                            title={
                                <Space>
                                    <HistoryOutlined />
                                    <span>Debt Report</span>
                                </Space>
                            }
                            style={{ height: '100%' }}
                        >
                            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                                {/* Debt Paid Off */}
                                <Statistic
                                    title="Debt Paid Off"
                                    value={formatSeconds(debtServed)}
                                    valueStyle={{ color: green[6], fontSize: '1.2rem' }}
                                    prefix={debtServed > 0 ? <SafetyCertificateOutlined /> : null}
                                />

                                {/* Remaining Debt (Warning) */}
                                {debtRemaining > 0 ? (
                                    <Statistic
                                        title={isAborted ? 'New Total Debt' : 'Remaining Debt'}
                                        value={formatSeconds(debtRemaining)}
                                        valueStyle={{ color: red[5], fontSize: '1.2rem' }}
                                        prefix={<WarningOutlined />}
                                    />
                                ) : (
                                    <div style={{ marginTop: 8 }}>
                                        <Tag color="success">NO DEBT REMAINING</Tag>
                                    </div>
                                )}
                            </Space>
                        </Card>
                    </Col>
                )}
            </Row>

            {/* D. Abort Context (If applicable) */}
            {isAborted && showPayback && (
                <Alert
                    message="Debt Incurred"
                    description="Because this session was aborted, your accrued debt has increased. This time will be added to your next session."
                    type="warning"
                    showIcon
                    style={{ marginTop: 24 }}
                />
            )}

            {/* E. Reboot Action Footer */}
            <div style={{ marginTop: 32 }}>
                <Alert
                    message="Reboot Required"
                    description={
                        enableRewardCode
                            ? 'Power cycle the device to generate a new reward code for the next session.'
                            : 'Power cycle the device to reset for the next session.'
                    }
                    type="info"
                    showIcon
                    icon={<PoweroffOutlined />}
                />

                {/* Button moved outside the Alert */}
                <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    size="large"
                    onClick={() => activeDevice?.id && rebootDevice(activeDevice.id)}
                    style={{ marginTop: 16, width: '100%' }}
                >
                    Reboot Now
                </Button>
            </div>
        </Card>
    );
};
