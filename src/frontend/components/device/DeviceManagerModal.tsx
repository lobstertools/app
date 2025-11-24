import { useDeviceManager } from '../../context/useDeviceManager';
import { useAppRuntime } from '../../context/useAppRuntime';
import { green, blue } from '@ant-design/colors';
import {
    CheckCircleOutlined,
    SearchOutlined,
    SettingOutlined,
    UsbOutlined,
    ArrowLeftOutlined,
    WifiOutlined,
    EnvironmentOutlined,
    ClockCircleOutlined,
    TagOutlined,
} from '@ant-design/icons';
import { Typography, Button, Card, Space, Modal, List, theme as antdTheme, Tabs, Empty, message, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { DiscoveredDevice } from '../../../types';
import { ProvisionDeviceForm } from './ProvisionDeviceForm';
import { FlasherScreen } from './FlasherScreen';
import { SerialPortInfo } from '../../types/electron';

const { Text } = Typography;

/**
 * A modal for discovering, selecting, provisioning, and flashing devices.
 * All logic is driven by the DeviceManagerContext.
 */
export const DeviceManagerModal = () => {
    const {
        isDeviceModalOpen,
        discoveredDevices,
        selectDevice,
        isScanning,
        scanForDevices,
        closeDeviceModal,
        serialPorts,
        isScanningPorts,
        scanForSerialPorts,
        isFlashing,
    } = useDeviceManager();
    const { token } = antdTheme.useToken();
    const { isElectron } = useAppRuntime();

    const [messageApi, contextHolder] = message.useMessage();

    // --- State for "List-Detail" flow ---
    const [provisioningDevice, setProvisioningDevice] = useState<DiscoveredDevice | null>(null);
    const [flashingPort, setFlashingPort] = useState<SerialPortInfo | null>(null);

    // Filter devices
    const readyDevices = useMemo(() => discoveredDevices.filter((d) => d.state === 'ready'), [discoveredDevices]);
    const newDevices = useMemo(
        () => discoveredDevices.filter((d) => d.state === 'new_unprovisioned'),
        [discoveredDevices]
    );

    // Scan for all device types when modal opens
    useEffect(() => {
        if (!isDeviceModalOpen) return;

        // 1. Initial Scan (triggers loading spinner)
        scanForDevices(false);
        if (isElectron) {
            scanForSerialPorts();
        }

        // 2. Active Polling Loop (Silent)
        // Poll every 2 seconds while the modal is open.
        // This picks up new devices immediately as the backend finds them.
        const intervalId = setInterval(() => {
            scanForDevices(true); // Silent = true
        }, 2000);

        return () => clearInterval(intervalId);
    }, [isDeviceModalOpen, scanForDevices, isElectron, scanForSerialPorts]);

    const handleCancel = () => {
        if (isFlashing) return;

        setProvisioningDevice(null);
        setFlashingPort(null);
        closeDeviceModal();
    };

    // When modal closes, reset all views
    useEffect(() => {
        if (!isDeviceModalOpen) {
            setProvisioningDevice(null);
            setFlashingPort(null);
        }
    }, [isDeviceModalOpen]);

    /**
     * Callback for when the provisioning form is successfully submitted.
     */
    const handleProvisionSuccess = () => {
        messageApi.success(`Device "${provisioningDevice?.name}" provisioned successfully. It will now reboot.`);
        setProvisioningDevice(null); // Back to list
    };

    /**
     * Callback for when the flasher screen is successfully submitted.
     */
    const handleFlashSuccess = () => {
        messageApi.success(`Device flashed successfully!`);
        setFlashingPort(null); // Back to list
    };

    // --- renderDeviceList ---
    const renderDeviceList = (devices: DiscoveredDevice[], isReadyList: boolean) => {
        return (
            <List
                loading={isScanning}
                dataSource={devices}
                locale={{
                    emptyText: <Empty description="No devices found. Click 'Scan' to search." />,
                }}
                renderItem={(device) => {
                    // Detailed description block
                    const descriptionContent = (
                        <Space direction="vertical" size={1} style={{ marginTop: 4 }}>
                            {/* ID Row */}
                            <Space size="small">
                                <TagOutlined
                                    style={{
                                        fontSize: '12px',
                                        color: token.colorTextSecondary,
                                    }}
                                />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    ID:{' '}
                                    <Text code style={{ fontSize: '12px' }}>
                                        {device.id}
                                    </Text>
                                </Text>
                            </Space>

                            {/* Address Row */}
                            <Space size="small">
                                {isReadyList ? (
                                    <WifiOutlined
                                        style={{
                                            fontSize: '12px',
                                            color: token.colorTextSecondary,
                                        }}
                                    />
                                ) : (
                                    <EnvironmentOutlined
                                        style={{
                                            fontSize: '12px',
                                            color: token.colorTextSecondary,
                                        }}
                                    />
                                )}
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {isReadyList ? 'IP: ' : 'BLE: '}
                                    {device.address}
                                    {isReadyList ? `:${device.port}` : ''}
                                </Text>
                            </Space>

                            {/* Timestamp Row */}
                            <Space size="small">
                                <ClockCircleOutlined
                                    style={{
                                        fontSize: '12px',
                                        color: token.colorTextSecondary,
                                    }}
                                />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    Last Seen: {new Date(device.lastSeenTimestamp).toLocaleTimeString()}
                                </Text>
                            </Space>
                        </Space>
                    );

                    const actions = isReadyList
                        ? [
                              <Button type="primary" onClick={() => selectDevice(device)}>
                                  Select
                              </Button>,
                          ]
                        : [
                              <Button type="primary" onClick={() => setProvisioningDevice(device)}>
                                  Provision
                              </Button>,
                          ];

                    return (
                        <List.Item actions={actions}>
                            <List.Item.Meta
                                avatar={
                                    isReadyList ? (
                                        <CheckCircleOutlined
                                            style={{
                                                fontSize: '24px',
                                                color: green[5],
                                                marginTop: 8,
                                            }}
                                        />
                                    ) : (
                                        <SettingOutlined
                                            style={{
                                                fontSize: '24px',
                                                color: blue[5],
                                                marginTop: 8,
                                            }}
                                        />
                                    )
                                }
                                title={
                                    <Space>
                                        <Text strong style={{ fontSize: '16px' }}>
                                            {device.name}
                                        </Text>
                                        {isReadyList && <Tag color="success">Ready</Tag>}
                                        {!isReadyList && <Tag color="processing">Setup Mode</Tag>}
                                    </Space>
                                }
                                description={descriptionContent}
                            />
                        </List.Item>
                    );
                }}
            />
        );
    };

    // --- renderFlasherList ---
    const renderFlasherList = () => {
        return (
            <List
                loading={isScanningPorts}
                dataSource={serialPorts}
                locale={{
                    emptyText: <Empty description="No serial ports found. Click 'Scan' to search." />,
                }}
                renderItem={(port) => (
                    <List.Item
                        actions={[
                            <Button type="primary" onClick={() => setFlashingPort(port)}>
                                Flash
                            </Button>,
                        ]}
                    >
                        <List.Item.Meta
                            avatar={<UsbOutlined style={{ fontSize: '24px', marginTop: 8 }} />}
                            title={<Text strong>{port.path}</Text>}
                            description={
                                <Space direction="vertical" size={0}>
                                    <Text type="secondary">Manufacturer: {port.manufacturer || 'Unknown'}</Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Vendor ID: <Text code>{port.vendorId || 'N/A'}</Text>
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        Product ID: <Text code>{port.productId || 'N/A'}</Text>
                                    </Text>
                                </Space>
                            }
                        />
                    </List.Item>
                )}
            />
        );
    };

    // --- Build Tab Items ---
    const tabItems = [
        {
            key: 'ready',
            label: (
                <Space>
                    <CheckCircleOutlined />
                    Ready Devices ({readyDevices.length})
                </Space>
            ),
            children: renderDeviceList(readyDevices, true),
        },
        {
            key: 'new',
            label: (
                <Space>
                    <SettingOutlined />
                    New / Provisioning ({newDevices.length})
                </Space>
            ),
            children: renderDeviceList(newDevices, false),
        },
    ];

    if (isElectron) {
        tabItems.push({
            key: 'flasher',
            label: (
                <Space>
                    <UsbOutlined />
                    Device Flasher ({serialPorts.length})
                </Space>
            ),
            children: renderFlasherList(),
        });
    }

    // --- modalFooter ---
    const modalFooter = [
        <Button key="cancel" onClick={handleCancel} disabled={isFlashing}>
            Cancel
        </Button>,
    ];

    if (!provisioningDevice && !flashingPort) {
        modalFooter.push(
            <Button
                key="scan"
                icon={<SearchOutlined />}
                onClick={() => {
                    scanForDevices();
                    if (isElectron) {
                        scanForSerialPorts(); // Scan both
                    }
                }}
                loading={isScanning || isScanningPorts}
            >
                Scan for Devices
            </Button>
        );
    }

    const renderProvisioningScreen = () => {
        if (!provisioningDevice) return null;

        return (
            <div>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => setProvisioningDevice(null)}
                    style={{ paddingLeft: 0, marginBottom: 16 }}
                >
                    Back to Device List
                </Button>
                <Text type="secondary">Enter the Wi-Fi credentials and device settings.</Text>
                <Card
                    size="small"
                    style={{
                        width: '100%',
                        background: token.colorFillAlter,
                        marginTop: 12,
                    }}
                >
                    <ProvisionDeviceForm device={provisioningDevice} onSuccess={handleProvisionSuccess} />
                </Card>
            </div>
        );
    };

    // --- Modal Title ---
    const modalTitle = provisioningDevice
        ? `Provision Device: ${provisioningDevice.name}`
        : flashingPort
          ? `Flash Device: ${flashingPort.path}`
          : 'Device Manager';

    // --- Modal View Logic ---
    const renderModalContent = () => {
        if (provisioningDevice) {
            return renderProvisioningScreen();
        }
        if (flashingPort) {
            return (
                <FlasherScreen
                    port={flashingPort}
                    onCancel={() => setFlashingPort(null)}
                    onSuccess={handleFlashSuccess}
                />
            );
        }
        // Default: Show tabs
        return <Tabs defaultActiveKey="ready" items={tabItems} />;
    };

    return (
        <>
            {contextHolder}
            <Modal
                title={modalTitle}
                open={isDeviceModalOpen}
                closable={false}
                width={960}
                wrapClassName="backdrop-blur-modal"
                footer={modalFooter}
                onCancel={handleCancel}
                maskClosable={!isFlashing}
            >
                {renderModalContent()}
            </Modal>
        </>
    );
};
