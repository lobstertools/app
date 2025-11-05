import { useSession } from '../../context/SessionContext';
import { red } from '@ant-design/colors';
import {
    LockOutlined,
    FireOutlined,
    LoadingOutlined,
    ClockCircleOutlined,
    LeftOutlined,
    RightOutlined,
} from '@ant-design/icons';
import {
    Typography,
    Button,
    Card,
    Space,
    Spin,
    Row,
    Col,
    Statistic,
    List,
    theme as antdTheme,
} from 'antd';
import { useState, useEffect } from 'react';
import { RewardImage } from './RewardImage';

const { Title, Text } = Typography;

/**
 * Renders the reward image and history navigation.
 * This is the main component on the right side of the screen.
 */
export const RewardDisplay = () => {
    const { currentState, rewardHistory } = useSession();

    const [selectedIndex, setSelectedIndex] = useState(0); // For history
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
    };

    const currentReward = rewardHistory[selectedIndex];

    /**
     * Instructions for opening the physical lock.
     */
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

    // Show a placeholder if the session is active
    if (
        currentState === 'locked' ||
        currentState === 'aborted' ||
        currentState === 'countdown'
    ) {
        let message = 'The reward code is hidden.';
        let icon = (
            <LockOutlined
                style={{ fontSize: '32px', color: token.colorTextDisabled }}
            />
        );

        if (currentState === 'locked') {
            message =
                'The reward code is hidden and will be revealed once the timer ends.';
        } else if (currentState === 'aborted') {
            message =
                'Session Aborted. The reward code will be revealed after the penalty cooldown ends.';
            icon = <FireOutlined style={{ fontSize: '32px', color: red[5] }} />;
        } else if (currentState === 'countdown') {
            message =
                'The reward code will be generated after the session starts and completes.';
            icon = (
                <LoadingOutlined
                    style={{ fontSize: '32px', color: token.colorTextDisabled }}
                />
            );
        }

        return (
            <div style={placeholderStyles}>
                {' '}
                {icon}{' '}
                <Text
                    type="secondary"
                    style={{ marginTop: '16px', textAlign: 'center' }}
                >
                    {' '}
                    {message}{' '}
                </Text>{' '}
            </div>
        );
    }

    // Show the reward image and history
    if (currentReward) {
        return (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <RewardImage code={currentReward.code} />
                <Card
                    size="small"
                    style={{ backgroundColor: token.colorFillAlter }}
                >
                    <Row justify="space-between" align="middle">
                        <Col>
                            <Statistic
                                title="Code Generated On"
                                value={new Date(
                                    currentReward.timestamp
                                ).toLocaleString('nl-NL')}
                                prefix={<ClockCircleOutlined />}
                                valueStyle={{ fontSize: '1rem' }}
                            />
                        </Col>
                        {/* History navigation buttons */}
                        {rewardHistory.length > 1 && (
                            <Col>
                                <Space>
                                    <Button
                                        icon={<LeftOutlined />}
                                        onClick={() =>
                                            setSelectedIndex((s) => s + 1)
                                        }
                                        disabled={
                                            selectedIndex >=
                                            rewardHistory.length - 1
                                        }
                                    />
                                    <Text>
                                        {selectedIndex + 1} /{' '}
                                        {rewardHistory.length}
                                    </Text>
                                    <Button
                                        icon={<RightOutlined />}
                                        onClick={() =>
                                            setSelectedIndex((s) => s - 1)
                                        }
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

    // Show loading spinners if no reward is loaded yet
    if (currentState === 'ready' && rewardHistory.length === 0) {
        return (
            <div style={placeholderStyles}>
                <Spin tip="Waiting for device to generate new reward code..." />
            </div>
        );
    }

    return (
        <div style={placeholderStyles}>
            <Spin
                tip={
                    currentState === 'completed'
                        ? 'Loading Your Reward!'
                        : 'Loading Reward Data...'
                }
            />
        </div>
    );
};
