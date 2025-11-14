import {
    Button,
    Divider,
    Modal,
    Space,
    Typography,
    theme as antdTheme,
    Checkbox,
    Steps,
} from 'antd';
import {
    SafetyCertificateOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    RocketOutlined,
    ToolOutlined,
    StarOutlined,
} from '@ant-design/icons';
import { useAppRuntime } from '../../context/AppRuntimeContext';
import { useState } from 'react';
import { useDeviceManager } from '../../context/DeviceManagerContext';
import { LobsterLogo } from '../icons/MagLockIcon';

const { Title, Text, Paragraph } = Typography;

// --- Step 1 Content (Unchanged) ---
const WelcomeStep = () => {
    const { token } = antdTheme.useToken();
    return (
        <Space
            direction="vertical"
            style={{ width: '100%' }}
            size="large"
        >
            <Space
                direction="vertical"
                style={{ width: '100%', textAlign: 'center' }}
                size="middle"
            >
                <LobsterLogo size={120}/>

                <Title level={2} style={{ margin: 0 }}>
                    Welcome to Lobster
                </Title>
                <Paragraph
                    type="secondary"
                    style={{ fontSize: 16, maxWidth: 500, margin: '0 auto' }}
                >
                    This app is the control center for a strict, DIY
                    self-bondage system using a Wi-Fi-connected
                    <strong> MagLock</strong>.
                </Paragraph>
            </Space>
            <Divider />
            <Title level={4}>
                <WarningOutlined style={{ color: token.colorWarning }} />{' '}
                Designed for Strictness
            </Title>
            <Paragraph>
                This system is "strict" because it's designed to remove
                loopholes. Cheating is not an option.
                <ul>
                    <li>
                        <strong>Reboot-as-Abort:</strong> If the device loses
                        power (e.g., you unplug it) while a session is active,
                        it's treated as an <strong>abort</strong>.
                    </li>
                    <li>
                        <strong>Strict Abort Logic:</strong> Aborting resets your
                        session streak, tracks the abort, and can apply a
                        <strong> "time payback" penalty</strong> to your
                        <i> next</i> session.
                    </li>
                    <li>
                        <strong>Persistent Stats:</strong> All stats are saved on
                        the device itself. They cannot be reset by clearing app
                        data.
                    </li>
                </ul>
            </Paragraph>
        </Space>
    );
};

// --- Step 2 Content (Unchanged) ---
const HardwareStep = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Title level={4}>Step 1: Build Your Hardware</Title>
        <Paragraph>
            This is a "Bring Your Own Hardware" system. This app is the
            <strong> software</strong>; you must first build the
            <strong> hardware</strong>:
            <ol>
                <li>A <strong>MagLock</strong> (or other electronic lock).</li>
                <li>An <strong>ESP32</strong>-based lock controller with a relay.</li>
            </ol>
                        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
                Our companion website has the full parts list, wiring
                diagrams, and step-by-step instructions.
            </Text>
        </Paragraph>

        <Divider />

        <Title level={4}>Step 2: Flash the Lobster Firmware</Title>
        <Paragraph>
            Your ESP32 controller needs the official Lobster firmware. You can
            flash it directly from this app:
            <ol>
                <li>Assemble your ESP32 and plug it into your computer via USB.</li>
                <li>
                    Open the <strong>Device Manager</strong> (⚙️ icon) in this
                    app.
                </li>
                <li>
                    Go to the <strong>Device Flasher</strong> tab.
                </li>
                <li>
                    Select the correct <strong>serial port</strong> and the
                    latest <strong>firmware</strong> file.
                </li>
                <li>
                    Click <strong>Flash</strong>.
                </li>
            </ol>
        </Paragraph>
    </Space>
);

// --- Step 3 Content (Unchanged) ---
const RewardStep = () => {
    const { token } = antdTheme.useToken();
    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Title level={4}>The Core Concept: The Reward Lock</Title>
            <Paragraph>
                The Lobster system is built around a powerful incentive:
                <strong> The Reward Lock</strong>.
            </Paragraph>
            <Paragraph>
                The idea is to lock away something you <strong>want</strong>,
                making your successful release the <strong>only</strong> way to
                get it. This "reward" could be the key to your other padlocks, a
                favorite treat, or anything else you desire.
            </Paragraph>
            <Paragraph>
                You'll need a
                <strong> Master Lock No. 1500iD Speed Dial™</strong> (the
                directional one) and a separate
                <strong> lockable box</strong>.
            </Paragraph>
                        <Paragraph>
                <strong>How it works:</strong>
                <ul>
                    <li>
                        <Text strong>Before you start:</Text> The app generates a
                        <strong> new, random directional combination</strong>. You
                        must manually set your Master Lock to this new combination
                        <i> before</i> you lock the box.
                    </li>
                    <li>
                        <Text strong>During the session:</Text> You are locked in
                        by the MagLock, and the combination is hidden.
                    </li>
                    <li>
                        <Text strong>
                            <CheckCircleOutlined
                                style={{ color: token.colorSuccess }}
                            /> On Success:
                        </Text>
                        When you successfully complete a full session, the app
                        reveals the directional combination.
                    </li>
                    <li>
                        <Text strong>
                            <WarningOutlined
                                style={{ color: token.colorError }}
                            /> On Abort:
                        </Text>
                        If you abort, the combination is
                        <strong> lost forever</strong>. The only way to get a new
                        reward is to start and complete an entirely
                        <strong> new</strong> session.
                    </li>
                </ul>
            </Paragraph>
        </Space>
    );
};

