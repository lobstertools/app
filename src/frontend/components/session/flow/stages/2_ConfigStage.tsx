import { Typography, Button, Card, Space, InputNumber, Form, Divider, Row, Col, Switch, Radio, theme } from 'antd';
import { LockOutlined, ThunderboltOutlined, FieldTimeOutlined, FieldTimeOutlined as TimerIcon } from '@ant-design/icons';
import { red } from '@ant-design/colors';
import { useConfigForm } from '../hooks/useConfigForm';
import { formatSeconds } from '../../../../utils/time';
import { useDeviceManager } from '../../../../context/useDeviceManager';
import { useSession } from '../../../../context/useSessionContext';

const { Title, Text } = Typography;

export const ConfigStage = () => {
    const { token } = theme.useToken();

    const { activeDevice } = useDeviceManager();
    const { status, currentState } = useSession();

    // Logic extracted to hook
    const {
        form,
        isSubmitting,
        handleFinish,
        isManualTrigger,
        useMultiDelay,
        isDebugMode,
        unitLabel,
        minLockUnit,
        maxLockUnit,
        presetValues,
        defaultValues,
    } = useConfigForm();

    // --- Derived UI Helpers ---
    const supportsManualTrigger = activeDevice?.features?.includes('footPedal') ?? false;
    const supportsStatusLed = activeDevice?.features?.includes('statusLed') ?? false;

    // Channel Helpers
    const enabledChannels = [];
    if (activeDevice?.channels?.ch1) enabledChannels.push({ key: 'delayCh1', label: 'MagLock 1' });
    if (activeDevice?.channels?.ch2) enabledChannels.push({ key: 'delayCh2', label: 'MagLock 2' });
    if (activeDevice?.channels?.ch3) enabledChannels.push({ key: 'delayCh3', label: 'MagLock 3' });
    if (activeDevice?.channels?.ch4) enabledChannels.push({ key: 'delayCh4', label: 'MagLock 4' });
    const canUseMultiChannel = enabledChannels.length > 1;

    // Debt/Payback Display Logic
    const pendingPaybackSeconds = status?.stats?.paybackAccumulated || 0;
    const detConfig = activeDevice?.deterrentConfig;
    const paybackTimeEnabled = detConfig?.enablePaybackTime || false;

    // (Note: To strictly preserve logic, we recalculate display values here or move to hook. Keeping here for UI focus)
    const paybackFixed = Math.floor((detConfig?.paybackTime || 0) / (isDebugMode ? 1 : 60));
    const paybackMin = Math.floor((detConfig?.paybackTimeMin || 0) / (isDebugMode ? 1 : 60));
    const paybackMax = Math.floor((detConfig?.paybackTimeMax || 0) / (isDebugMode ? 1 : 60));
    const isRandomPayback = detConfig?.paybackTimeStrategy === 'DETERRENT_RANDOM';

    let paybackDescription: React.ReactNode = '';
    let paybackValueDisplay = '';

    if (isRandomPayback) {
        paybackDescription = (
            <>
                <Text strong>{paybackMin}</Text> and <Text strong>{paybackMax}</Text> <Text strong>{unitLabel}</Text> to your next session.
            </>
        );
        paybackValueDisplay = `+${paybackMin}-${paybackMax} ${unitLabel}`;
    } else {
        const unitSuffix = paybackFixed !== 1 ? unitLabel + 's' : unitLabel;
        paybackDescription = (
            <>
                <Text strong>
                    {paybackFixed} {unitSuffix}
                </Text>{' '}
                to your next session.
            </>
        );
        paybackValueDisplay = `+${paybackFixed} ${unitLabel}`;
    }

    return (
        <Form
            form={form}
            onFinish={handleFinish}
            layout="vertical"
            initialValues={{
                triggerStrategy: 'STRAT_BUTTON_TRIGGER',
                type: 'time-range',
                timeRangeSelection: 'short',
                duration: defaultValues.duration,
                rangeMin: defaultValues.rangeMin,
                rangeMax: defaultValues.rangeMax,
                hideTimer: false,
                disableLED: false,
                useMultiChannelDelay: false,
                delayCh1: 10,
                delayCh2: 10,
                delayCh3: 10,
                delayCh4: 10,
            }}
        >
            {/* --- 1. SESSION DURATION --- */}
            <Space direction="vertical" style={{ width: '100%' }}>
                <Title level={5}>1. Session Duration</Title>
                <Text type="secondary" style={{ marginTop: -8 }}>
                    {isDebugMode ? 'Development Mode: Times are in SECONDS.' : 'Choose how long the device stays locked.'}
                </Text>

                <Form.Item name="type" label="Duration Mode" style={{ marginBottom: 8 }}>
                    <Radio.Group buttonStyle="solid">
                        <Radio.Button value="time-range">Time Range</Radio.Button>
                        <Radio.Button value="fixed">Fixed</Radio.Button>
                        <Radio.Button value="random">Random</Radio.Button>
                    </Radio.Group>
                </Form.Item>

                <Form.Item noStyle dependencies={['type']}>
                    {({ getFieldValue }) => {
                        const type = getFieldValue('type');

                        if (type === 'time-range') {
                            return (
                                <Form.Item name="timeRangeSelection" label="Select a Range">
                                    <Radio.Group buttonStyle="solid">
                                        <Radio.Button value="short">
                                            Short: {presetValues.shortMin}-{presetValues.shortMax} {unitLabel}
                                        </Radio.Button>
                                        <Radio.Button value="medium">
                                            Medium: {presetValues.mediumMin}-{presetValues.mediumMax} {unitLabel}
                                        </Radio.Button>
                                        <Radio.Button value="long">
                                            Long: {presetValues.longMin}-{presetValues.longMax} {unitLabel}
                                        </Radio.Button>
                                    </Radio.Group>
                                </Form.Item>
                            );
                        }
                        if (type === 'fixed') {
                            return (
                                <Form.Item label={`Fixed Duration (${minLockUnit}-${maxLockUnit} ${unitLabel})`}>
                                    <Space.Compact>
                                        <Form.Item name="duration" noStyle>
                                            <InputNumber min={minLockUnit} max={maxLockUnit} style={{ width: 200 }} />
                                        </Form.Item>
                                        <Button disabled style={{ pointerEvents: 'none' }}>
                                            {unitLabel}
                                        </Button>
                                    </Space.Compact>
                                </Form.Item>
                            );
                        }
                        if (type === 'random') {
                            return (
                                <Space align="start">
                                    <Form.Item label={`Minimum (${unitLabel})`}>
                                        <Space.Compact>
                                            <Form.Item name="rangeMin" noStyle>
                                                <InputNumber min={minLockUnit} max={maxLockUnit} />
                                            </Form.Item>
                                            <Button disabled>{unitLabel}</Button>
                                        </Space.Compact>
                                    </Form.Item>
                                    <Form.Item label={`Maximum (${unitLabel})`}>
                                        <Space.Compact>
                                            <Form.Item name="rangeMax" noStyle>
                                                <InputNumber min={minLockUnit} max={maxLockUnit} />
                                            </Form.Item>
                                            <Button disabled>{unitLabel}</Button>
                                        </Space.Compact>
                                    </Form.Item>
                                </Space>
                            );
                        }
                        return null;
                    }}
                </Form.Item>

                {paybackTimeEnabled && pendingPaybackSeconds > 0 && (
                    <Card size="small" style={{ marginTop: 12, borderColor: red[5], borderWidth: 1 }}>
                        <Row justify="space-between" align="middle">
                            <Col span={18}>
                                <Space direction="vertical" size={0}>
                                    <Text type="danger" strong>
                                        <FieldTimeOutlined style={{ marginRight: 8 }} />
                                        Pending Payback
                                    </Text>
                                    <Text type="secondary">You have accrued time debt which will be added to this session.</Text>
                                </Space>
                            </Col>
                            <Col span={6} style={{ textAlign: 'right' }}>
                                <Text type="danger" strong style={{ fontSize: '1.2em' }}>
                                    +{formatSeconds(pendingPaybackSeconds)}
                                </Text>
                            </Col>
                        </Row>
                    </Card>
                )}
            </Space>

            <Divider />

            {/* --- 2. TRIGGER --- */}
            <Space direction="vertical" style={{ width: '100%' }}>
                <Title level={5}>2. Start Configuration</Title>
                <Text type="secondary" style={{ marginTop: -8 }}>
                    {isManualTrigger
                        ? 'The session will start after you double-click the device button.'
                        : 'Configure the countdown before the session starts automatically.'}
                </Text>

                {supportsManualTrigger && (
                    <Form.Item name="triggerStrategy" style={{ marginBottom: 12, marginTop: 8 }}>
                        <Radio.Group buttonStyle="solid" block>
                            <Radio.Button value="STRAT_BUTTON_TRIGGER" style={{ width: '50%', textAlign: 'center' }}>
                                <ThunderboltOutlined /> Device Button
                            </Radio.Button>
                            <Radio.Button value="STRAT_AUTO_COUNTDOWN" style={{ width: '50%', textAlign: 'center' }}>
                                <TimerIcon /> Automatic Timer
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                )}

                {!isManualTrigger && (
                    <div style={{ paddingLeft: 12, borderLeft: `2px solid ${token.colorBorderSecondary}` }}>
                        {canUseMultiChannel && (
                            <Form.Item
                                name="useMultiChannelDelay"
                                label="Countdown Mode"
                                valuePropName="checked"
                                style={{ marginBottom: 8 }}
                            >
                                <Switch checkedChildren="Per-MagLock" unCheckedChildren="Unified" />
                            </Form.Item>
                        )}
                        {!useMultiDelay && (
                            <>
                                <Form.Item label="Countdown Duration (sec)" style={{ marginBottom: 4 }}>
                                    <Space.Compact>
                                        <Form.Item name="delayCh1" noStyle>
                                            <InputNumber min={0} max={120} style={{ width: 200 }} />
                                        </Form.Item>
                                        <Button disabled style={{ pointerEvents: 'none' }}>
                                            sec
                                        </Button>
                                    </Space.Compact>
                                </Form.Item>
                                <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                    {canUseMultiChannel
                                        ? 'All enabled MagLocks will activate after this time.'
                                        : 'Time before the lock engages.'}
                                </Text>
                            </>
                        )}
                        {useMultiDelay && (
                            <>
                                <Row gutter={[16, 0]}>
                                    {enabledChannels.map((ch) => (
                                        <Col xs={24} sm={12} key={ch.key}>
                                            <Form.Item label={`${ch.label} Timer (sec)`} style={{ marginBottom: 12 }}>
                                                <Space.Compact style={{ width: '100%' }}>
                                                    <Form.Item name={ch.key} noStyle>
                                                        <InputNumber min={0} max={120} style={{ width: 'calc(100% - 46px)' }} />
                                                    </Form.Item>
                                                    <Button disabled style={{ pointerEvents: 'none' }}>
                                                        sec
                                                    </Button>
                                                </Space.Compact>
                                            </Form.Item>
                                        </Col>
                                    ))}
                                </Row>
                                <Text type="secondary" style={{ fontSize: '0.85em' }}>
                                    Set independent times for each MagLock.
                                </Text>
                            </>
                        )}
                    </div>
                )}
            </Space>

            <Divider />

            {/* --- 3. TENSION --- */}
            <Space direction="vertical" style={{ width: '100%' }}>
                <Title level={5}>3. Tension Mode</Title>
                <Text type="secondary" style={{ marginTop: -8 }}>
                    Restrict device feedback for an extra challenge.
                </Text>
                <Row gutter={24} style={{ marginTop: 8 }}>
                    <Col span={12}>
                        <Space>
                            <Text>Hide Timer</Text>
                            <Form.Item name="hideTimer" valuePropName="checked" noStyle>
                                <Switch />
                            </Form.Item>
                        </Space>
                    </Col>
                    {supportsStatusLed && (
                        <Col span={12}>
                            <Space>
                                <Text>Disable LED</Text>
                                <Form.Item name="disableLED" valuePropName="checked" noStyle>
                                    <Switch />
                                </Form.Item>
                            </Space>
                        </Col>
                    )}
                </Row>
            </Space>

            {paybackTimeEnabled && (
                <Card size="small" style={{ marginTop: 24, marginBottom: 8 }}>
                    <Row justify="space-between" align="middle">
                        <Col span={18}>
                            <Space direction="vertical" size={0}>
                                <Text strong>
                                    <FieldTimeOutlined style={{ marginRight: 8 }} />
                                    Time Payback Enabled
                                </Text>
                                <Text type="secondary">Aborting will add {paybackDescription}</Text>
                            </Space>
                        </Col>
                        <Col span={6} style={{ textAlign: 'right' }}>
                            <Text strong type="warning" style={{ fontSize: '1.2em' }}>
                                {paybackValueDisplay}
                            </Text>
                        </Col>
                    </Row>
                </Card>
            )}

            <Button
                type="primary"
                icon={isManualTrigger ? <ThunderboltOutlined /> : <LockOutlined />}
                htmlType="submit"
                size="large"
                loading={isSubmitting || currentState === 'TESTING'}
                disabled={currentState !== 'READY'}
                style={{ width: '100%', marginTop: paybackTimeEnabled ? 0 : 24 }}
            >
                {isSubmitting
                    ? 'Arming Device...'
                    : currentState === 'READY'
                      ? isManualTrigger
                          ? 'Arm Device (Wait for Button)'
                          : 'Start Countdown'
                      : currentState === 'TESTING'
                        ? 'Testing Hardware...'
                        : 'Device Not Ready'}
            </Button>
        </Form>
    );
};
