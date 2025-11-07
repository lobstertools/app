import { useDeviceManager } from '../../context/DeviceManagerContext';
import { green } from '@ant-design/colors';
import {
    CheckCircleOutlined,
    SearchOutlined,
    SettingOutlined,
    UsbOutlined,
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
} from 'antd';
import { useEffect, useMemo } from 'react';
import { DiscoveredDevice } from '../../../types';
import { ProvisionDeviceForm } from './ProvisionDeviceForm';

const { Text } = Typography;

/**
 * A modal for discovering, selecting, and provisioning devices.
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
                        <>
                            <Text type="secondary" code>
                                {device.id}
                            </Text>
                            {!isReadyList && (
                                <Card
                                    size="small"
                                    style={{
                                        width: '100%',
                                        background: token.colorFillAlter,
                                        marginTop: 12,
                                    }}
                                >
                                    <ProvisionDeviceForm device={device} />
                                </Card>
                            )}
                        </>
                    );

                    return (
                        <List.Item
                            actions={
                                isReadyList
                                    ? // 'Ready' devices get a 'Select' button
                                      [
                                          <Button
                                              type="primary"
                                              onClick={() =>
                                                  selectDevice(device)
                                              }
                                          >
                                              Select
                                          </Button>,
                                      ]
                                    : undefined
                            }
                        >
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

    // Tabs for the modal
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

    return (
        <Modal
            title="Device Manager"
            open={isDeviceModalOpen}
            closable={false}
            width={720}
            wrapClassName="backdrop-blur-modal"
            footer={[
                <Button key="cancel" onClick={closeDeviceModal}>
                    Cancel
                </Button>,
                <Button
                    key="scan"
                    icon={<SearchOutlined />}
                    onClick={scanForDevices}
                    loading={isScanning}
                >
                    Scan for Devices
                </Button>,
            ]}
        >
            <Tabs defaultActiveKey="ready" items={tabItems} />
        </Modal>
    );
};
