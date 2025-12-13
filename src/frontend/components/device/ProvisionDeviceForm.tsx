import {
    Form,
    Input,
    Button,
    InputNumber,
    Checkbox,
    Spin,
    Alert,
    Typography,
    Row,
    Col,
    Steps,
    Space,
    Switch,
    Radio,
    Segmented,
    Card,
    theme as antdTheme,
} from 'antd';
import { useState } from 'react';
import { WifiOutlined, SafetyCertificateOutlined, RightOutlined, LeftOutlined, SaveOutlined, DashboardOutlined } from '@ant-design/icons';
import humanizeDuration from 'humanize-duration';
import { DiscoveredDevice, DeviceProvisioningData, SessionPresets, DeterrentConfig, Channels } from '../../../types';
import { useDeviceManager } from '../../context/useDeviceManager';

/**
 * PROPS
 */
interface ProvisionDeviceFormProps {
    device: DiscoveredDevice;
    onSuccess: () => void;
}

/**
 * FORM VALUES
 */
interface ProvisionFormValues {
    // Step 1: Connection & Hardware
    ssid: string;
    pass: string;
    ch1Enabled: boolean;
    ch2Enabled: boolean;
    ch3Enabled: boolean;
    ch4Enabled: boolean;

    // Step 2: Play Style (Safety Limits)
    playStyle: 'cautious' | 'standard' | 'extended' | 'extreme';
    minSessionDuration: number; // Hardware Minimum
    maxSessionDuration: number; // Hardware Maximum (Ceiling)

    // Step 3: Deterrents
    enableStreaks: boolean;

    // Payback
    enablePaybackTime: boolean;
    paybackStrategy: 'DETERRENT_FIXED' | 'DETERRENT_RANDOM';
    paybackTimeMinutes: number;
    paybackMinMinutes: number;
    paybackMaxMinutes: number;

    // Reward
    enableRewardCode: boolean;
    rewardStrategy: 'DETERRENT_FIXED' | 'DETERRENT_RANDOM';
    rewardPenaltyMinutes: number;
    rewardPenaltyMinMinutes: number;
    rewardPenaltyMaxMinutes: number;
}

// --- CONSTANTS & CONFIG ---

const { Text, Title } = Typography;

// Global Max Safety Limit (7 Days in minutes)
const GLOBAL_MAX_MINUTES = 10080;

// Helper for readable time
const humanize = (minutes: number) => humanizeDuration(minutes * 60 * 1000, { largest: 2, round: true });

// Presets with detailed numeric breakdown for Firmware
const PLAY_STYLE_PRESETS = {
    cautious: {
        label: 'Cautious',
        desc: 'For testing and demos.',
        breakdown: [
            { label: 'Short', range: '1 - 5 min', minMinutes: 1, maxMinutes: 5 },
            { label: 'Medium', range: '5 - 15 min', minMinutes: 5, maxMinutes: 15 },
            { label: 'Long', range: '15 - 30 min', minMinutes: 15, maxMinutes: 30 },
        ],
        min: 1,
        max: 60,
        // Penalties (Low)
        payback: { fixed: 5, min: 2, max: 10 },
        reward: { fixed: 2, min: 1, max: 5 },
    },
    standard: {
        label: 'Standard',
        desc: 'The default experience.',
        breakdown: [
            { label: 'Short', range: '20 - 45 min', minMinutes: 20, maxMinutes: 45 },
            { label: 'Medium', range: '1 - 1.5 hr', minMinutes: 60, maxMinutes: 90 },
            { label: 'Long', range: '2 - 3 hr', minMinutes: 120, maxMinutes: 180 },
        ],
        min: 15,
        max: 240, // 4 hours
        // Penalties (Moderate)
        payback: { fixed: 20, min: 15, max: 45 },
        reward: { fixed: 15, min: 5, max: 20 },
    },
    extended: {
        label: 'Extended',
        desc: 'For experienced users.',
        breakdown: [
            { label: 'Short', range: '1 - 2 hr', minMinutes: 60, maxMinutes: 120 },
            { label: 'Medium', range: '3 - 6 hr', minMinutes: 180, maxMinutes: 360 },
            { label: 'Long', range: '8 - 12 hr', minMinutes: 480, maxMinutes: 720 },
        ],
        min: 60,
        max: 1440, // 24 hours
        // Penalties (High)
        payback: { fixed: 120, min: 60, max: 180 }, // 2 - 3 hrs
        reward: { fixed: 60, min: 30, max: 90 }, // 1 - 1.5 hrs
    },
    extreme: {
        label: 'Extreme',
        desc: 'Multi-day sessions.',
        breakdown: [
            { label: 'Short', range: '4 - 8 hr', minMinutes: 240, maxMinutes: 480 },
            { label: 'Medium', range: '12 - 24 hr', minMinutes: 720, maxMinutes: 1440 },
            { label: 'Long', range: '2 - 3 days', minMinutes: 2880, maxMinutes: 4320 },
        ],
        min: 240,
        max: 10080, // 7 days`
        // Penalties (Severe)
        payback: { fixed: 360, min: 180, max: 720 }, // 6 hrs fixed, 3-12 hrs random
        reward: { fixed: 180, min: 60, max: 360 }, // 3 hrs fixed, 1-6 hrs random
    },
};

