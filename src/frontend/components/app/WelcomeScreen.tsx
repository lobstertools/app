import { Button, Divider, Modal, Space, Typography, theme as antdTheme, Checkbox, Steps, Col, Row } from 'antd';
import {
    SafetyCertificateOutlined,
    RocketOutlined,
    ToolOutlined,
    StarOutlined,
    DownloadOutlined,
    UsbOutlined,
    CheckCircleOutlined,
    WarningOutlined,
} from '@ant-design/icons';

import { useState } from 'react';
import { useDeviceManager } from '../../context/useDeviceManager';
import { useAppRuntime } from '../../context/useAppRuntime';

const { Title, Text, Paragraph } = Typography;

import lobsterLogo from '../../assets/lobster-logo.png';
import masterLockImage from '../../assets/Master_1500i.jpg';

// --- Step 1 Content ---
const WelcomeStep = () => {
    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={24} align="middle">
                {/* Left Column (Logo) */}
                <Col flex="none">
                    <img src={lobsterLogo} alt="Lobster Logo" style={{ width: 100, height: 'auto' }} />
                </Col>
                {/* Right Column (Text) */}
                <Col flex="auto">
                    <Space direction="vertical" size={0}>
                        <Title level={2} style={{ margin: 0 }}>
                            Welcome to Lobster
                        </Title>
                        <Paragraph type="secondary" style={{ fontSize: 16, paddingTop: 4 }}>
                            This app is the control center for a strict, DIY self-bondage system using a Wi-Fi-connected
                            <strong> MagLock</strong>.
                        </Paragraph>
                    </Space>
                </Col>
            </Row>
            <Divider />
            <Title level={4}>Designed for Strictness</Title>
            <Paragraph>
                This system is "strict" because it's designed to remove loopholes. Cheating is not an option.
                <ul>
                    <li>
                        <strong>Reboot-as-Abort:</strong> If the device loses power (e.g., you unplug it) while a session is active, it's
                        treated as an <strong>abort</strong>.
                    </li>
                    <li>
                        <strong>Strict Abort Logic:</strong> Aborting resets session streak, tracks the abort, and can apply a
                        <strong> "time payback" penalty</strong> to your
                        <i> next</i> session.
                    </li>
                    <li>
                        <strong>Persistent Stats:</strong> All stats are saved on the device itself.
                    </li>
                </ul>
            </Paragraph>
        </Space>
    );
};

// --- Step 2 Content---
const HardwareStep = () => {
    const { token } = antdTheme.useToken();

    // Style for the three columns
    const blockStyle: React.CSSProperties = {
        border: `1px solid ${token.colorBorder}`,
        padding: '24px',
        borderRadius: token.borderRadiusLG,
        backgroundColor: token.colorBgContainer,
        height: '100%',
    };

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Title level={4}>Your Hardware Journey</Title>
            <Paragraph>
                This is a "Bring Your Own Hardware" system. This app is the
                <strong> software</strong>; you must first build and flash the
                <strong> hardware</strong>.
            </Paragraph>
            <Paragraph>
                Get the complete parts list, build guides, and firmware at our website:
                <br />
                <Button
                    type="link"
                    href="https://lobstertools.github.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        padding: 0,
                        height: 'auto',
                        lineHeight: 'inherit',
                        fontSize: '1.1em',
                    }}
                >
                    <strong>https://lobstertools.github.io</strong>
                </Button>
            </Paragraph>

            <Divider />

            <Row gutter={[24, 24]}>
                {/* Column 1: Build */}
                <Col span={8}>
                    <Space direction="vertical" style={blockStyle}>
                        <Title level={5} style={{ marginTop: 0 }}>
                            <ToolOutlined style={{ color: token.colorPrimary }} /> 1. Build Hardware
                        </Title>
                        <Paragraph type="secondary">
                            Follow the website guide to assemble your
                            <strong> MagLock</strong> and the
                            <strong> ESP32 Controller</strong>. This requires basic soldering and wiring.
                        </Paragraph>
                    </Space>
                </Col>

                {/* Column 2: Download */}
                <Col span={8}>
                    <Space direction="vertical" style={blockStyle}>
                        <Title level={5} style={{ marginTop: 0 }}>
                            <DownloadOutlined style={{ color: token.colorPrimary }} /> 2. Download Firmware
                        </Title>
                        <Paragraph type="secondary">
                            From the same website, download the latest
                            <strong> firmware</strong> (a <code>.bin</code> file) to your computer.
                        </Paragraph>
                    </Space>
                </Col>

                {/* Column 3: Flash */}
                <Col span={8}>
                    <Space
                        direction="vertical"
                        style={{
                            ...blockStyle,
                        }}
                    >
                        <Title level={5} style={{ marginTop: 0 }}>
                            <UsbOutlined style={{ color: token.colorPrimary }} /> 3. Flash (In This App)
                        </Title>
                        <Paragraph type="secondary">
                            Plug your built controller into this computer via USB.
                            <br />
                            Open the <strong>Device Manager</strong> (⚙️ icon) &gt; <strong>Device Flasher</strong> tab to upload the
                            firmware.
                        </Paragraph>
                    </Space>
                </Col>
            </Row>
        </Space>
    );
};

