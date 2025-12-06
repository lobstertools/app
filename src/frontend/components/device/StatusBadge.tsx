import { useSession } from '../../context/useSessionContext';
import { red, blue, grey, purple } from '@ant-design/colors';
import { Typography, Space } from 'antd';

const { Text } = Typography;

/**
 * Displays the current status badge (Locked, Ready, etc.) in the header.
 */
export const StatusBadge = () => {
    const { currentState } = useSession();

    /**
     * Renders the colored status badge based on the current session state.
     */
    const renderSessionStatusBadge = () => {
        let color: string;
        let text: string;

        switch (currentState) {
            case 'validating':
                color = '#8c8c8c';
                text = 'VALIDATING (System Checks)';
                break;
            // --- Session States ---
            case 'locked':
                color = '#faad14';
                text = 'LOCKED (Session Running)';
                break;
            case 'aborted':
                color = red[5];
                text = 'ABORTED (Penalty Active)';
                break;
            case 'completed':
                color = purple[5];
                text = 'COMPLETED (Waiting for Reboot)';
                break;
            case 'ready':
                color = '#52c41a';
                text = 'READY (Waiting for Session)';
                break;
            case 'armed':
                color = blue[5];
                text = 'ARMED (Waiting for Trigger)';
                break;
            case 'testing':
                color = blue[5];
                text = 'TESTING';
                break;

            // --- Connection / App States ---
            case 'no_device_selected':
                color = grey[5];
                text = 'NO DEVICE SELECTED';
                break;
            case 'device_unreachable':
                color = red[5];
                text = 'DEVICE UNREACHABLE';
                break;
            case 'server_unreachable':
                color = red[5];
                text = 'SERVER UNREACHABLE';
                break;
            case 'connecting':
                color = grey[5];
                text = 'CONNECTING...';
                break;
            default:
                color = grey[5];
                text = 'OFFLINE';
                break;
        }

        const badgeStyle: React.CSSProperties = {
            lineHeight: 1,
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: color,
            color: '#fff',
            display: 'inline-block',
        };

        const badgeContent = (
            <Space size={4}>
                <Text style={{ color: '#fff', margin: 0 }} strong>
                    {text}
                </Text>
            </Space>
        );

        return <div style={badgeStyle}>{badgeContent}</div>;
    };

    return <>{renderSessionStatusBadge()}</>;
};