export const ProvisionDeviceForm = ({ device, onSuccess }: ProvisionDeviceFormProps) => {
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const { token } = antdTheme.useToken();
    const { provisionDevice, isProvisioning } = useDeviceManager();

    // --- WATCHERS ---
    const playStyle = Form.useWatch('playStyle', form);
    const enablePaybackTime = Form.useWatch('enablePaybackTime', form);
    const paybackStrategy = Form.useWatch('paybackStrategy', form);
    const enableRewardCode = Form.useWatch('enableRewardCode', form);
    const rewardStrategy = Form.useWatch('rewardStrategy', form);

    // --- STYLES ---

    const cardStyle = {
        marginTop: 8,
        borderColor: token.colorBorderSecondary,
        backgroundColor: token.colorFillAlter,
    };

    // Base style for dependent config sections (Payback/Reward)
    const dependentConfigStyle = {
        marginTop: 16,
        paddingLeft: 0,
    };

    /**
     * Auto-fill numeric fields when a Play Style Preset is selected
     */
    const handleStyleChange = (value: string) => {
        if (PLAY_STYLE_PRESETS[value as keyof typeof PLAY_STYLE_PRESETS]) {
            const preset = PLAY_STYLE_PRESETS[value as keyof typeof PLAY_STYLE_PRESETS];
            form.setFieldsValue({
                minSessionDuration: preset.min,
                maxSessionDuration: preset.max,
                // Update Payback Defaults
                paybackTimeMinutes: preset.payback.fixed,
                paybackMinMinutes: preset.payback.min,
                paybackMaxMinutes: preset.payback.max,
                // Update Reward Defaults
                rewardPenaltyMinutes: preset.reward.fixed,
                rewardPenaltyMinMinutes: preset.reward.min,
                rewardPenaltyMaxMinutes: preset.reward.max,
            });
        }
    };

    /**
     * Navigation Logic
     */
    const handleNext = async () => {
        try {
            if (currentStep === 0) {
                // Validate individual fields first
                await form.validateFields(['ssid', 'pass', 'ch1Enabled', 'ch2Enabled', 'ch3Enabled', 'ch4Enabled']);

                // Then validate the group rule manually just in case
                const values = form.getFieldsValue(['ch1Enabled', 'ch2Enabled', 'ch3Enabled', 'ch4Enabled']);
                if (!values.ch1Enabled && !values.ch2Enabled && !values.ch3Enabled && !values.ch4Enabled) {
                    // Trigger the form item error
                    form.setFields([
                        {
                            name: 'ch1Enabled', // Attach error to first checkbox
                            errors: ['At least one channel must be enabled'],
                        },
                    ]);
                    return;
                }
            } else if (currentStep === 1) {
                await form.validateFields(['minSessionDuration', 'maxSessionDuration']);
            }
            setCurrentStep((prev) => prev + 1);
        } catch (e) {
            // Validation failed
        }
    };

    const handlePrev = () => setCurrentStep((prev) => prev - 1);

    /**
     * SUBMISSION
     */
    const handleFinish = async (values: ProvisionFormValues) => {
        setError(null);

        // 1. Get Preset Ranges (Hardware needs to know what "Short", "Medium", "Long" mean)
        const styleConfig = PLAY_STYLE_PRESETS[values.playStyle || 'standard'];
        // Safe access to breakdown indices [0]=Short, [1]=Medium, [2]=Long
        const short = styleConfig.breakdown[0];
        const medium = styleConfig.breakdown[1];
        const long = styleConfig.breakdown[2];

        // 2. Construct Objects matching 'index.ts' interfaces
        const channels: Channels = {
            ch1: !!values.ch1Enabled,
            ch2: !!values.ch2Enabled,
            ch3: !!values.ch3Enabled,
            ch4: !!values.ch4Enabled,
        };

        const presets: SessionPresets = {
            minSessionDuration: values.minSessionDuration * 60,
            maxSessionDuration: values.maxSessionDuration * 60,
            shortMin: short.minMinutes * 60,
            shortMax: short.maxMinutes * 60,
            mediumMin: medium.minMinutes * 60,
            mediumMax: medium.maxMinutes * 60,
            longMin: long.minMinutes * 60,
            longMax: long.maxMinutes * 60,
        };

        const deterrents: DeterrentConfig = {
            enableStreaks: !!values.enableStreaks,

            // Payback
            enablePaybackTime: !!values.enablePaybackTime,
            paybackTimeStrategy: values.paybackStrategy,
            paybackTime: values.paybackTimeMinutes * 60,
            paybackTimeMin: values.paybackMinMinutes * 60,
            paybackTimeMax: values.paybackMaxMinutes * 60,

            // Reward
            enableRewardCode: !!values.enableRewardCode,
            rewardPenaltyStrategy: values.rewardStrategy,
            rewardPenalty: values.rewardPenaltyMinutes * 60,
            rewardPenaltyMin: values.rewardPenaltyMinMinutes * 60,
            rewardPenaltyMax: values.rewardPenaltyMaxMinutes * 60,
        };

        const payload: DeviceProvisioningData = {
            ssid: values.ssid,
            pass: values.pass,
            channels,
            presets,
            deterrents,
        };

        const success = await provisionDevice(device.id, payload);
        if (success) onSuccess();
        else setError('Provisioning failed. Please check connection logs.');
    };

    // --- STEP 1: CONNECTION ---
    const renderConnectionStep = () => (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* Wi-Fi Section */}
            <div>
                <Title level={5}>1. Wi-Fi Connection</Title>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="ssid" label="Network Name (SSID)" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                            <Input placeholder="WiFi Network Name" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="pass" label="Password" rules={[{ max: 64, required: true }]} style={{ marginBottom: 0 }}>
                            <Input.Password placeholder="WiFi Password" />
                        </Form.Item>
                    </Col>
                </Row>
            </div>

            {/* Hardware Section */}
            <div style={{ marginTop: 8 }}>
                <Title level={5}>2. Hardware Mapping</Title>
                <div
                    style={{
                        backgroundColor: token.colorFillAlter,
                        padding: '16px',
                        borderRadius: token.borderRadius,
                        border: `1px solid ${token.colorBorderSecondary}`,
                    }}
                >
                    {/* Add dependency validator to ensure at least one is checked */}
                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) =>
                            prev.ch1Enabled !== curr.ch1Enabled ||
                            prev.ch2Enabled !== curr.ch2Enabled ||
                            prev.ch3Enabled !== curr.ch3Enabled ||
                            prev.ch4Enabled !== curr.ch4Enabled
                        }
                    >
                        {({ getFieldsValue }) => {
                            const values = getFieldsValue(['ch1Enabled', 'ch2Enabled', 'ch3Enabled', 'ch4Enabled']);
                            const hasOne = values.ch1Enabled || values.ch2Enabled || values.ch3Enabled || values.ch4Enabled;

                            return (
                                <>
                                    <Row gutter={24}>
                                        <Col span={12}>
                                            <Form.Item name="ch1Enabled" valuePropName="checked" noStyle>
                                                <Checkbox style={{ display: 'flex', marginBottom: 8 }}>Channel 1</Checkbox>
                                            </Form.Item>
                                            <Form.Item name="ch2Enabled" valuePropName="checked" noStyle>
                                                <Checkbox style={{ display: 'flex' }}>Channel 2</Checkbox>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="ch3Enabled" valuePropName="checked" noStyle>
                                                <Checkbox style={{ display: 'flex', marginBottom: 8 }}>Channel 3</Checkbox>
                                            </Form.Item>
                                            <Form.Item name="ch4Enabled" valuePropName="checked" noStyle>
                                                <Checkbox style={{ display: 'flex' }}>Channel 4</Checkbox>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    {!hasOne && (
                                        <div style={{ color: token.colorError, fontSize: '12px', marginTop: 8 }}>
                                            At least one output channel must be enabled.
                                        </div>
                                    )}
                                    {/* Invisible validator hook to block form submission */}
                                    <Form.Item
                                        name="hardwareValidator"
                                        rules={[
                                            () => ({
                                                validator() {
                                                    if (hasOne) return Promise.resolve();
                                                    return Promise.reject(new Error('At least one output channel must be enabled'));
                                                },
                                            }),
                                        ]}
                                        style={{ display: 'none' }}
                                    >
                                        <Input />
                                    </Form.Item>
                                </>
                            );
                        }}
                    </Form.Item>
                </div>
                <Text type="secondary" style={{ fontSize: '12px', marginTop: 8, display: 'block' }}>
                    Select which physical outputs on the controller are connected to MagLocks.
                </Text>
            </div>
        </Space>
    );

    // --- STEP 2: PLAY STYLE ---
    const renderPlayStyleStep = () => {
        const currentPreset = PLAY_STYLE_PRESETS[playStyle as keyof typeof PLAY_STYLE_PRESETS] || PLAY_STYLE_PRESETS.standard;

        return (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* 1. Selector */}
                <div>
                    <Title level={5}>Select Play Style</Title>
                    <Form.Item name="playStyle" style={{ marginBottom: 16 }}>
                        <Segmented
                            block
                            options={Object.keys(PLAY_STYLE_PRESETS).map((key) => ({
                                label: (
                                    <div style={{ padding: '4px 0' }}>
                                        <div style={{ fontWeight: 500 }}>
                                            {PLAY_STYLE_PRESETS[key as keyof typeof PLAY_STYLE_PRESETS].label}
                                        </div>
                                    </div>
                                ),
                                value: key,
                            }))}
                            onChange={handleStyleChange}
                        />
                    </Form.Item>

                    {/* Integrated Breakdown Card */}
                    <Card size="small" style={{ ...cardStyle, background: token.colorBgContainer }}>
                        {/* Breakdown Columns */}
                        <Row gutter={8} style={{ marginBottom: 8 }}>
                            {currentPreset.breakdown?.map((item, idx) => (
                                <Col span={8} key={idx}>
                                    <div
                                        style={{
                                            backgroundColor: token.colorFillAlter,
                                            padding: '8px',
                                            borderRadius: token.borderRadius,
                                            textAlign: 'center',
                                            border: `1px solid ${token.colorBorderSecondary}`,
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '10px',
                                                color: token.colorTextSecondary,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                marginBottom: 4,
                                            }}
                                        >
                                            {item.label}
                                        </div>
                                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{item.range}</div>
                                    </div>
                                </Col>
                            ))}
                        </Row>

                        {/* Visual Connector & Boundaries */}
                        <div
                            style={{
                                marginTop: 16,
                                paddingTop: 12,
                                borderTop: `1px dashed ${token.colorBorder}`,
                            }}
                        >
                            <Row justify="space-between" align="middle">
                                <Col>
                                    <Text type="secondary" style={{ fontSize: '10px', display: 'block', textTransform: 'uppercase' }}>
                                        Min Limit
                                    </Text>
                                    <Text strong>{humanize(currentPreset.min)}</Text>
                                </Col>
                                <Col flex="auto" style={{ textAlign: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: '10px', color: token.colorTextQuaternary }}>
                                        Device Safety Boundaries
                                    </Text>
                                </Col>
                                <Col style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: '10px', display: 'block', textTransform: 'uppercase' }}>
                                        Max Limit
                                    </Text>
                                    <Text strong>{humanize(currentPreset.max)}</Text>
                                </Col>
                            </Row>
                        </div>
                    </Card>

                    <Text type="secondary" style={{ fontSize: '12px', marginTop: 8, display: 'block' }}>
                        These ranges define the default options available when starting a session with a randomized duration. The device
                        will reject any session shorter than the Min Limit or longer than the Max Limit.
                    </Text>
                </div>

                {/* Hidden Inputs for Form Submission */}
                <Form.Item name="minSessionDuration" hidden>
                    <InputNumber />
                </Form.Item>
                <Form.Item name="maxSessionDuration" hidden>
                    <InputNumber />
                </Form.Item>
            </Space>
        );
    };

    // --- STEP 3: DETERRENTS ---
    const renderDeterrentsStep = () => (
        <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'left' }}>
            <Text type="secondary">Configure behavioral deterrents. Defaults have been scaled to match your Play Style.</Text>

            {/* 1. Streak Tracking */}
            <Card size="small" style={cardStyle}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={5} style={{ margin: 0 }}>
                            Session Streaks
                        </Title>
                        <Text type="secondary">Track consecutive successful sessions.</Text>
                    </Col>
                    <Col>
                        <Form.Item name="enableStreaks" valuePropName="checked" noStyle>
                            <Switch />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>

            {/* 2. Payback Time */}
            <Card size="small" style={cardStyle}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={5} style={{ margin: 0 }}>
                            Time Payback
                        </Title>
                        <Text type="secondary">Add "debt" time on abort.</Text>
                    </Col>
                    <Col>
                        <Form.Item name="enablePaybackTime" valuePropName="checked" noStyle>
                            <Switch />
                        </Form.Item>
                    </Col>
                </Row>

                {enablePaybackTime && (
                    <div style={dependentConfigStyle}>
                        {/* Strategy Selector */}
                        <Form.Item
                            label="Strategy"
                            name="paybackStrategy"
                            initialValue="DETERRENT_FIXED"
                            style={{ marginBottom: 16, marginLeft: 0 }}
                            wrapperCol={{ style: { paddingLeft: 0 } }}
                        >
                            <Radio.Group optionType="button" buttonStyle="solid">
                                <Radio.Button value="DETERRENT_FIXED">Fixed Time</Radio.Button>
                                <Radio.Button value="DETERRENT_RANDOM">Random Range</Radio.Button>
                            </Radio.Group>
                        </Form.Item>

                        {/* Input Controls */}
                        <div style={{ marginBottom: 16 }}>
                            {paybackStrategy === 'DETERRENT_FIXED' ? (
                                <Form.Item
                                    label="Penalty Duration"
                                    name="paybackTimeMinutes"
                                    rules={[{ required: true }]}
                                    style={{ margin: 0, padding: 0 }}
                                >
                                    <InputNumber min={1} max={GLOBAL_MAX_MINUTES} addonAfter="min" style={{ width: 150 }} />
                                </Form.Item>
                            ) : (
                                <Space align="start" size="small" style={{ display: 'flex' }}>
                                    <Form.Item
                                        label="Min Duration"
                                        name="paybackMinMinutes"
                                        rules={[{ required: true }]}
                                        style={{ margin: 0, padding: 0 }}
                                    >
                                        <InputNumber min={1} addonAfter="min" style={{ width: 120 }} />
                                    </Form.Item>
                                    <span style={{ display: 'inline-block', marginTop: 32 }}>-</span>
                                    <Form.Item
                                        label="Max Duration"
                                        name="paybackMaxMinutes"
                                        dependencies={['paybackMinMinutes']}
                                        rules={[
                                            { required: true },
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    if (!value || value >= getFieldValue('paybackMinMinutes')) {
                                                        return Promise.resolve();
                                                    }
                                                    return Promise.reject(new Error('Max < Min'));
                                                },
                                            }),
                                        ]}
                                        style={{ margin: 0, padding: 0 }}
                                    >
                                        <InputNumber min={1} max={GLOBAL_MAX_MINUTES} addonAfter="min" style={{ width: 120 }} />
                                    </Form.Item>
                                </Space>
                            )}
                        </div>

                        {/* Explainer Text */}
                        <Text type="secondary" style={{ fontSize: '0.85em', display: 'block', lineHeight: '1.4' }}>
                            Penalty time is added to the start of your next session.
                            <br />
                            <strong>Note:</strong> The total session length (base + penalty) will never exceed your configured Maximum
                            Session Limit.
                        </Text>
                    </div>
                )}
            </Card>

            {/* 3. Reward Code */}
            <Card size="small" style={cardStyle}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={5} style={{ margin: 0 }}>
                            Reward Code
                        </Title>
                        <Text type="secondary">Hide unlock code on abort.</Text>
                    </Col>
                    <Col>
                        <Form.Item name="enableRewardCode" valuePropName="checked" noStyle>
                            <Switch />
                        </Form.Item>
                    </Col>
                </Row>

                {enableRewardCode && (
                    <div style={dependentConfigStyle}>
                        {/* Strategy Selector */}
                        <Form.Item
                            label="Strategy"
                            name="rewardStrategy"
                            initialValue="DETERRENT_FIXED"
                            style={{ marginBottom: 16, marginLeft: 0 }}
                            wrapperCol={{ style: { paddingLeft: 0 } }}
                        >
                            <Radio.Group optionType="button" buttonStyle="solid">
                                <Radio.Button value="DETERRENT_FIXED">Fixed Time</Radio.Button>
                                <Radio.Button value="DETERRENT_RANDOM">Random Range</Radio.Button>
                            </Radio.Group>
                        </Form.Item>

                        {/* Input Controls */}
                        <div style={{ marginBottom: 16 }}>
                            {rewardStrategy === 'DETERRENT_FIXED' ? (
                                <Form.Item
                                    label="Hide Duration"
                                    name="rewardPenaltyMinutes"
                                    rules={[{ required: true }]}
                                    style={{ margin: 0, padding: 0 }}
                                >
                                    <InputNumber min={1} max={GLOBAL_MAX_MINUTES} addonAfter="min" style={{ width: 150 }} />
                                </Form.Item>
                            ) : (
                                <Space align="start" size="small" style={{ display: 'flex' }}>
                                    <Form.Item
                                        label="Min Duration"
                                        name="rewardPenaltyMinMinutes"
                                        rules={[{ required: true }]}
                                        style={{ margin: 0, padding: 0 }}
                                    >
                                        <InputNumber min={1} addonAfter="min" style={{ width: 120 }} />
                                    </Form.Item>
                                    <span style={{ display: 'inline-block', marginTop: 32 }}>-</span>
                                    <Form.Item
                                        label="Max Duration"
                                        name="rewardPenaltyMaxMinutes"
                                        dependencies={['rewardPenaltyMinMinutes']}
                                        rules={[
                                            { required: true },
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    if (!value || value >= getFieldValue('rewardPenaltyMinMinutes')) {
                                                        return Promise.resolve();
                                                    }
                                                    return Promise.reject(new Error('Max < Min'));
                                                },
                                            }),
                                        ]}
                                        style={{ margin: 0, padding: 0 }}
                                    >
                                        <InputNumber min={1} max={GLOBAL_MAX_MINUTES} addonAfter="min" style={{ width: 120 }} />
                                    </Form.Item>
                                </Space>
                            )}
                        </div>

                        {/* Explainer Text */}
                        <Text type="secondary" style={{ fontSize: '0.85em', display: 'block', lineHeight: '1.4' }}>
                            The unlock code will remain hidden for this duration if a session is aborted.
                        </Text>
                    </div>
                )}
            </Card>
        </Space>
    );

    const steps = [
        { title: 'Connection', icon: <WifiOutlined /> },
        { title: 'Play Style', icon: <DashboardOutlined /> },
        { title: 'Deterrents', icon: <SafetyCertificateOutlined /> },
    ];

    return (
        <Spin spinning={isProvisioning}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Steps current={currentStep} items={steps} size="small" labelPlacement="horizontal" />

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    preserve={true}
                    initialValues={{
                        ch1Enabled: true,
                        ch2Enabled: true,
                        playStyle: 'standard',
                        minSessionDuration: 15,
                        maxSessionDuration: 240,
                        enableStreaks: true,
                        enablePaybackTime: true,
                        paybackStrategy: 'DETERRENT_FIXED',
                        paybackTimeMinutes: 30, // Standard Default
                        paybackMinMinutes: 15, // Standard Default
                        paybackMaxMinutes: 45, // Standard Default
                        enableRewardCode: true,
                        rewardStrategy: 'DETERRENT_FIXED',
                        rewardPenaltyMinutes: 15, // Standard Default
                        rewardPenaltyMinMinutes: 5, // Standard Default
                        rewardPenaltyMaxMinutes: 20, // Standard Default
                    }}
                >
                    {error && (
                        <Form.Item>
                            <Alert message="Error" description={error} type="error" showIcon />
                        </Form.Item>
                    )}

                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>{renderConnectionStep()}</div>
                        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>{renderPlayStyleStep()}</div>
                        <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>{renderDeterrentsStep()}</div>
                    </div>

                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                        {currentStep > 0 && (
                            <Button onClick={handlePrev} icon={<LeftOutlined />}>
                                Back
                            </Button>
                        )}
                        {currentStep < 2 && (
                            <Button type="primary" onClick={handleNext} icon={<RightOutlined />} style={{ marginLeft: 'auto' }}>
                                Next
                            </Button>
                        )}
                        {currentStep === 2 && (
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={isProvisioning}
                                icon={<SaveOutlined />}
                                style={{ marginLeft: 'auto' }}
                            >
                                Provision
                            </Button>
                        )}
                    </div>
                </Form>
            </Space>
        </Spin>
    );
};
