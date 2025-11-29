import { useSession } from '../../context/useSessionContext';
import { useDeviceManager } from '../../context/useDeviceManager';

import { red, green, yellow } from '@ant-design/colors';
import { Typography, Button, Space, Tooltip, theme as antdTheme, Dropdown, MenuProps } from 'antd';
import {
    StopOutlined,
    ApiOutlined,
    InfoCircleOutlined,
    LoadingOutlined,
    DownOutlined,
    ExperimentOutlined,
    WifiOutlined,
    CloudOutlined,
    DisconnectOutlined,
    FileTextOutlined,
    HddOutlined,
    CheckCircleOutlined,
    UsbOutlined,
    FieldTimeOutlined,
    SlidersOutlined,
    ClockCircleOutlined,
    BulbOutlined,
    FireOutlined,
    GiftOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { DeviceFeature } from '../../../types';

const { Text } = Typography;

/**
 * Diagnostic indicator for connection health, logs, and device actions.
 * Sits in the header.
 */
export const DeviceMenu = () => {
    const { token } = antdTheme.useToken();

    // Get all needed state/functions from useSession
    const { currentState, abortSession, startTestSession } = useSession();

    // Get all needed state/functions from useDeviceManager
    const { connectionHealth, openDeviceLogs, activeDevice, openDeviceSettingsModal } = useDeviceManager();

    // Pulling static config from activeDevice
    const deviceName = activeDevice?.name;
    const displayDeviceAddress = activeDevice?.address || 'N/A';
    const displayPort = activeDevice?.port || 'N/A';

    // Deterrent Logic Extraction
    const deterrents = activeDevice?.deterrents;
    const paybackTimeEnabled = deterrents?.enablePaybackTime || false;
    const streaksEnabled = deterrents?.enableStreaks || false;
    const rewardCodeEnabled = deterrents?.enableRewardCode || false;

    const paybackDurationSeconds = deterrents?.paybackDurationSeconds || 0;
    const paybackTimeMinutes = Math.floor(paybackDurationSeconds / 60);

    const appVersion = activeDevice?.version || 'N/A';
    const appBuildType = activeDevice?.buildType || 'N/A';

    // Calculate display string for enabled channels
    const enabledChannelsString = useMemo(() => {
        if (!activeDevice?.channels) return 'N/A';
        const { ch1, ch2, ch3, ch4 } = activeDevice.channels;
        const list = [];
        if (ch1) list.push('1');
        if (ch2) list.push('2');
        if (ch3) list.push('3');
        if (ch4) list.push('4');

        if (list.length === 0) return 'None';
        if (list.length === 4) return 'All (4)';
        return list.join(', ');
    }, [activeDevice]);

    // --- Health Logic ---
    const { title, icon, description, displayDeviceId } = useMemo(() => {
        let color: string;
        let title: string;
        let icon: React.ReactNode;
        let description: string;
        let displayDeviceId: string;

        if (!activeDevice) {
            color = red[5];
            title = 'No Device';
            icon = <HddOutlined style={{ color: color }} />;
            description = 'Click here to select or provision a device.';
            displayDeviceId = 'N/A';
        } else if (connectionHealth.server.status === 'error') {
            color = red[5];
            title = 'Server Unreachable';
            icon = <CloudOutlined style={{ color: color }} />;
            description = 'The UI cannot reach the server. Check your connection.';
            displayDeviceId = 'N/A';
        } else if (connectionHealth.device.status === 'error') {
            color = yellow[5];
            title = 'Device Unreachable';
            icon = <DisconnectOutlined style={{ color: color }} />;
            description = 'The server is running, but it cannot reach the device.';
            displayDeviceId = deviceName || 'Unknown Device';
        } else if (connectionHealth.server.status === 'pending' || connectionHealth.device.status === 'pending') {
            color = token.colorTextDisabled;
            title = 'Connecting...';
            icon = <LoadingOutlined style={{ color: color }} />;
            description = 'Attempting to connect to the server/device...';
            displayDeviceId = deviceName || 'Connecting...';
        } else {
            // Both server and device status are 'ok'
            color = green[5];
            title = 'Connected';
            icon = <WifiOutlined style={{ color: color }} />;
            description = 'UI, server, and device are all connected.';
            displayDeviceId = deviceName || 'Unknown Device';
        }

        return {
            title,
            icon,
            description,
            displayDeviceId,
        };
    }, [connectionHealth, activeDevice, deviceName, token]);
    // --- END HEALTH LOGIC ---

    // --- Feature Mapping Logic ---

    // LED Tooltip content
    const ledTooltip = (
        <div>
            <Text strong style={{ color: 'white' }}>
                LED Patterns:
            </Text>
            <ul
                style={{
                    paddingLeft: '16px',
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: 'white',
                }}
            >
                <li>
                    <span style={{ color: '#ccc' }}>Ready:</span> Slow Pulse
                </li>
                <li>
                    <span style={{ color: '#ccc' }}>Armed:</span> Fast Blink
                </li>
                <li>
                    <span style={{ color: '#ccc' }}>Locked:</span> Solid On
                </li>
                <li>
                    <span style={{ color: '#ccc' }}>Aborted:</span> Standard Blink
                </li>
                <li>
                    <span style={{ color: '#ccc' }}>Done:</span> Double Blink
                </li>
                <li>
                    <span style={{ color: '#ccc' }}>Test:</span> Medium Pulse
                </li>
            </ul>
        </div>
    );

    const getFeatureDetails = (feature: DeviceFeature) => {
        switch (feature) {
            case 'footPedal':
                return {
                    label: 'Foot Pedal Support',
                    icon: <UsbOutlined style={{ color: green[5] }} />,
                    description: 'Physical button to start and abort sessions.',
                };
            case 'startCountdown':
                return {
                    label: 'Auto Countdown',
                    icon: <ClockCircleOutlined style={{ color: green[5] }} />,
                    description: 'Supports automatic start after a configurable delay.',
                };
            case 'statusLed' as any: // Cast for robust handling if types lag behind backend
                return {
                    label: 'Status LED',
                    icon: <BulbOutlined style={{ color: green[5] }} />,
                    description: ledTooltip,
                };
            default:
                return {
                    label: feature,
                    icon: <CheckCircleOutlined style={{ color: green[5] }} />,
                    description: 'Enabled firmware feature.',
                };
        }
    };

    // Feature list generation
    const featureItems: MenuProps['items'] = [];

    if (activeDevice && connectionHealth.device.status === 'ok') {
        activeDevice.features.forEach((feature) => {
            const details = getFeatureDetails(feature);
            featureItems.push({
                key: `feat-${feature}`,
                label: (
                    <Tooltip title={details.description} placement="right" styles={{ root: { maxWidth: 300 } }}>
                        <Space style={{ pointerEvents: 'auto' }}>
                            <span>{details.label}</span>
                            <InfoCircleOutlined
                                style={{
                                    color: token.colorTextDisabled,
                                    cursor: 'help',
                                }}
                            />
                        </Space>
                    </Tooltip>
                ),
                icon: details.icon,
                disabled: true,
            });
        });
    }

    let mainActionItem: NonNullable<MenuProps['items']>[number];

    if (currentState === 'ready') {
        mainActionItem = {
            key: 'main-action-start-test',
            label: 'Start Hardware Test',
            icon: <ExperimentOutlined />,
            onClick: startTestSession,
            disabled: false,
        };
    } else if (currentState === 'testing') {
        mainActionItem = {
            key: 'main-action-stop-test',
            label: 'Stop Hardware Test',
            icon: <StopOutlined />,
            onClick: abortSession,
            disabled: false,
        };
    } else {
        mainActionItem = {
            key: 'main-action-disabled',
            label: 'Start Hardware Test',
            icon: <ExperimentOutlined />,
            disabled: true, // But disable it
        };
    }
    // --- END DYNAMIC ITEM LOGIC ---

    // Build the main dropdown menu
    const menuItems: MenuProps['items'] = [
        {
            type: 'group',
            label: <Text strong>Information</Text>,
            children: [
                {
                    key: 'health',
                    label: (
                        <Space direction="vertical" size={0}>
                            <Text strong>{title}</Text>
                            <Text
                                type="secondary"
                                style={{
                                    fontSize: '12px',
                                    whiteSpace: 'normal',
                                }}
                            >
                                {description}
                            </Text>
                        </Space>
                    ),
                    icon: icon,
                    disabled: true,
                },
                { key: 'divider-1', type: 'divider' },
                {
                    key: 'group-device',
                    type: 'group',
                    label: <Text type="secondary">Device Configuration</Text>,
                    children: [
                        {
                            key: 'device-id',
                            label: `Device: ${displayDeviceId || 'N/A'}`,
                            icon: <HddOutlined />,
                            disabled: true,
                        },
                        {
                            key: 'version-info',
                            label: `Version: ${appVersion} (${appBuildType})`,
                            icon: <HddOutlined />,
                            disabled: true,
                        },
                        {
                            key: 'device-net',
                            label: `Net: ${displayDeviceAddress}:${displayPort}`,
                            icon: <HddOutlined />,
                            disabled: true,
                        },
                        {
                            key: 'channels',
                            label: `Enabled Channels: ${enabledChannelsString}`,
                            icon: <ApiOutlined />,
                            disabled: true,
                        },
                    ],
                },
                // --- NEW DETERRENTS SECTION ---
                {
                    key: 'group-deterrents',
                    type: 'group',
                    label: <Text type="secondary">Deterrents</Text>,
                    children: [
                        {
                            key: 'payback',
                            label: paybackTimeEnabled
                                ? `Payback Time: ${paybackTimeMinutes} min`
                                : 'Payback Time: Disabled',
                            icon: <FieldTimeOutlined />,
                            disabled: true,
                        },
                        {
                            key: 'streaks',
                            label: streaksEnabled ? 'Streaks: Enabled' : 'Streaks: Disabled',
                            icon: <FireOutlined />,
                            disabled: true,
                        },
                        {
                            key: 'reward-code',
                            label: rewardCodeEnabled ? 'Reward Code: Enabled' : 'Reward Code: Disabled',
                            icon: <GiftOutlined />,
                            disabled: true,
                        },
                    ],
                },
                // --- END NEW DETERRENTS SECTION ---
                ...(featureItems.length > 0
                    ? [
                          {
                              key: 'group-features',
                              type: 'group' as const,
                              label: <Text type="secondary">Features</Text>,
                              children: featureItems,
                          },
                      ]
                    : []),
            ],
        },
        { key: 'action-features', type: 'divider' as const },
        {
            type: 'group',
            label: <Text strong>Actions</Text>,
            children: [
                {
                    key: 'logs',
                    label: 'View Device Logs',
                    icon: <FileTextOutlined />,
                    onClick: openDeviceLogs,
                    disabled: !activeDevice || connectionHealth.device.status !== 'ok',
                },
                mainActionItem,
                {
                    key: 'device-settings',
                    label: 'Device Settings',
                    icon: <SlidersOutlined />,
                    onClick: openDeviceSettingsModal,
                    disabled: !activeDevice || (currentState !== 'ready' && currentState !== 'completed'),
                },
            ],
        },
    ];

    // This is the component that is always visible in the header
    const triggerComponent = (
        <Button
            type="text"
            style={{
                padding: '0px 8px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                color: token.colorTextSecondary,
            }}
        >
            <Space size="small" align="center">
                {icon}
                <Space
                    size={4}
                    split={
                        <Text type="secondary" style={{ margin: '0 2px' }}>
                            /
                        </Text>
                    }
                >
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        {title}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        {displayDeviceId}
                    </Text>
                </Space>
                <DownOutlined style={{ fontSize: '10px', color: token.colorTextDisabled }} />
            </Space>
        </Button>
    );

    return (
        <>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} disabled={!activeDevice && title !== 'No Device'}>
                {triggerComponent}
            </Dropdown>
        </>
    );
};
