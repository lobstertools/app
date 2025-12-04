import { red } from '@ant-design/colors';
import {
    Typography,
    Button,
    Card,
    Alert,
    Space,
    Spin,
    InputNumber,
    Form,
    Steps,
    Divider,
    Row,
    Col,
    Switch,
    Statistic,
    List,
    Radio,
    theme as antdTheme,
    App,
} from 'antd';
import {
    LockOutlined,
    PoweroffOutlined,
    UnlockOutlined,
    DesktopOutlined,
    RightOutlined,
    LoadingOutlined,
    CloudOutlined,
    DisconnectOutlined,
    HddOutlined,
    FieldTimeOutlined,
    ThunderboltOutlined,
    FieldTimeOutlined as TimerIcon,
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { formatSeconds } from '../../utils/time';
import { CountdownDisplay } from './CountdownDisplay';
import { useDeviceManager } from '../../context/useDeviceManager';
import { useSession, SessionFormData } from '../../context/useSessionContext';
import { useKeyboard } from '../../context/useKeyboardContext';

const { Title, Text } = Typography;

/**
 * Renders the multi-step wizard for configuring and starting a new session.
 * This is the main control panel for the 'ready' state.
 */
export const SessionConfiguration = () => {
    // Destructure status here so it's available for the render function
    const { currentState, startSession, isLocking, sessionTimeRemaining, status } = useSession();
    const { activeDevice, openDeviceModal } = useDeviceManager();
    const { registerStartConfigAction } = useKeyboard();

    const { notification } = App.useApp();

    const [form] = Form.useForm<SessionFormData>();
    const [setupStep, setSetupStep] = useState(0);
    const [useMultiDelay, setUseMultiDelay] = useState(false);

    // Watch the strategy to update UI text dynamically
    const selectedStrategy = Form.useWatch('triggerStrategy', form);
    const isManualTrigger = selectedStrategy === 'buttonTrigger';

    const { token } = antdTheme.useToken();

    // Check hardware capabilities
    const supportsManualTrigger = useMemo(() => {
        return activeDevice?.features?.includes('footPedal') ?? false;
    }, [activeDevice]);

    // Check deterrent configuration
    const enableRewardCode = activeDevice?.deterrents?.enableRewardCode ?? true;

    // ------------------------------------------------------------------------
    // 1. ADAPTIVE TIME SCALING
    // ------------------------------------------------------------------------

    // Detect if we are in a developer mode where seconds are preferred over minutes
    const isDebugMode = useMemo(() => {
        return activeDevice?.buildType === 'debug' || activeDevice?.buildType === 'mock';
    }, [activeDevice?.buildType]);

    // Define the Time Scale:
    // Debug/Mock -> 1 (Values are in seconds)
    // Release    -> 60 (Values are in minutes)
    const timeScale = isDebugMode ? 1 : 60;
    const unitLabel = isDebugMode ? 'sec' : 'min';

    // ------------------------------------------------------------------------
    // 2. DYNAMIC SYSTEM LIMITS (Scaled to UI Units)
    // ------------------------------------------------------------------------

    const minLockUnit = useMemo(
        () => Math.ceil((activeDevice?.minLockSeconds || 900) / timeScale),
        [activeDevice?.minLockSeconds, timeScale]
    );
    const maxLockUnit = useMemo(
        () => Math.floor((activeDevice?.maxLockSeconds || 10800) / timeScale),
        [activeDevice?.maxLockSeconds, timeScale]
    );

    const minPenaltyUnit = useMemo(
        () => Math.ceil((activeDevice?.minPenaltySeconds || 900) / timeScale),
        [activeDevice?.minPenaltySeconds, timeScale]
    );
    const maxPenaltyUnit = useMemo(
        () => Math.floor((activeDevice?.maxPenaltySeconds || 10800) / timeScale),
        [activeDevice?.maxPenaltySeconds, timeScale]
    );

    /**
     * Helper to ensure value is within device limits
     */
    const clamp = (val: number, min: number, max: number) => {
        return Math.max(min, Math.min(val, max));
    };

    // ------------------------------------------------------------------------
    // 3. SMART DEFAULTS
    // ------------------------------------------------------------------------

    const defaultValues = useMemo(() => {
        // Ideal targets based on Build Type
        // Debug: 15 seconds. Release: 30 minutes.
        const targetDuration = isDebugMode ? 15 : 30;

        // Ranges
        const targetRangeMin = isDebugMode ? 10 : 20;
        const targetRangeMax = isDebugMode ? 60 : 60; // 60s (debug) or 60m (release)

        // Penalty: 15s (debug) or 15m (release)
        const targetPenalty = 15;

        return {
            duration: clamp(targetDuration, minLockUnit, maxLockUnit),
            rangeMin: clamp(targetRangeMin, minLockUnit, maxLockUnit),
            rangeMax: clamp(targetRangeMax, minLockUnit, maxLockUnit),
            penalty: clamp(targetPenalty, minPenaltyUnit, maxPenaltyUnit),
        };
    }, [isDebugMode, minLockUnit, maxLockUnit, minPenaltyUnit, maxPenaltyUnit]);

    // Calculate enabled channels for the UI based on the new API structure
    const enabledChannels = useMemo(() => {
        if (!activeDevice) return [];
        const list = [];
        if (activeDevice.channels.ch1) list.push({ key: 'delayCh1', label: 'MagLock 1' });
        if (activeDevice.channels.ch2) list.push({ key: 'delayCh2', label: 'MagLock 2' });
        if (activeDevice.channels.ch3) list.push({ key: 'delayCh3', label: 'MagLock 3' });
        if (activeDevice.channels.ch4) list.push({ key: 'delayCh4', label: 'MagLock 4' });
        return list;
    }, [activeDevice]);

    const canUseMultiChannel = enabledChannels.length > 1;

    // Reset form when returning to 'ready' state
    useEffect(() => {
        if (currentState === 'ready') {
            setSetupStep(0);
            setUseMultiDelay(false);
            form.resetFields();
        }
    }, [currentState, form]);

    // --- Keyboard Shortcut Registration ---
    useEffect(() => {
        registerStartConfigAction(() => {
            // Logic to determine what 'Start Configuration' (key: s) does based on state
            if (currentState === 'no_device_selected') {
                notification.info({ message: 'Please select a device first.' });
                openDeviceModal();
                return;
            }

            if (currentState === 'ready') {
                if (setupStep === 0) {
                    setSetupStep(1);
                    notification.success({
                        message: 'Configuration Started',
                        description: 'Moved to configuration step.',
                        duration: 1.5,
                    });
                } else if (setupStep === 1) {
                    // Already in configuration, visual feedback only
                    notification.info({
                        message: 'Already Configuring',
                        description: 'You are already in the configuration step.',
                        duration: 1.5,
                    });
                }
            }
        });
    }, [currentState, setupStep, openDeviceModal, registerStartConfigAction, notification]);

    /**
     * Handles the form submission.
     * Converts User Friendly Units (Minutes OR Seconds) -> API Units (Seconds)
     */
    const handleFinish = (values: SessionFormData) => {
        // 1. Determine Duration in UI Units
        let finalDurationUnits: number;

        if (values.type === 'fixed') {
            finalDurationUnits = values.duration || defaultValues.duration;
        } else if (values.type === 'random') {
            const min = values.rangeMin || minLockUnit;
            const max = values.rangeMax || maxLockUnit;
            finalDurationUnits = Math.floor(Math.random() * (max - min + 1) + min);
        } else {
            // Default to 'time-range' logic
            // The numbers below represent UNITS (Minutes in Release, Seconds in Debug)
            switch (values.timeRangeSelection) {
                case 'short':
                    finalDurationUnits = Math.floor(Math.random() * (45 - 20 + 1) + 20); // 20-45 units
                    break;
                case 'medium':
                    finalDurationUnits = Math.floor(Math.random() * (90 - 60 + 1) + 60); // 60-90 units
                    break;
                case 'long':
                    finalDurationUnits = Math.floor(Math.random() * (180 - 120 + 1) + 120); // 120-180 units
                    break;
                default:
                    finalDurationUnits = defaultValues.duration;
            }
        }

        // Clamp duration to system limits (in units)
        finalDurationUnits = clamp(finalDurationUnits, minLockUnit, maxLockUnit);

        // Convert to API Seconds
        const lockDurationSeconds = finalDurationUnits * timeScale;

        // 2. Convert Penalty (UI Units -> API Seconds)
        let penaltyUnits = values.penaltyDuration || defaultValues.penalty;
        penaltyUnits = clamp(penaltyUnits, minPenaltyUnit, maxPenaltyUnit);
        const penaltyDurationSeconds = penaltyUnits * timeScale;

        // 3. Map Delays (Always Seconds in Form) to Channel Object
        const channelDelaysSeconds = {
            ch1: values.delayCh1 || 0,
            ch2: values.useMultiChannelDelay ? values.delayCh2 || 0 : values.delayCh1 || 0,
            ch3: values.useMultiChannelDelay ? values.delayCh3 || 0 : values.delayCh1 || 0,
            ch4: values.useMultiChannelDelay ? values.delayCh4 || 0 : values.delayCh1 || 0,
        };

        // 4. Construct Payload
        const payload = {
            triggerStrategy: values.triggerStrategy,
            lockDurationSeconds,
            hideTimer: !!values.hideTimer,
            penaltyDurationSeconds,
            channelDelaysSeconds,
        };

        // 5. Call Context Action
        startSession(payload);
    };

    // Determines which step the <Steps> component highlights
    const currentStep = useMemo(() => {
        if (currentState === 'no_device_selected') return 0;
        if (
            currentState === 'server_unreachable' ||
            currentState === 'device_unreachable' ||
            currentState === 'connecting'
        )
            return 0;

        if (currentState === 'ready' || currentState === 'testing') return setupStep;
        // ARMED maps to "Countdown" step (index 2) visually, regardless of strategy
        if (currentState === 'armed') return 2;
        if (currentState === 'locked' || currentState === 'aborted') return 3;
        if (currentState === 'completed') return 4;
        return 0;
    }, [currentState, setupStep]);

    const stepItems = [
        { title: 'Prepare' },
        { title: 'Configure' },
        { title: 'Arming' },
        { title: 'Lock' },
        { title: enableRewardCode ? 'Reward' : 'Complete' }, // Dynamic Title
    ];

    /**
     * Helper to determine the text/state of the "Continue" button on step 0.
     */
    const getContinueButtonProps = () => {
        let text = 'Continue to Configuration';
        let disabled = false;
        let icon = <RightOutlined />;
        let onClick = () => setSetupStep(1);

        switch (currentState) {
            case 'no_device_selected':
                text = 'Select a Device to Continue';
                disabled = false;
                icon = <HddOutlined />;
                onClick = openDeviceModal;
                break;
            case 'server_unreachable':
                text = 'Server Unreachable';
                disabled = true;
                icon = <CloudOutlined />;
                break;
            case 'device_unreachable':
                text = 'Device Unreachable';
                disabled = true;
                icon = <DisconnectOutlined />;
                break;
            case 'connecting':
                text = 'Connecting...';
                disabled = true;
                icon = <LoadingOutlined />;
                break;
            case 'testing':
                text = 'Testing Hardware...';
                disabled = true;
                icon = <LoadingOutlined />;
                break;
        }

        return { text, disabled, icon, onClick };
    };

    const continueButtonProps = getContinueButtonProps();

    // --- Sub-render functions ---

    /**
     * Content for Step 0: Preparation instructions.
     */
    const renderPreparationInstructions = () => (
        <div style={{ width: '100%' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Only show Reward Lock instructions if the feature is enabled */}
                {enableRewardCode && (
                    <div>
                        <Title level={5}>Prepare Your Reward Lock</Title>
                        <Text type="secondary">
                            Before continuing, program your physical lock using the combination pattern shown on the
                            right.
                        </Text>
                        <List
                            size="small"
                            bordered
                            style={{
                                marginTop: '16px',
                                backgroundColor: token.colorFillAlter,
                            }}
                            dataSource={[
                                'Place the lock in the open position.',
                                'On the back of the lock, slide the reset lever to the "up" position (towards "R").',
                                'Insert the shackle into the lock and squeeze firmly twice to clear it.',
                                'Pull up the shackle to re-open it.',
                                'Enter the new combination pattern (from the image on the right).',
                                'Slide the reset lever back to the "down" position.',
                                'Place the lock onto the box containing your reward.',
                                'Insert the shackle and squeeze firmly to secure it.',
                            ]}
                            renderItem={(item, index) => (
                                <List.Item>
                                    <Text>
                                        <Text strong>{index + 1}.</Text> {item}
                                    </Text>
                                </List.Item>
                            )}
                        />
                    </div>
                )}

                <Alert
                    message="Disable Sleep Mode"
                    description="To ensure you can always access the controls, please go to your system settings and temporarily disable sleep mode and the screensaver."
                    type="info"
                    showIcon
                    icon={<DesktopOutlined />}
                />
                <Button
                    type="primary"
                    size="large"
                    onClick={continueButtonProps.onClick}
                    style={{ width: '100%' }}
                    icon={continueButtonProps.icon}
                    disabled={continueButtonProps.disabled}
                >
                    {continueButtonProps.text}
                </Button>
            </Space>
        </div>
    );

    /**
     * Content for Step 1: The main configuration form.
     */
    const renderConfigurationForm = () => {
        const pendingPaybackSeconds = status?.stats?.pendingPaybackSeconds || 0;
        const paybackDurationSeconds = activeDevice?.deterrents?.paybackDurationSeconds || 0;
        const paybackTimeEnabled = activeDevice?.deterrents?.enablePaybackTime || false;

        // Calculate display for payback (Units depend on scale)
        const paybackDisplayVal = Math.floor(paybackDurationSeconds / timeScale);

        return (
            <Form
                form={form}
                onFinish={handleFinish}
                layout="vertical"
                initialValues={{
                    triggerStrategy: 'buttonTrigger',
                    type: 'time-range',
                    timeRangeSelection: 'short',

                    // Use the Calculated Defaults
                    duration: defaultValues.duration,
                    rangeMin: defaultValues.rangeMin,
                    rangeMax: defaultValues.rangeMax,
                    penaltyDuration: defaultValues.penalty,

                    hideTimer: false,
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
                        {isDebugMode
                            ? 'Development Mode: Times are in SECONDS.'
                            : 'Choose how long the device stays locked.'}
                    </Text>

                    <Form.Item name="type" label="Duration Mode" style={{ marginBottom: 8 }}>
                        <Radio.Group buttonStyle="solid">
                            <Radio.Button value="time-range">Time Range</Radio.Button>
                            <Radio.Button value="fixed">Fixed</Radio.Button>
                            <Radio.Button value="random">Random</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    {/* Conditional fields based on "type" */}
                    <Form.Item noStyle dependencies={['type']}>
                        {({ getFieldValue }) => {
                            const type = getFieldValue('type');

                            if (type === 'time-range') {
                                return (
                                    <Form.Item name="timeRangeSelection" label="Select a Range">
                                        <Radio.Group buttonStyle="solid">
                                            <Radio.Button value="short">Short: 20-45 {unitLabel}</Radio.Button>
                                            <Radio.Button value="medium">Medium: 60-90 {unitLabel}</Radio.Button>
                                            <Radio.Button value="long">Long: 120-180 {unitLabel}</Radio.Button>
                                        </Radio.Group>
                                    </Form.Item>
                                );
                            }

                            if (type === 'fixed') {
                                return (
                                    <Form.Item label={`Fixed Duration (${minLockUnit}-${maxLockUnit} ${unitLabel})`}>
                                        <Space.Compact>
                                            <Form.Item name="duration" noStyle>
                                                <InputNumber
                                                    min={minLockUnit}
                                                    max={maxLockUnit}
                                                    style={{ width: 200 }}
                                                />
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
                                                <Button disabled style={{ pointerEvents: 'none' }}>
                                                    {unitLabel}
                                                </Button>
                                            </Space.Compact>
                                        </Form.Item>
                                        <Form.Item label={`Maximum (${unitLabel})`}>
                                            <Space.Compact>
                                                <Form.Item name="rangeMax" noStyle>
                                                    <InputNumber min={minLockUnit} max={maxLockUnit} />
                                                </Form.Item>
                                                <Button disabled style={{ pointerEvents: 'none' }}>
                                                    {unitLabel}
                                                </Button>
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
                                        <Text type="secondary">
                                            You have accrued time debt which will be added to this session.
                                        </Text>
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

                {/* --- 2. START CONFIGURATION (Combined Strategy & Delay) --- */}
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Title level={5}>2. Start Configuration</Title>
                    <Text type="secondary" style={{ marginTop: -8 }}>
                        {isManualTrigger
                            ? 'The session will start after you double-click the device button.'
                            : 'Configure the countdown before the session starts automatically.'}
                    </Text>

                    {/* Start Method Strategy Selector */}
                    {supportsManualTrigger && (
                        <Form.Item name="triggerStrategy" style={{ marginBottom: 12, marginTop: 8 }}>
                            <Radio.Group buttonStyle="solid" block>
                                <Radio.Button
                                    value="buttonTrigger"
                                    style={{
                                        width: '50%',
                                        textAlign: 'center',
                                    }}
                                >
                                    <ThunderboltOutlined /> Device Button
                                </Radio.Button>
                                <Radio.Button
                                    value="autoCountdown"
                                    style={{
                                        width: '50%',
                                        textAlign: 'center',
                                    }}
                                >
                                    <TimerIcon /> Automatic Timer
                                </Radio.Button>
                            </Radio.Group>
                        </Form.Item>
                    )}

                    {/* Delay inputs (HIDDEN if Manual Trigger is selected) */}
                    {!isManualTrigger && (
                        <div style={{ paddingLeft: 12, borderLeft: `2px solid ${token.colorBorderSecondary}` }}>
                            {/* Show toggle only if device has multiple enabled channels */}
                            {canUseMultiChannel && (
                                <Form.Item
                                    name="useMultiChannelDelay"
                                    label="Countdown Mode"
                                    valuePropName="checked"
                                    style={{ marginBottom: 8 }}
                                >
                                    <Switch
                                        checkedChildren="Per-MagLock"
                                        unCheckedChildren="Unified"
                                        onChange={(checked) => {
                                            setUseMultiDelay(checked);
                                        }}
                                    />
                                </Form.Item>
                            )}

                            {/* Single delay inputs (binds to delayCh1) */}
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

                            {/* Multi-channel delay inputs */}
                            {useMultiDelay && (
                                <>
                                    <Row gutter={[16, 0]}>
                                        {enabledChannels.map((ch) => (
                                            <Col xs={24} sm={12} key={ch.key}>
                                                <Form.Item
                                                    label={`${ch.label} Timer (sec)`}
                                                    style={{ marginBottom: 12 }}
                                                >
                                                    <Space.Compact style={{ width: '100%' }}>
                                                        <Form.Item name={ch.key} noStyle>
                                                            <InputNumber
                                                                min={0}
                                                                max={120}
                                                                style={{ width: 'calc(100% - 46px)' }}
                                                            />
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

                {/* --- 3. PENALTY (CONDITIONAL) --- */}
                {enableRewardCode && (
                    <>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Title level={5}>3. Abort Penalty</Title>
                            <Text type="secondary" style={{ marginTop: -8 }}>
                                Set the cooldown duration if the session is aborted early.
                            </Text>

                            <Form.Item
                                label={`Abort Penalty (${minPenaltyUnit}-${maxPenaltyUnit} ${unitLabel})`}
                                style={{ marginTop: 8 }}
                            >
                                <Space.Compact>
                                    <Form.Item name="penaltyDuration" noStyle>
                                        <InputNumber min={minPenaltyUnit} max={maxPenaltyUnit} style={{ width: 200 }} />
                                    </Form.Item>
                                    <Button disabled style={{ pointerEvents: 'none' }}>
                                        {unitLabel}
                                    </Button>
                                </Space.Compact>
                            </Form.Item>
                            <Text type="secondary" style={{ marginTop: -16, display: 'block' }}>
                                When aborted, the reward code will remain hidden for this duration.
                            </Text>
                        </Space>
                        <Divider />
                    </>
                )}

                {/* --- 4. TENSION --- */}
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Title level={5}>{enableRewardCode ? '4.' : '3.'} Tension Mode</Title>
                    <Text type="secondary" style={{ marginTop: -8 }}>
                        Hides the session timer for an extra challenge.
                    </Text>

                    <Form.Item
                        name="hideTimer"
                        label="Enable Tension Mode"
                        valuePropName="checked"
                        style={{ marginTop: 8 }}
                    >
                        <Switch checkedChildren="On" unCheckedChildren="Off" />
                    </Form.Item>
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
                                    <Text type="secondary">
                                        Aborting will add{' '}
                                        <Text strong>
                                            {paybackDisplayVal} {paybackDisplayVal > 1 ? unitLabel + 's' : unitLabel}
                                        </Text>{' '}
                                        to your next session.
                                    </Text>
                                </Space>
                            </Col>
                            <Col span={6} style={{ textAlign: 'right' }}>
                                <Text strong type="warning" style={{ fontSize: '1.2em' }}>
                                    +{paybackDisplayVal}
                                    {unitLabel}
                                </Text>
                            </Col>
                        </Row>
                    </Card>
                )}

                {/* Submit button */}
                <Button
                    type="primary"
                    icon={isManualTrigger ? <ThunderboltOutlined /> : <LockOutlined />}
                    htmlType="submit"
                    size="large"
                    loading={isLocking || currentState === 'testing'}
                    disabled={currentState !== 'ready'}
                    style={{ width: '100%' }}
                >
                    {isLocking
                        ? 'Arming Device...'
                        : currentState === 'ready'
                          ? isManualTrigger
                              ? 'Arm Device (Wait for Button)'
                              : 'Start Countdown'
                          : currentState === 'testing'
                            ? 'Testing Hardware...'
                            : 'Device Not Ready'}
                </Button>
            </Form>
        );
    };

    /**
     * Content for Step 3: Locked or Aborted state.
     */
    const renderSessionActiveContent = () => {
        const isLocked = currentState === 'locked';

        let description = '';
        if (isLocked) {
            description = enableRewardCode
                ? 'The MagLock is engaged. Wait for the timer to end to get the code for the reward lock.'
                : 'The MagLock is engaged. Wait for the timer to end to complete the session.';
        } else {
            // Aborted
            description = enableRewardCode
                ? 'The MagLock has disengaged. The code for the reward lock remains hidden until the penalty cooldown ends.'
                : 'The MagLock has disengaged. The session will remain in penalty state until the cooldown ends.';
        }

        return (
            <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                    message={isLocked ? 'Session Active' : 'Penalty Cooldown'}
                    description={description}
                    type={isLocked ? 'info' : 'error'}
                    showIcon
                />

                {!isLocked && (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <Statistic
                            title="Penalty Time Remaining"
                            value={formatSeconds(sessionTimeRemaining)}
                            valueStyle={{
                                fontSize: '2.5rem',
                                fontFamily: 'monospace',
                                color: red[5],
                            }}
                        />
                    </div>
                )}
            </Space>
        );
    };

    /**
     * Content for Step 4: Session completed.
     */
    const renderSessionCompletedContent = () => (
        <Card bordered={false}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <UnlockOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                <Title level={3} style={{ marginTop: 16 }}>
                    Session Complete!
                </Title>
                <Text type="secondary">
                    {enableRewardCode
                        ? 'The code for your reward lock is now visible.'
                        : 'You may now access your reward.'}
                </Text>
                <Alert
                    message="Reboot Required for Next Session"
                    description={
                        enableRewardCode
                            ? 'To start a new session, you must power the lock controller off and then on again. It will automatically generate a new reward code.'
                            : 'To start a new session, you must power the lock controller off and then on again.'
                    }
                    type="info"
                    showIcon
                    icon={<PoweroffOutlined />}
                    style={{ marginTop: 24, textAlign: 'left' }}
                />
            </div>
        </Card>
    );

    /**
     * Main render logic for the component.
     * Selects which sub-component to show based on the current step.
     */
    const renderContentByStep = () => {
        if (
            currentState === 'no_device_selected' ||
            (currentStep === 0 &&
                (currentState === 'connecting' ||
                    currentState === 'device_unreachable' ||
                    currentState === 'server_unreachable'))
        ) {
            return renderPreparationInstructions();
        }

        if (currentState === 'connecting') {
            return (
                <div
                    style={{
                        height: '150px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '16px',
                    }}
                >
                    <Spin size="large" />
                    <Text>Connecting...</Text>
                </div>
            );
        }

        switch (currentStep) {
            case 0:
                return renderPreparationInstructions();
            case 1:
                return renderConfigurationForm(); // Called as function, not <Component />
            case 2:
                // ARMED State (Countdown or Wait for Button)
                return <CountdownDisplay />;
            case 3:
                // This state can only be 'locked' or 'aborted'
                return renderSessionActiveContent();
            case 4:
                return renderSessionCompletedContent();
            default:
                return null;
        }
    };

    // Main component layout
    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Steps current={currentStep} items={stepItems} />
            <div style={{ marginTop: 0 }}>{renderContentByStep()}</div>
        </Space>
    );
};
