import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import {
    Layout,
    Typography,
    Button,
    Card,
    Space,
    Row,
    Col,
    Tooltip,
    theme as antdTheme,
    Tag,
} from 'antd';

import { useSession } from '../../context/useSessionContext';
import { StatusBadge } from '../device/StatusBadge';
import { DeviceManagerModal } from '../device/DeviceManagerModal';
import { RewardDisplay } from '../reward/RewardDisplay';
import { SessionControl } from '../session/SessionControl';
import { SessionLockModal } from '../session/SessionLockModal';
import { DeviceConfigurationMenu } from '../device/DeviceConfigurationMenu';
import { DeviceLogModal } from '../device/DeviceLogModal';
import { SessionStats } from '../session/SessionStats';

const { Header, Content } = Layout;
const { Title } = Typography;

/**
 * Inner component to hold the main layout and logic.
 */
export const AppContent = ({
    theme,
    toggleTheme,
}: {
    theme: 'light' | 'dark';
    toggleTheme: () => void;
}) => {
    const { currentState } = useSession();

    const { token } = antdTheme.useToken();

    return (
        <>
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
                    <img
                        src="/public/lobster-logo.png"
                        alt="Lobster Logo"
                        width={30}
                    />
                    <Title level={3} style={{ margin: 0 }}>
                        Lobster
                    </Title>
                    <Tag color="red" style={{ marginRight: '32px' }}>
                        Beta
                    </Tag>
                    <SessionStats />
                    <div style={{ flex: 1 }} />

                    <Space size={12} align="center">
                        <StatusBadge />
                        <DeviceConfigurationMenu />
                    </Space>

                    <Tooltip
                        title={
                            theme === 'light'
                                ? 'Switch to Dark Mode'
                                : 'Switch to Light Mode'
                        }
                    >
                        <Button
                            icon={
                                theme === 'light' ? (
                                    <MoonOutlined />
                                ) : (
                                    <SunOutlined />
                                )
                            }
                            onClick={toggleTheme}
                            shape="circle"
                        />
                    </Tooltip>
                </Header>

                {/* Main Content Area */}
                <Content style={{ padding: '24px', flex: 1 }}>
                    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                        <Space
                            direction="vertical"
                            size="large"
                            style={{ width: '100%' }}
                        >
                            <Row gutter={[24, 24]}>
                                {currentState === 'countdown' ? (
                                    // Special layout for countdown: full width
                                    <Col xs={24} lg={24}>
                                        <Card
                                            title="Session Control"
                                            style={{ minHeight: '100%' }}
                                        >
                                            <SessionControl />
                                        </Card>
                                    </Col>
                                ) : (
                                    // Standard 50/50 layout
                                    <>
                                        <Col xs={24} lg={12}>
                                            <Card
                                                title="Session Control"
                                                style={{ minHeight: '100%' }}
                                            >
                                                <SessionControl />
                                            </Card>
                                        </Col>
                                        <Col xs={24} lg={12}>
                                            <Card
                                                title="Reward Lock Code"
                                                style={{ minHeight: '100%' }}
                                            >
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
                <DeviceManagerModal />
                <DeviceLogModal />
            </Layout>
        </>
    );
};
