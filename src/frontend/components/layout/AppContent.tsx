import { Layout, Typography, Card, Space, Row, Col, theme as antdTheme } from 'antd';
import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';
import { StatusBadge } from '../device/StatusBadge';
import { DeviceManagerModal } from '../device/DeviceManagerModal';
import { RewardDisplay } from '../reward/RewardDisplay';
import { SessionConfiguration } from '../session/SessionConfiguration';
import { SessionLockModal } from '../session/SessionLockModal';
import { DeviceMenu } from '../device/DeviceMenu';
import { DeviceLogModal } from '../device/DeviceLogModal';
import { SessionStats } from '../session/SessionStats';
import { WelcomeScreen } from '../app/WelcomeScreen';
import { ApplicationSettingsMenu } from '../app/ApplicationSettingsMenu';

const { Header, Content } = Layout;
const { Title } = Typography;

import lobsterLogo from '../../assets/lobster-logo.png';
import { ApplicationSettingsModal } from '../app/ApplicationSettingsModal';
import { DeviceSettingsModal } from '../device/DeviceSettingsModal';
import { BuildWarningBanner } from './BuildWarningBanner';
import { AboutAppModal } from '../app/AboutModal';
import { TestSessionModal } from '../session/TestSessionModal';
import { ReadinessModal } from '../device/ReadinessModal';

/**
 * Inner component to hold the main layout and logic.
 */
export const AppContent = ({ theme, toggleTheme }: { theme: 'light' | 'dark'; toggleTheme: () => void }) => {
    const { currentState } = useSession();
    const { activeDevice } = useDeviceManager();
    const { token } = antdTheme.useToken();

    // Determine if the Reward Code feature is enabled on the device
    const enableRewardCode = activeDevice?.deterrents?.enableRewardCode ?? true;

    // Determine layout mode:
    // 1. If state is 'armed', we always go full width for focus.
    // 2. If 'enableRewardCode' is FALSE, we always go full width because there is no reward panel to show.
    const useFullWidthLayout = currentState === 'armed' || !enableRewardCode;

    return (
        <>
            <BuildWarningBanner />

            <Layout
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Top Header Bar */}
                <Header
                    style={{
                        padding: '0 24px',
                        borderBottom: `1px solid ${token.colorSplit}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: token.colorBgContainer,
                    }}
                >
                    <img src={lobsterLogo} alt="Lobster Logo" width={30} />
                    <Title
                        level={3}
                        style={{
                            margin: '0 24px 0 0',
                            textWrap: 'nowrap',
                        }}
                    >
                        Lobster
                    </Title>

                    <SessionStats />
                    <div style={{ flex: 1 }} />

                    <Space size={12} align="center">
                        <StatusBadge />
                        <DeviceMenu />
                        <ApplicationSettingsMenu theme={theme} toggleTheme={toggleTheme} />
                    </Space>
                </Header>

                {/* Main Content Area */}
                <Content style={{ padding: '24px', flex: 1 }}>
                    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                        <Space direction="vertical" size="large" style={{ width: '100%' }}>
                            <Row gutter={[24, 24]}>
                                {useFullWidthLayout ? (
                                    // Full width layout (Armed OR Reward Code Disabled)
                                    <Col xs={24} lg={24}>
                                        <Card title="Session Configuration" style={{ minHeight: '100%' }}>
                                            <SessionConfiguration />
                                        </Card>
                                    </Col>
                                ) : (
                                    // Standard 50/50 layout (Ready/Locked/etc AND Reward Code Enabled)
                                    <>
                                        <Col xs={24} lg={12}>
                                            <Card title="Session Configuration" style={{ minHeight: '100%' }}>
                                                <SessionConfiguration />
                                            </Card>
                                        </Col>
                                        <Col xs={24} lg={12}>
                                            <Card title="Reward Lock Code" style={{ minHeight: '100%' }}>
                                                <RewardDisplay />
                                            </Card>
                                        </Col>
                                    </>
                                )}
                            </Row>
                        </Space>
                    </div>
                </Content>

                {/* Global Modals */}
                <SessionLockModal />
                <TestSessionModal />
                <DeviceManagerModal />
                <DeviceLogModal />
                <WelcomeScreen />
                <ReadinessModal />
                <ApplicationSettingsModal />
                <DeviceSettingsModal />
                <AboutAppModal />
            </Layout>
        </>
    );
};
