import { Modal, Button, Card, theme as antdTheme, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useDeviceManager } from '../../context/useDeviceManager';

/**
 * A modal that displays the raw text content of device logs.
 * It is controlled entirely by the DeviceManagerContext.
 */
export const DeviceLogModal = () => {
    const { token } = antdTheme.useToken();
    const [messageApi, contextHolder] = message.useMessage();

    const { isLogModalOpen, logContent, closeLogModal, openDeviceLogs } = useDeviceManager();

    const handleCopyLogs = async () => {
        if (!logContent) return;
        try {
            await navigator.clipboard.writeText(logContent);
            messageApi.success('Logs copied to clipboard');
        } catch (error) {
            console.error('Failed to copy logs:', error);
            messageApi.error('Failed to copy logs');
        }
    };

    return (
        <>
            {contextHolder}
            <Modal
                title="Device Logs"
                open={isLogModalOpen}
                onCancel={closeLogModal}
                width={1200}
                wrapClassName="backdrop-blur-modal"
                footer={[
                    <Button key="copy" icon={<CopyOutlined />} onClick={handleCopyLogs}>
                        Copy
                    </Button>,
                    <Button key="close" onClick={closeLogModal}>
                        Close
                    </Button>,
                    <Button key="refresh" type="primary" onClick={openDeviceLogs}>
                        Refresh
                    </Button>,
                ]}
            >
                <Card
                    style={{
                        background: token.colorFillAlter,
                        maxHeight: '60vh',
                        overflowY: 'auto',
                    }}
                >
                    <pre
                        className="selectable-text"
                        style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            userSelect: 'text',
                        }}
                    >
                        {logContent}
                    </pre>
                </Card>
            </Modal>
        </>
    );
};
