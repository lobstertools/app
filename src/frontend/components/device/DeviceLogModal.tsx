import { Modal, Button, Card, theme as antdTheme } from 'antd';
import { useDeviceManager } from '../../context/DeviceManagerContext';

/**
 * A modal that displays the raw text content of device logs.
 * It is controlled entirely by the DeviceManagerContext.
 */
export const DeviceLogModal = () => {
    const { token } = antdTheme.useToken();

    const { isLogModalOpen, logContent, closeLogModal, fetchDeviceLogs } =
        useDeviceManager();

    return (
        <Modal
            title="Device Logs"
            open={isLogModalOpen}
            onCancel={closeLogModal}
            width={1200}
            wrapClassName="backdrop-blur-modal"
            footer={[
                <Button key="close" onClick={closeLogModal}>
                    Close
                </Button>,
                <Button key="refresh" type="primary" onClick={fetchDeviceLogs}>
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
    );
};
