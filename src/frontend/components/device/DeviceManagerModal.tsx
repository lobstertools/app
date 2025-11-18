import { useDeviceManager } from '../../context/useDeviceManager';
import { useAppRuntime } from '../../context/useAppRuntime';
import { green } from '@ant-design/colors';
import {
    CheckCircleOutlined,
    SearchOutlined,
    SettingOutlined,
    UsbOutlined,
    ArrowLeftOutlined,
} from '@ant-design/icons';
import {
    Typography,
    Button,
    Card,
    Space,
    Modal,
    List,
    theme as antdTheme,
    Tabs,
    Empty,
    message,
} from 'antd';
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
    const [provisioningDevice, setProvisioningDevice] =
        useState<DiscoveredDevice | null>(null);
    const [flashingPort, setFlashingPort] = useState<SerialPortInfo | null>(
        null
    );

    // Filter devices
    const readyDevices = useMemo(
        () => discoveredDevices.filter((d) => d.state === 'ready'),
        [discoveredDevices]
    );
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
        messageApi.success(
            `Device "${provisioningDevice?.name}" provisioned successfully. It will now reboot.`
        );
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
    const renderDeviceList = (
        devices: DiscoveredDevice[],
        isReadyList: boolean
    ) => {
        return (
            <List
                loading={isScanning}
                dataSource={devices}
                locale={{
                    emptyText: (
                        <Empty description="No devices found. Click 'Scan' to search." />
                    ),
                }}
                renderItem={(device) => {
                    const descriptionContent = (
                        <Text type="secondary" code>
                            {device.id}
                        </Text>
                    );

                    const actions = isReadyList
                        ? [
                              <Button
                                  type="primary"
                                  onClick={() => selectDevice(device)}
                              >
                                  Select
                              </Button>,
                          ]
                        : [
                              <Button
                                  type="primary"
                                  onClick={() => setProvisioningDevice(device)}
                              >
                                  Provision
                              </Button>,
                          ];

                    return (
                        <List.Item actions={actions}>
                            <List.Item.Meta
                                avatar={
                                    isReadyList ? (
                                        <CheckCircleOutlined
                                            style={{ color: green[5] }}
                                        />
                                    ) : (
                                        <UsbOutlined />
                                    )
                                }
                                title={device.name}
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
                    emptyText: (
                        <Empty description="No serial ports found. Click 'Scan' to search." />
                    ),
                }}
                renderItem={(port) => (
                    <List.Item
                        actions={[
                            <Button
                                type="primary"
                                onClick={() => setFlashingPort(port)}
                            >
                                Flash
                            </Button>,
                        ]}
                    >
                        <List.Item.Meta
                            avatar={<UsbOutlined />}
                            title={port.path}
                            description={
                                <Text type="secondary" code>
                                    {port.manufacturer || 'N/A'} (Vendor:{' '}
                                    {port.vendorId}, Product: {port.productId})
                                </Text>
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
                <Text type="secondary">
                    Enter the Wi-Fi credentials and device settings.
                </Text>
                <Card
                    size="small"
                    style={{
                        width: '100%',
                        background: token.colorFillAlter,
                        marginTop: 12,
                    }}
                >
                    <ProvisionDeviceForm
                        device={provisioningDevice}
                        onSuccess={handleProvisionSuccess}
                    />
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
