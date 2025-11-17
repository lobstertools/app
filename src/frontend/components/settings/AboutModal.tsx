import {
    InfoCircleOutlined,
    GlobalOutlined,
    GithubOutlined,
    MailOutlined,
    BookOutlined,
} from '@ant-design/icons';
import { Modal, Row, Col, Button, Space, Divider, Typography } from 'antd';
import { useAppRuntime } from '../../context/useAppRuntime';

const { Title, Text } = Typography;

import lobsterLogo from '../../assets/lobster-logo.png';

export const AboutAppModal = () => {
    // Get state from the (mock) hook instead of props
    const { version, isAboutModalOpen, setAboutModalOpen } = useAppRuntime();

    // Create the onClose handler inside the component
    const onClose = () => {
        setAboutModalOpen(false);
    };

    return (
        <Modal
            open={isAboutModalOpen} // Use state from hook
            onCancel={onClose} // Use internal handler
            title={
                <Row gutter={12} align="middle">
                    <Col>
                        <InfoCircleOutlined />
                    </Col>
                    <Col>About Lobster</Col>
                </Row>
            }
            footer={
                <Button type="primary" onClick={onClose}>
                    Close
                </Button>
            }
        >
            <Space
                direction="vertical"
                align="center"
                style={{ width: '100%', padding: '16px 0' }}
            >
                {/* Logo and Title */}
                <Row align="middle" gutter={16}>
                    <Col>
                        <img
                            src={lobsterLogo}
                            alt="Lobster Logo"
                            style={{
                                width: 64,
                                height: 'auto',
                                borderRadius: '8px',
                            }}
                        />
                    </Col>
                    <Col>
                        <Title level={3} style={{ margin: 0 }}>
                            Lobster
                        </Title>
                        <Text type="secondary">Version {version}</Text>
                    </Col>
                </Row>

                <Divider style={{ margin: '16px 0' }} />

                {/* Links */}
                <Space
                    direction="vertical"
                    style={{ width: '100%' }}
                    size="middle"
                >
                    <Button
                        href="https://lobster-tools.github.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<GlobalOutlined />}
                        block
                    >
                        Project Website
                    </Button>
                    <Button
                        href="https://github.com/lobster-tools"
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<GithubOutlined />}
                        block
                    >
                        Source Code (GitHub)
                    </Button>
                    <Button
                        href="mailto:lobster@pobox.com"
                        icon={<MailOutlined />}
                        block
                    >
                        Contact Email
                    </Button>

                    <Divider style={{ margin: '16px 0' }} />

                    {/* License */}
                    <Space align="center" direction="vertical" size={0}>
                        <BookOutlined style={{ fontSize: 20, color: '#888' }} />
                        <Text type="secondary" style={{ marginTop: 8 }}>
                            Apache 2.0 Open Source License
                        </Text>
                    </Space>
                </Space>
            </Space>
        </Modal>
    );
};
