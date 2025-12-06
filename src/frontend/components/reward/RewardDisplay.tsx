import { useSession } from '../../context/useSessionContext';
import { red } from '@ant-design/colors';
import {
    LockOutlined,
    FireOutlined,
    LoadingOutlined,
    LeftOutlined,
    RightOutlined,
    UsbOutlined,
    DisconnectOutlined,
    ExperimentOutlined,
    IdcardOutlined,
} from '@ant-design/icons';
import { Typography, Button, Card, Space, Spin, Row, Col, Statistic, List, theme as antdTheme } from 'antd';
import { useState, useEffect } from 'react';
import { RewardImage } from './RewardImage';

const { Title, Text } = Typography;

/**
 * Renders the reward image and history navigation.
 * This is the main component on the right side of the screen.
 */
export const RewardDisplay = () => {
    const { currentState, rewardHistory } = useSession();

    const [selectedIndex, setSelectedIndex] = useState(0);
    const { token } = antdTheme.useToken();

    // Reset history index when state changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [rewardHistory, currentState]);

    const placeholderStyles: React.CSSProperties = {
        height: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: token.colorFillAlter,
        borderRadius: '8px',
        border: `1px dashed ${token.colorBorder}`,
        padding: '24px',
        textAlign: 'center',
    };

    const OpeningInstructions = (
        <div style={{ width: '100%' }}>
            <Title level={5}>How to Open the Reward Lock</Title>
            <List
                size="small"
                bordered
                style={{
                    marginTop: '16px',
                    backgroundColor: token.colorFillAlter,
                }}
                dataSource={[
                    'Press the shackle firmly down twice to clear the lock before opening it.',
                    'Enter the combination by sliding the button to each position in the pattern.',
                    'Ensure the button slides all the way in each direction, returning to center before the next move.',
                    'Pull up the shackle to open the lock.',
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
    );

    // --- 1. Handle Connection & Error States ---

    if (currentState === 'no_device_selected') {
        return (
            <div style={placeholderStyles}>
                <Space direction="vertical" align="center" size="middle">
                    <UsbOutlined
                        style={{
                            fontSize: '32px',
                            color: token.colorTextDisabled,
                        }}
                    />
                    <Text type="secondary">No device selected.</Text>
                    <Text type="secondary">Please connect a Lobster Controller to view rewards.</Text>
                </Space>
            </div>
        );
    }

    if (currentState === 'connecting') {
        return (
            <div style={placeholderStyles}>
                <Space direction="vertical" align="center" size="middle">
                    <Spin size="large" />
                    <Text>Connecting to Lobster Controller...</Text>
                </Space>
            </div>
        );
    }

    if (currentState === 'testing') {
        return (
            <div style={placeholderStyles}>
                <Space direction="vertical" align="center" size="middle">
                    <Spin indicator={<ExperimentOutlined />} size="large" />
                    <Text>Testing hardware connection...</Text>
                </Space>
            </div>
        );
    }

    if (currentState === 'device_unreachable' || currentState === 'server_unreachable') {
        return (
            <div style={placeholderStyles}>
                <Space direction="vertical" align="center" size="middle">
                    <DisconnectOutlined style={{ fontSize: '32px', color: token.colorError }} />
                    <Text type="danger" strong>
                        Connection Lost
                    </Text>
                    <Text type="secondary">Unable to communicate with the device.</Text>
                </Space>
            </div>
        );
    }

    // --- 2. Handle Active Session (Hidden Rewards) ---
    // While locked, aborted, or armed (countdown/trigger), the reward is hidden.

    if (currentState === 'locked' || currentState === 'aborted' || currentState === 'armed') {
        let message = 'The reward code is hidden.';
        let icon = <LockOutlined style={{ fontSize: '32px', color: token.colorTextDisabled }} />;

        if (currentState === 'locked') {
            message = 'The reward code is hidden and will be revealed once the timer ends.';
        } else if (currentState === 'aborted') {
            message = 'Session Aborted. The reward code will be revealed after the penalty cooldown ends.';
            icon = <FireOutlined style={{ fontSize: '32px', color: red[5] }} />;
        } else if (currentState === 'armed') {
            // Handles both 'autoCountdown' and 'buttonTrigger'
            message = 'The reward code will be generated after the session starts.';
            icon = <LoadingOutlined style={{ fontSize: '32px', color: token.colorTextDisabled }} />;
        }

        return (
            <div style={placeholderStyles}>
                <Space direction="vertical" align="center" size="middle">
                    {icon}
                    <Text type="secondary">{message}</Text>
                </Space>
            </div>
        );
    }

    // --- 3. Handle Visible Reward (Completed or Ready with history) ---

    const currentReward = rewardHistory[selectedIndex];

    if (currentReward) {
        return (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <RewardImage code={currentReward.code} />
                <Card size="small" style={{ backgroundColor: token.colorFillAlter }}>
                    <Row justify="space-between" align="middle">
                        <Col>
                            <Statistic value={currentReward.checksum} prefix={<IdcardOutlined />} valueStyle={{ fontSize: '1rem' }} />
                            <Text
                                type="secondary"
                                style={{
                                    fontSize: '12px',
                                    display: 'block',
                                    marginTop: '4px',
                                }}
                            >
                                Use this name to verify your reward code.
                            </Text>
                        </Col>
                        {/* History navigation buttons */}
                        {rewardHistory.length > 1 && (
                            <Col>
                                <Space>
                                    <Button
                                        icon={<LeftOutlined />}
                                        onClick={() => setSelectedIndex((s) => s + 1)}
                                        disabled={selectedIndex >= rewardHistory.length - 1}
                                    />
                                    <Text>
                                        {selectedIndex + 1} / {rewardHistory.length}
                                    </Text>
                                    <Button
                                        icon={<RightOutlined />}
                                        onClick={() => setSelectedIndex((s) => s - 1)}
                                        disabled={selectedIndex <= 0}
                                    />
                                </Space>
                            </Col>
                        )}
                    </Row>
                </Card>
                {/* Show opening instructions only when session is complete */}
                {currentState === 'completed' && OpeningInstructions}
            </Space>
        );
    }

    // --- 4. Fallback / Waiting for first generation ---
    // If we are 'ready' but have no history yet.

    return (
        <div style={placeholderStyles}>
            <Space direction="vertical" align="center" size="middle">
                <Text>Waiting for device to generate new reward code...</Text>
            </Space>
        </div>
    );
};
