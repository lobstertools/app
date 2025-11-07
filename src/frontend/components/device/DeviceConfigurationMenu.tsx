import { useSession } from '../../context/SessionContext';
import { red, green, yellow } from '@ant-design/colors';
import {
    Typography,
    Button,
    Space,
    Divider,
    Tooltip,
    theme as antdTheme,
    Dropdown,
    MenuProps,
    Modal,
} from 'antd';
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
    SettingOutlined,
    ExclamationCircleOutlined,
    UndoOutlined,
    FieldTimeOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { useDeviceManager } from '../../context/DeviceManagerContext';

const { Text } = Typography;

/**
 * Diagnostic indicator for connection health, logs, and device actions.
 * Sits in the header.
 */
export const DeviceConfigurationMenu = () => {
    const { token } = antdTheme.useToken();

    // Get all needed state/functions from useSession
    const { currentState, abortSession, startTestSession } = useSession();

    // Get all needed state/functions from useDeviceManager
    const {
        connectionHealth,
        fetchDeviceLogs,
        activeDevice,
        openDeviceModal,
        factoryResetDevice,
    } = useDeviceManager();

    const [modalApi, contextHolder] = Modal.useModal();

    // Pulling static config from activeDevice
    const deviceName = activeDevice?.name;
    const channelCount = activeDevice?.numberOfChannels || 0;
    const paybackEnabled = activeDevice?.enableTimePayback || false;
    const paybackMinutes = activeDevice?.abortPaybackMinutes || 0;
    const abortDelaySeconds = activeDevice?.abortDelaySeconds || 0;

    // Pulling features from activeDevice
    const hasLedFeature = useMemo(
        () => activeDevice?.features?.includes('LED_Indicator') || false,
        [activeDevice]
    );
    const hasPedalFeature = useMemo(
        () => activeDevice?.features?.includes('Abort_Padel') || false,
        [activeDevice]
    );

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
            icon = <CloudOutlined spin style={{ color: color }} />;
            description =
                'The UI cannot reach the server. Check your connection.';
            displayDeviceId = 'N/A';
        } else if (connectionHealth.device.status === 'error') {
            color = yellow[5];
            title = 'Device Unreachable';
            icon = <DisconnectOutlined style={{ color: color }} />;
            description =
                'The server is running, but it cannot reach the device.';
            displayDeviceId = deviceName || 'Unknown Device';
        } else if (
            connectionHealth.server.status === 'pending' ||
            connectionHealth.device.status === 'pending'
        ) {
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

        return { title, icon, description, displayDeviceId };
    }, [connectionHealth, activeDevice, deviceName, token]);
    // --- END HEALTH LOGIC ---

    const showFactoryResetConfirm = () => {
        if (!activeDevice) return;
        modalApi.confirm({
            title: 'Are you sure you want to factory reset this device?',
            icon: <ExclamationCircleOutlined />,
            content: (
                <>
                    This will erase all settings (including WiFi) on
                    <Text strong> {activeDevice.name} </Text>
                    and put it back into provisioning mode.
                </>
            ),
            okText: 'Factory Reset',
            okType: 'danger',
            onOk() {
                factoryResetDevice(activeDevice.id);
            },
        });
    };

    // Tooltip content
    const ledTooltipContent = (
        <div style={{ maxWidth: 250 }}>
            <Text>An on-device LED indicator for quick status reference.</Text>
            <Divider style={{ margin: '8px 0' }} />
            <Space direction="vertical" size={0}>
                <Text>
                    <Text strong>Slow Pulse:</Text> Ready
                </Text>
                <Text>
                    <Text strong>Medium Blink:</Text> Starting / Testing
                </Text>
                <Text>
                    <Text strong>Solid On:</Text> Locked
                </Text>
                <Text>
                    <Text strong>Fast Blink:</Text> Penalty Active
                </Text>
                <Text>
                    <Text strong>Off:</Text> Completed / Off
                </Text>
            </Space>
        </div>
    );
    const pedalTooltipContent = (
        <div style={{ maxWidth: 250 }}>
            <Text>
                Acts as an on-device emergency break, immediately aborting the
                session.
            </Text>
        </div>
    );

    // Feature list
    const featureItems: MenuProps['items'] = [];
    if (activeDevice && connectionHealth.device.status === 'ok') {
        if (hasLedFeature) {
            featureItems.push({
                key: 'feat-led',
                label: (
                    <Space>
                        <span>LED Status Indicator</span>
                        <Tooltip title={ledTooltipContent} placement="right">
                            <InfoCircleOutlined
                                style={{
                                    color: token.colorTextDisabled,
                                    cursor: 'help',
                                }}
                            />
                        </Tooltip>
                    </Space>
                ),
                icon: <CheckCircleOutlined style={{ color: green[5] }} />,
                disabled: true,
            });
        }
        if (hasPedalFeature) {
            featureItems.push({
                key: 'feat-abort-pedal',
                label: (
                    <Space>
                        <span>Abort Padel Support</span>
                        <Tooltip title={pedalTooltipContent} placement="right">
                            <InfoCircleOutlined
                                style={{
                                    color: token.colorTextDisabled,
                                    cursor: 'help',
                                }}
                            />
                        </Tooltip>
                    </Space>
                ),
                icon: <UsbOutlined style={{ color: green[5] }} />,
                disabled: true,
            });
        }
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
        // This block now catches 'locked', 'countdown', 'completed', 'connecting', etc.
        // The "Stop Session" logic has been removed.
        mainActionItem = {
            key: 'main-action-disabled',
            label: 'Start Hardware Test', // Show the default action
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
                            key: 'channels',
                            label: `Channels: ${channelCount || 'N/A'}`,
                            icon: <ApiOutlined />,
                            disabled: true,
                        },
                        {
                            key: 'payback',
                            label: paybackEnabled
                                ? `Payback: ${paybackMinutes} min`
                                : 'PayBack: Disabled',
                            icon: <FieldTimeOutlined />,
                            disabled: true,
                        },
                        {
                            key: 'abort-delay',
                            label: `Abort Delay: ${abortDelaySeconds} sec`,
                            icon: <StopOutlined />,
                            disabled: true,
                        },
                    ],
                },
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
                    onClick: fetchDeviceLogs,
                    disabled:
                        !activeDevice ||
                        connectionHealth.device.status !== 'ok',
                },
                mainActionItem,
                {
                    key: 'factory-reset',
                    label: 'Factory Reset Device',
                    icon: <UndoOutlined />,
                    onClick: showFactoryResetConfirm,
                    disabled:
                        !activeDevice ||
                        connectionHealth.device.status !== 'ok' ||
                        currentState !== 'ready',
                    danger: true,
                },
                { key: 'setup-features', type: 'divider' as const },
                {
                    key: 'change-device',
                    label: 'Device Manager',
                    icon: <SettingOutlined />,
                    onClick: openDeviceModal,
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
            onClick={
                !activeDevice && title === 'No Device'
                    ? openDeviceModal
                    : undefined
            }
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
                <DownOutlined
                    style={{ fontSize: '10px', color: token.colorTextDisabled }}
                />
            </Space>
        </Button>
    );

    return (
        <>
            {contextHolder}
            <Dropdown
                menu={{ items: menuItems }}
                trigger={['click']}
                disabled={!activeDevice && title !== 'No Device'} // Disable if connecting
            >
                {triggerComponent}
            </Dropdown>
        </>
    );
};