// --- Step 3 Content ---
const RewardStep = () => {
    const { token } = antdTheme.useToken();
    return (
        <Row gutter={[32, 16]} align="top" style={{ width: '100%' }}>
            {/* Left Column: Explanation */}
            <Col span={14}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Title level={4} style={{ margin: 0 }}>
                        The Reward Lock
                    </Title>
                    <Paragraph>
                        The Lobster system is built around a powerful incentive: the
                        <strong> Reward Lock</strong>.
                    </Paragraph>
                    <Paragraph>
                        You lock away something you <strong>want</strong> (like keys or a treat) in a separate box using this specific
                        <strong> Master Lock 1500iD Speed Dial™</strong>.
                    </Paragraph>

                    <Title level={5} style={{ marginTop: 2, marginBottom: 2 }}>
                        How It Works
                    </Title>

                    {/* Step 1: Generate */}
                    <Row wrap={false} align="top">
                        <Col flex="32px">
                            <Text
                                strong
                                style={{
                                    fontSize: 18,
                                    color: token.colorPrimary,
                                }}
                            >
                                1.
                            </Text>
                        </Col>
                        <Col flex="auto">
                            <Text strong>Generate Code:</Text> The <strong>controller</strong> generates a new, random directional code.
                        </Col>
                    </Row>

                    {/* Step 2: Program */}
                    <Row wrap={false} align="top">
                        <Col flex="32px">
                            <Text
                                strong
                                style={{
                                    fontSize: 18,
                                    color: token.colorPrimary,
                                }}
                            >
                                2.
                            </Text>
                        </Col>
                        <Col flex="auto">
                            <Text strong>Program Lock:</Text> You manually <strong>program this code</strong> into your Master Lock and use
                            it to lock away your reward.
                        </Col>
                    </Row>

                    {/* Step 3: Start */}
                    <Row wrap={false} align="top">
                        <Col flex="32px">
                            <Text
                                strong
                                style={{
                                    fontSize: 18,
                                    color: token.colorPrimary,
                                }}
                            >
                                3.
                            </Text>
                        </Col>
                        <Col flex="auto">
                            <Text strong>Start Session:</Text> The app hides the code while the session is active.
                        </Col>
                    </Row>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* Outcome 1: Success */}
                    <Row wrap={false} align="top">
                        <Col flex="32px">
                            <CheckCircleOutlined
                                style={{
                                    color: token.colorSuccess,
                                    fontSize: 20,
                                    marginTop: 4,
                                }}
                            />
                        </Col>
                        <Col flex="auto">
                            <Text strong>On Success:</Text>
                            <Paragraph style={{ margin: 0 }} type="secondary">
                                The combination is revealed <strong>immediately</strong>.
                            </Paragraph>
                        </Col>
                    </Row>

                    {/* Outcome 2: Abort */}
                    <Row wrap={false} align="top">
                        <Col flex="32px">
                            <WarningOutlined
                                style={{
                                    color: token.colorError,
                                    fontSize: 20,
                                    marginTop: 4,
                                }}
                            />
                        </Col>
                        <Col flex="auto">
                            <Text strong>On Abort:</Text>
                            <Paragraph style={{ margin: 0 }} type="secondary">
                                The combination is <strong>delayed</strong> by a penalty time (e.g., 2 hours).
                            </Paragraph>
                        </Col>
                    </Row>
                </Space>
            </Col>

            {/* Right Column: Image */}
            <Col span={10}>
                <img
                    src={masterLockImage}
                    alt="Master Lock 1500iD Speed Dial"
                    style={{
                        width: '100%',
                        maxWidth: '300px',
                        display: 'block',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        borderRadius: token.borderRadiusLG,
                        marginTop: '20px',
                    }}
                />
            </Col>
        </Row>
    );
};

