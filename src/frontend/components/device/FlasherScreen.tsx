import { useState } from 'react';
import { UploadOutlined, WarningOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Typography, Button, Card, Space, theme as antdTheme, Progress, Alert } from 'antd';

import { useDeviceManager } from '../../context/useDeviceManager';
import { SerialPortInfo } from '../../types/electron';

const { Text } = Typography;

/**
 * Props for the FlasherScreen component.
 */
interface FlasherScreenProps {
    port: SerialPortInfo;
    onSuccess: () => void;
    onCancel: () => void;
}

/**
 * A self-contained form component for selecting firmware
 * and flashing a device on a specific port.
 */
export const FlasherScreen = ({ port, onSuccess, onCancel }: FlasherScreenProps) => {
    const { token } = antdTheme.useToken();
    const { isFlashing, flashProgress, selectFirmwareFile, flashDevice } = useDeviceManager();

    const [firmwarePath, setFirmwarePath] = useState<string | null>(null);
    const [flashScreenError, setFlashScreenError] = useState<string | null>(null);

    /**
     * Handles selection of the firmware file.
     */
    const handleSelectFirmware = async () => {
        const path = await selectFirmwareFile(); // Use context function
        if (path) {
            setFirmwarePath(path);
        }
    };

    /**
     * Handles the 'Flash' button click.
     */
    const handleFlash = async () => {
        if (!port || !firmwarePath) return;

        setFlashScreenError(null);

        try {
            // Use context function
            await flashDevice(port.path, firmwarePath);
            // If it doesn't throw, it succeeded
            onSuccess(); // Report success to the parent modal
        } catch (err: any) {
            // Catch the error thrown from the context and display it
            setFlashScreenError(err.message || 'An unknown flash error occurred.');
        }
    };

    // Truncate firmware path for display
    const displayPath = firmwarePath
        ? '...' + firmwarePath.substring(Math.max(0, firmwarePath.length - 50))
        : 'No file selected.';

    return (
        <div>
            <Button
                type="link"
                icon={<ArrowLeftOutlined />}
                onClick={onCancel} // Go back
                style={{ paddingLeft: 0, marginBottom: 16, display: 'block' }}
                disabled={isFlashing}
            >
                Back to Device List
            </Button>

            <Text type="secondary">Select a firmware .bin file to upload to the device.</Text>

            <Card
                size="small"
                style={{
                    width: '100%',
                    background: token.colorFillAlter,
                    marginTop: 12,
                }}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Button icon={<UploadOutlined />} onClick={handleSelectFirmware} disabled={isFlashing}>
                            Select Firmware
                        </Button>
                        <Text
                            code
                            ellipsis
                            style={{
                                padding: '4px 11px',
                                border: `1px solid ${token.colorBorder}`,
                                borderRadius: `0 ${token.borderRadius}px ${token.borderRadius}px 0`,
                                background: token.colorBgContainer,
                                width: '100%',
                            }}
                        >
                            {displayPath}
                        </Text>
                    </Space.Compact>

                    {isFlashing && <Progress percent={flashProgress} status="active" strokeColor={token.colorInfo} />}

                    {flashScreenError && (
                        <Alert
                            message="Flash Failed"
                            description={flashScreenError}
                            type="error"
                            showIcon
                            closable
                            onClose={() => setFlashScreenError(null)}
                        />
                    )}

                    <Alert
                        message="Warning"
                        description="Flashing firmware can brick your device. Ensure you have selected the correct file and port."
                        type="warning"
                        showIcon
                        icon={<WarningOutlined />}
                    />

                    <Button
                        type="primary"
                        danger
                        onClick={handleFlash}
                        loading={isFlashing}
                        disabled={!firmwarePath || isFlashing}
                        style={{ width: '100%', marginTop: 16 }}
                    >
                        {isFlashing ? 'Flashing...' : 'Flash Device'}
                    </Button>
                </Space>
            </Card>
        </div>
    );
};
