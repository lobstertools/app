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
} from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { formatSeconds } from '../../utils/time';
import { CountdownDisplay } from './CountdownDisplay';
import { useDeviceManager } from '../../context/useDeviceManager';
import { useSession, SessionFormData } from '../../context/useSessionContext';

const { Title, Text } = Typography;

/**
 * Renders the multi-step wizard for configuring and starting a new session.
 * This is the main control panel for the 'ready' state.
 */
export const SessionControl = () => {
    const { currentState, startSession, isLocking, sessionTimeRemaining } =
        useSession();
    const { activeDevice, openDeviceModal } = useDeviceManager();

    const [form] = Form.useForm<SessionFormData>();
    const [setupStep, setSetupStep] = useState(0);
    const [useMultiDelay, setUseMultiDelay] = useState(false);
    const { token } = antdTheme.useToken();

    // Calculate enabled channels for the UI based on the new API structure
    const enabledChannels = useMemo(() => {
        if (!activeDevice) return [];
        const list = [];
        if (activeDevice.channels.ch1)
            list.push({ key: 'delayCh1', label: 'MagLock 1' });
        if (activeDevice.channels.ch2)
            list.push({ key: 'delayCh2', label: 'MagLock 2' });
        if (activeDevice.channels.ch3)
            list.push({ key: 'delayCh3', label: 'MagLock 3' });
        if (activeDevice.channels.ch4)
            list.push({ key: 'delayCh4', label: 'MagLock 4' });
        return list;
    }, [activeDevice]);

    const canUseMultiChannel = enabledChannels.length > 1;

    // Reset form when returning to 'ready' state
    useEffect(() => {
        if (currentState === 'ready') {
            setSetupStep(0);
            setUseMultiDelay(false);
        }
    }, [currentState, form]);

    // Determines which step the <Steps> component highlights
    const currentStep = useMemo(() => {
        if (currentState === 'no_device_selected') return 0;
        if (
            currentState === 'server_unreachable' ||
            currentState === 'device_unreachable' ||
            currentState === 'connecting'
        )
            return 0;

        if (currentState === 'ready' || currentState === 'testing')
            return setupStep;
        if (currentState === 'countdown') return 2;
        if (currentState === 'locked' || currentState === 'aborted') return 3;
        if (currentState === 'completed') return 4;
        return 0;
    }, [currentState, setupStep]);

    const stepItems = [
        { title: 'Prepare' },
        { title: 'Configure' },
        { title: 'Countdown' },
        { title: 'Lock' },
        { title: 'Reward' },
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

    // --- Sub-components for each step ---

    /**
     * Content for Step 0: Preparation instructions.
     */
    const PreparationInstructions = (
        <div style={{ width: '100%' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                    <Title level={5}>Prepare Your Reward Lock</Title>
                    <Text type="secondary">
                        Before continuing, program your physical lock using the
                        combination pattern shown on the right.
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
    const ConfigurationForm = () => {
        const { status } = useSession();
        const { activeDevice } = useDeviceManager();
        const pendingPaybackSeconds = status?.stats?.pendingPaybackSeconds || 0;
        const paybackTimeEnabled =
            activeDevice?.config?.enablePaybackTime || false;
        const paybackTimeMinutes =
            activeDevice?.config?.paybackTimeMinutes || 0;

        return (
            <Form
                form={form}
                onFinish={startSession}
                layout="vertical"
                initialValues={{
                    type: 'time-range',
                    timeRangeSelection: 'short',
                    duration: 30,
                    rangeMin: 15,
                    rangeMax: 45,
                    penaltyDuration: 120,
                    hideTimer: false,
                    useMultiChannelDelay: false,
                    delayCh1: 30,
                    delayCh2: 30,
                    delayCh3: 30,
                    delayCh4: 30,
                }}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Title level={5}>1. Session Duration</Title>
                    <Text type="secondary" style={{ marginTop: -8 }}>
                        Choose how the session duration will be set.
                    </Text>

                    <Form.Item
                        name="type"
                        label="Duration Type"
                        style={{ marginBottom: 8 }}
                    >
                        <Radio.Group buttonStyle="solid">
                            <Radio.Button value="time-range">
                                Time Range
                            </Radio.Button>
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
                                    <Form.Item
                                        name="timeRangeSelection"
                                        label="Select a Range"
                                    >
                                        <Radio.Group buttonStyle="solid">
                                            <Radio.Button value="short">
                                                Short: 20-45 min
                                            </Radio.Button>
                                            <Radio.Button value="medium">
                                                Medium: 60-90 min
                                            </Radio.Button>
                                            <Radio.Button value="long">
                                                Long: 2-3 hours
                                            </Radio.Button>
                                        </Radio.Group>
                                    </Form.Item>
                                );
                            }

                            if (type === 'fixed') {
                                return (
                                    <Form.Item
                                        name="duration"
                                        label="Fixed Duration (15-180 min)"
                                    >
                                        <InputNumber
                                            min={15}
                                            max={180}
                                            addonAfter="min"
                                            style={{ width: 200 }}
                                        />
                                    </Form.Item>
                                );
                            }

                            if (type === 'random') {
                                return (
                                    <Space align="start">
                                        <Form.Item
                                            name="rangeMin"
                                            label="Minimum (min)"
                                        >
                                            <InputNumber
                                                min={15}
                                                max={180}
                                                addonAfter="min"
                                            />
                                        </Form.Item>
                                        <Form.Item
                                            name="rangeMax"
                                            label="Maximum (min)"
                                        >
                                            <InputNumber
                                                min={15}
                                                max={180}
                                                addonAfter="min"
                                            />
                                        </Form.Item>
                                    </Space>
                                );
                            }

                            return null;
                        }}
                    </Form.Item>

                    {paybackTimeEnabled && pendingPaybackSeconds > 0 && (
                        <Text type="secondary" style={{ display: 'block' }}>
                            <FieldTimeOutlined style={{ marginRight: 8 }} />
                            You have{' '}
                            <Text strong>
                                {formatSeconds(pendingPaybackSeconds)}
                            </Text>{' '}
                            of pending payback, which will be added to this
                            session.
                        </Text>
                    )}
                </Space>

                <Divider style={{ marginTop: 6 }} />

                <Space direction="vertical" style={{ width: '100%' }}>
                    <Title level={5}>2. Start Delay</Title>
                    <Text type="secondary" style={{ marginTop: -8 }}>
                        Set a countdown period before the MagLock engages.
                    </Text>

                    {/* Show toggle only if device has multiple enabled channels */}
                    {canUseMultiChannel && (
                        <Form.Item
                            name="useMultiChannelDelay"
                            label="Delay Mode"
                            valuePropName="checked"
                            style={{ marginBottom: 8 }}
                        >
                            <Switch
                                checkedChildren="Per-MagLock"
                                unCheckedChildren="Single Delay"
                                onChange={(checked) => {
                                    setUseMultiDelay(checked);
                                }}
                            />
                        </Form.Item>
                    )}

                    {/* Single delay inputs (binds to delayCh1) */}
                    {!useMultiDelay && (
                        <>
                            <Form.Item
                                name="delayCh1"
                                label="Start Delay (0-120 seconds)"
                            >
                                <InputNumber
                                    min={0}
                                    max={120}
                                    addonAfter="sec"
                                    style={{ width: 200 }}
                                />
                            </Form.Item>
                            <Text
                                type="secondary"
                                style={{ marginTop: -16, display: 'block' }}
                            >
                                {canUseMultiChannel
                                    ? 'All enabled MagLocks will activate after this delay.'
                                    : 'Wait before the lock session begins.'}
                            </Text>
                        </>
                    )}

                    {/* Multi-channel delay inputs */}
                    {useMultiDelay && (
                        <>
                            <Row gutter={[16, 16]}>
                                {enabledChannels.map((ch) => (
                                    <Col xs={24} sm={12} key={ch.key}>
                                        <Form.Item
                                            name={ch.key} // Binds to delayCh1, delayCh2...
                                            label={`${ch.label} Delay (sec)`}
                                            style={{ marginBottom: 0 }}
                                        >
                                            <InputNumber
                                                min={0}
                                                max={120}
                                                addonAfter="sec"
                                                style={{ width: '100%' }}
                                            />
                                        </Form.Item>
                                    </Col>
                                ))}
                            </Row>
                            <Text
                                type="secondary"
                                style={{ marginTop: 8, display: 'block' }}
                            >
                                Set an independent delay for each MagLock. The
                                session timer begins after all the MagLocks have
                                been activated.
                            </Text>
                        </>
                    )}
                </Space>

                <Divider />
                {/* Penalty configuration */}
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Title level={5}>3. Abort Penalty</Title>
                    <Text type="secondary" style={{ marginTop: -8 }}>
                        Set the cooldown duration if the session is aborted
                        early.
                    </Text>

                    <Form.Item
                        name="penaltyDuration"
                        label="Abort Penalty (15-180 min)"
                        style={{ marginTop: 8 }}
                    >
                        <InputNumber
                            min={15}
                            max={180}
                            addonAfter="min"
                            style={{ width: 200 }}
                        />
                    </Form.Item>
                    <Text
                        type="secondary"
                        style={{ marginTop: -16, display: 'block' }}
                    >
                        When aborted, the reward code will remain hidden for
                        this duration.
                    </Text>
                </Space>

                <Divider />
                {/* Tension mode (hide timer) */}
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Title level={5}>3. Tension Mode</Title>
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
                    <div
                        style={{
                            marginBottom: 8,
                            marginTop: 0,
                            textAlign: 'center',
                        }}
                    >
                        <Text type="secondary">
                            <FieldTimeOutlined style={{ marginRight: 8 }} />
                            Time Payback is enabled: Aborting will add{' '}
                            <Text strong>
                                {paybackTimeMinutes}{' '}
                                {paybackTimeMinutes > 1 ? 'minutes' : 'minute'}
                            </Text>{' '}
                            to your next session.
                        </Text>
                    </div>
                )}

                {/* Submit button */}
                <Button
                    type="primary"
                    icon={<LockOutlined />}
                    htmlType="submit"
                    size="large"
                    loading={isLocking || currentState === 'testing'}
                    disabled={currentState !== 'ready'}
                    style={{ width: '100%' }}
                >
                    {isLocking
                        ? 'Starting...'
                        : currentState === 'ready'
                          ? 'Start Lock Session'
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
    const SessionActiveContent = ({
        currentState,
        sessionTimeRemaining,
    }: {
        currentState: 'locked' | 'aborted';
        sessionTimeRemaining: number;
    }) => {
        const isLocked = currentState === 'locked';

        return (
            <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                    message={isLocked ? 'Session Active' : 'Penalty Cooldown'}
                    description={
                        isLocked
                            ? 'The MagLock is engaged. Wait for the timer to end to get the code for the reward lock.'
                            : 'The MagLock has disengaged. The code for the reward lock remains hidden until the penalty cooldown ends.'
                    }
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
    const SessionCompletedContent = (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <UnlockOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            <Title level={3} style={{ marginTop: 16 }}>
                Session Complete!
            </Title>
            <Text type="secondary">
                The code for your reward lock is now visible.
            </Text>
            <Alert
                message="Reboot Required for Next Session"
                description="To start a new session, you must power the lock controller off and then on again. It will automatically generate a new reward code."
                type="info"
                showIcon
                icon={<PoweroffOutlined />}
                style={{ marginTop: 24, textAlign: 'left' }}
            />
        </div>
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
            return PreparationInstructions;
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
                return PreparationInstructions;
            case 1:
                return <ConfigurationForm />;
            case 2:
                return <CountdownDisplay />;
            case 3:
                // This state can only be 'locked' or 'aborted'
                return (
                    <SessionActiveContent
                        currentState={currentState as 'locked' | 'aborted'}
                        sessionTimeRemaining={sessionTimeRemaining}
                    />
                );
            case 4:
                return <Card bordered={false}>{SessionCompletedContent}</Card>;
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