// --- Step 4 Content ---
const SafetyStep = () => {
    const { token } = antdTheme.useToken();
    return (
        <Row gutter={[32, 16]} align="top" style={{ width: '100%' }}>
            {/* Left Column: Explanation */}
            <Col span={14}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Title level={4} style={{ margin: 0 }}>
                        Your Safety: The Abort Pedal
                    </Title>
                    <Paragraph>
                        Despite its strictness, your safety is the #1 priority. The hardware instructions include building a physical
                        <strong> "Abort Pedal"</strong> (a foot pedal or large button).
                    </Paragraph>
                    <Paragraph>
                        This pedal is your <strong>emergency safety release</strong>. It connects directly to the controller and will
                        <strong> immediately</strong> cut power to the MagLock, even if your Wi-Fi or computer fails.
                    </Paragraph>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* Consequence Block */}
                    <Row wrap={false} align="top">
                        <Col flex="32px">
                            <WarningOutlined
                                style={{
                                    color: token.colorError,
                                    fontSize: 20,
                                    marginTop: 4,
                                }}
                            />
                        </Col>
                        <Col flex="auto">
                            <Text strong>This is still an Abort</Text>
                            <Paragraph style={{ margin: 0 }} type="secondary">
                                Using the pedal follows the same strict logic (your reward will be delayed), but it guarantees you can
                                <strong> always</strong> get out in an emergency.
                            </Paragraph>
                        </Col>
                    </Row>
                </Space>
            </Col>

            {/* Right Column: Icon */}
            <Col span={10}>
                <Space
                    direction="vertical"
                    align="center"
                    style={{
                        width: '100%',
                        padding: '32px 16px',
                        marginTop: '20px',
                        backgroundColor: token.colorBgContainer,
                        border: `1px solid ${token.colorBorder}`,
                        borderRadius: token.borderRadiusLG,
                    }}
                >
                    <SafetyCertificateOutlined
                        style={{
                            fontSize: '64px',
                            color: token.colorError,
                        }}
                    />
                    <Title level={5} style={{ margin: 0, marginTop: 16 }}>
                        Hardware Emergency Release
                    </Title>
                    <Text type="secondary" style={{ textAlign: 'center' }}>
                        Always connected, always on.
                    </Text>
                </Space>
            </Col>
        </Row>
    );
};

// --- Steps Configuration ---
const steps = [
    {
        title: 'Welcome',
        icon: <RocketOutlined />,
        content: <WelcomeStep />,
    },
    {
        title: 'Hardware Setup',
        icon: <ToolOutlined />,
        content: <HardwareStep />,
    },
    {
        title: 'The Reward Lock',
        icon: <StarOutlined />,
        content: <RewardStep />,
    },
    {
        title: 'Safety',
        icon: <SafetyCertificateOutlined />,
        content: <SafetyStep />,
    },
];

/**
 * A multi-step welcome modal that explains the app's purpose and features.
 */
export const WelcomeScreen = () => {
    const { showWelcomeOnStartup, setShowWelcomeOnStartup, isWelcomeGuideOpen, setWelcomeGuideOpen } = useAppRuntime();
    const { openDeviceModal } = useDeviceManager();

    const [dontShowAgain, setDontShowAgain] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const isOpen = showWelcomeOnStartup || isWelcomeGuideOpen;

    /**
     * Handles closing the modal from 'x' or 'Cancel'.
     */
    const handleClose = () => {
        // Save the persistent setting based on the checkbox.
        setShowWelcomeOnStartup(!dontShowAgain);
        setWelcomeGuideOpen(false);
        setCurrentStep(0);
    };

    /**
     * Handles the final "Get Started" button click.
     */
    const handleGetStarted = () => {
        handleClose();
        setTimeout(() => {
            openDeviceModal();
        }, 300);
    };

    // --- Multi-Step Footer ---
    const modalFooter = (
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center">
            <Checkbox checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)}>
                Don't show this again
            </Checkbox>

            <Space>
                {currentStep > 0 && (
                    <Button size="large" onClick={() => setCurrentStep(currentStep - 1)}>
                        Back
                    </Button>
                )}
                {currentStep < steps.length - 1 && (
                    <Button type="primary" size="large" onClick={() => setCurrentStep(currentStep + 1)}>
                        Next
                    </Button>
                )}
                {currentStep === steps.length - 1 && (
                    <Button type="primary" size="large" onClick={handleGetStarted}>
                        Get Started
                    </Button>
                )}
            </Space>
        </Space>
    );

    return (
        <Modal open={isOpen} closable={true} onCancel={handleClose} footer={modalFooter} width="66%">
            {/* --- Steps and Content Area --- */}
            <Steps
                current={currentStep}
                items={steps.map((item) => ({
                    key: item.title,
                    title: item.title,
                    icon: item.icon,
                }))}
                style={{ marginBottom: 24, marginTop: 24 }}
            />
            <div
                style={{
                    // Fixed height to prevent button jumping
                    height: '55vh',
                    overflowY: 'auto',
                    padding: '24px 8px',
                }}
            >
                {steps[currentStep].content}
            </div>
        </Modal>
    );
};
