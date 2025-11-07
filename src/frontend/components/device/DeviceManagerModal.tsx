import { useDeviceManager } from '../../context/DeviceManagerContext';
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

const { Text } = Typography;

/**
 * A modal for discovering, selecting, and provisioning devices.
 * Supports a two-stage "List-Detail" flow for provisioning.
 */
export const DeviceManagerModal = () => {
    const {
        isDeviceModalOpen,
        discoveredDevices,
        selectDevice,
        isScanning,
        scanForDevices,
        closeDeviceModal,
    } = useDeviceManager();
    const { token } = antdTheme.useToken();

    // Hook for success notifications
    const [messageApi, contextHolder] = message.useMessage();

    // State to track the *single* device being provisioned.
    // null = Show device list
    // DiscoveredDevice = Show provisioning screen for that device
    const [provisioningDevice, setProvisioningDevice] =
        useState<DiscoveredDevice | null>(null);

    // Filter devices into 'ready' (mDNS) and 'new' (BLE)
    const readyDevices = useMemo(
        () => discoveredDevices.filter((d) => d.state === 'ready'),
        [discoveredDevices]
    );

    const newDevices = useMemo(
        () => discoveredDevices.filter((d) => d.state === 'new_unprovisioned'),
        [discoveredDevices]
    );

    useEffect(() => {
        if (isDeviceModalOpen) {
            scanForDevices();
        }
    }, [isDeviceModalOpen, scanForDevices]);

    // Combined cancel handler to reset our state
    const handleCancel = () => {
        setProvisioningDevice(null);
        closeDeviceModal();
    };

    // When modal closes, reset the view
    useEffect(() => {
        if (!isDeviceModalOpen) {
            setProvisioningDevice(null);
        }
    }, [isDeviceModalOpen]);

    /**
     * Callback for when the provisioning form is successfully submitted.
     * This is passed down to <ProvisionDeviceForm />.
     */
    const handleProvisionSuccess = () => {
        messageApi.success(
            `Device "${provisioningDevice?.name}" provisioned successfully. It will now reboot.`
        );
        // This will return the modal to the device list view
        setProvisioningDevice(null);
    };

    /**
     * Renders a list of devices (either ready or new).
     */
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
                        ? // 'Ready' devices get a 'Select' button
                          [
                              <Button
                                  type="primary"
                                  onClick={() => selectDevice(device)}
                              >
                                  Select
                              </Button>,
                          ]
                        : // 'New' devices get a 'Provision' button
                          [
                              <Button
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

    // Tabs for the list view
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

    // Dynamically build the footer based on the view
    const modalFooter = [
        <Button key="cancel" onClick={handleCancel}>
            Cancel
        </Button>,
    ];

    if (!provisioningDevice) {
        // Only show 'Scan' when in the list view
        modalFooter.push(
            <Button
                key="scan"
                icon={<SearchOutlined />}
                onClick={scanForDevices}
                loading={isScanning}
            >
                Scan for Devices
            </Button>
        );
    }

    /**
     * Renders the focused "Detail" screen for provisioning a single device.
     */
    const renderProvisioningScreen = () => {
        if (!provisioningDevice) return null;

        return (
            <div>
                <Button
                    type="link"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => setProvisioningDevice(null)}
                    style={{
                        paddingLeft: 0,
                        marginBottom: 16,
                        display: 'block',
                    }}
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
                        onSuccess={handleProvisionSuccess} // Pass the callback
                    />
                </Card>
            </div>
        );
    };

    return (
        <>
            {/* Renders the antd messageApi context */}
            {contextHolder}
            <Modal
                title={
                    provisioningDevice
                        ? `Provision Device: ${provisioningDevice.name}`
                        : 'Device Manager'
                }
                open={isDeviceModalOpen}
                closable={false}
                width={720}
                wrapClassName="backdrop-blur-modal"
                footer={modalFooter} // Using dynamic footer
                onCancel={handleCancel} // Using combined handler
            >
                {/* Conditionally render List or Detail view */}
                {provisioningDevice ? (
                    renderProvisioningScreen()
                ) : (
                    <Tabs defaultActiveKey="ready" items={tabItems} />
                )}
            </Modal>
        </>
    );
};