// --- Step 4 Content (Unchanged) ---
const SafetyStep = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Title level={4}>
            <SafetyCertificateOutlined style={{ color: 'red' }} /> Your
            Safety: The Abort Padel
        </Title>
        <Paragraph>
            Despite its strictness, your safety is the #1 priority. The
            hardware instructions include building a physical
            <strong> "Abort Padel"</strong> (a foot pedal or large button).
        </Paragraph>
                <Paragraph>
            This padel is your <strong>emergency safety release</strong>. It
            connects directly to your ESP32 and will
            <strong> immediately</strong> cut power to the MagLock, ending the
            session, even if your Wi-Fi or computer fails.
        </Paragraph>
        <Paragraph>
            <strong>Important:</strong> Using the safety padel is still an
            <strong> abort</strong>. It follows the same strict logic (you will
            lose your reward), but it guarantees you can
            <strong> always</strong> get out in an emergency.
        </Paragraph>
    </Space>
);

// --- Steps Configuration (Unchanged) ---
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
    const {
        showWelcomeOnStartup,
        setShowWelcomeOnStartup,
        isWelcomeGuideOpen,
        setWelcomeGuideOpen,
    } = useAppRuntime();
    // Get the function to open the device manager
    const { openDeviceModal } = useDeviceManager();

    // [!code ++]
    // Local state for the checkbox.
    // Default to 'true' (checked), so the default action is
    // to NOT show this again.
    const [dontShowAgain, setDontShowAgain] = useState(true);
    // [!code --]
    // Local state for the current step
    const [currentStep, setCurrentStep] = useState(0);

    // [!code ++]
    // We remove the useEffect that was fighting with the local state.
    // The user's checkbox click is now the only source of truth.
    // [!code --]

    // The modal is open if it's the first launch OR if it's been
    // manually re-opened from the menu.
    const isOpen = showWelcomeOnStartup || isWelcomeGuideOpen;

    /**
     * Handles closing the modal from 'x' or 'Cancel'.
     */
    const handleClose = () => {
        // [!code ++]
        // Save the persistent setting based on the checkbox.
        // !dontShowAgain:
        // - If box is CHECKED (true), save FALSE (don't show on startup).
        // - If box is UNCHECKED (false), save TRUE (show on startup).
        setShowWelcomeOnStartup(!dontShowAgain);
        // [!code --]
        // Close the manual-open modal
        setWelcomeGuideOpen(false);
        // Reset to first step for next time
        setCurrentStep(0);
    };

    /**
     * Handles the final "Get Started" button click.
     */
    const handleGetStarted = () => {
        handleClose(); // <-- This closes the welcome modal and saves state
        
        // [!code ++]
        // Fix the race condition by delaying the opening of the next modal.
        // This gives React time to re-render and the modal fade-out
        // animation to start.
        setTimeout(() => {
            openDeviceModal(); // Then this opens the device manager
        }, 300);
        // [!code --]
    };

    // --- Multi-Step Footer ---
    const modalFooter = (
        <Space
            style={{ width: '100%', justifyContent: 'space-between' }}
            align="center"
        >
            <Checkbox
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
            >
                Don't show this again
            </Checkbox>

            <Space>
                {currentStep > 0 && (
                    <Button
                        size="large"
                        onClick={() => setCurrentStep(currentStep - 1)}
                    >
                        Back
                    </Button>
                )}
                {currentStep < steps.length - 1 && (
                    <Button
                        type="primary"
                        size="large"
                        onClick={() => setCurrentStep(currentStep + 1)}
                    >
                        Next
                    </Button>
                )}
                {currentStep === steps.length - 1 && (
                    <Button
                        type="primary"
                        size="large"
                        onClick={handleGetStarted}
                    >
                        Get Started
                    </Button>
                )}
            </Space>
        </Space>
    );

    return (
        <Modal
            open={isOpen}
            closable={true}
            onCancel={handleClose}
            footer={modalFooter}
            width="66%"
        >
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