import { Modal, Table, Typography } from 'antd';
import { useKeyboard } from '../../context/useKeyboardContext';

const { Text } = Typography;

export const KeyboardHelpModal = () => {
    const { isHelpOpen, closeHelp } = useKeyboard();

    const dataSource = [
        { key: 'b', action: 'Abort Session / Break', context: 'When Armed, Locked, or Testing' },
        { key: 't', action: 'Start Hardware Test', context: 'When Device is Ready' },
        { key: 'm', action: 'Open Device Manager', context: 'Global' },
        { key: 'd', action: 'Device Settings', context: 'When Device is Ready' },
        { key: 's', action: 'Start Configuration', context: 'Global (Navigation)' },
        { key: 'l', action: 'Open Device Logs', context: 'Global' },
        { key: '?', action: 'Toggle this Help Menu', context: 'Global' },
    ];

    const columns = [
        {
            title: 'Key',
            dataIndex: 'key',
            key: 'key',
            render: (text: string) => (
                <Text keyboard strong>
                    {text}
                </Text>
            ),
            width: 80,
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
        },
        {
            title: 'Context',
            dataIndex: 'context',
            key: 'context',
            render: (text: string) => <Text type="secondary">{text}</Text>,
        },
    ];

    return (
        <Modal title="Keyboard Shortcuts" open={isHelpOpen} onCancel={closeHelp} footer={null} centered>
            <Table dataSource={dataSource} columns={columns} pagination={false} size="small" rowKey="key" />
        </Modal>
    );
};
