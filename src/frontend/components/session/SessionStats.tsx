import { useSession } from '../../context/useSessionContext';
import { Space, Tag, Tooltip } from 'antd';
import { FireOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { formatSeconds } from '../../utils/time';
import { useDeviceManager } from '../../context/useDeviceManager';

/**
 * A small component that displays the user's high-level session stats.
 */
export const SessionStats = () => {
    const { activeDevice } = useDeviceManager();
    const { status } = useSession();

    if (activeDevice?.deterrents.enableStreaks === false) {
        return <></>;
    }

    // Don't render anything if there's no device status or stats object
    if (!status || !status.stats) {
        return null;
    }

    const { streaks = 0, totalTimeLocked = 0, completed = 0, aborted = 0, pendingPayback = 0 } = status.stats;

    // Standard spacing style for icons inside tags
    const iconStyle = { marginRight: 4 };

    return (
        <Space size={4}>
            <Tooltip title="Current Session Streak">
                <Tag icon={<FireOutlined style={iconStyle} />} color="gold" style={{ margin: 0 }}>
                    {streaks}
                </Tag>
            </Tooltip>
            <Tooltip title="Total Time Locked">
                <Tag icon={<ClockCircleOutlined style={iconStyle} />} color="blue" style={{ margin: 0 }}>
                    {formatSeconds(totalTimeLocked)}
                </Tag>
            </Tooltip>
            <Tooltip title="Total Sessions Completed">
                <Tag icon={<CheckCircleOutlined style={iconStyle} />} color="green" style={{ margin: 0 }}>
                    {completed}
                </Tag>
            </Tooltip>
            <Tooltip title="Total Sessions Aborted">
                <Tag icon={<CloseCircleOutlined style={iconStyle} />} color="red" style={{ margin: 0 }}>
                    {aborted}
                </Tag>
            </Tooltip>
            {pendingPayback > 0 && (
                <Tooltip title="Accumulated Payback Debt">
                    <Tag icon={<WarningOutlined style={iconStyle} />} color="volcano" style={{ margin: 0 }}>
                        {formatSeconds(pendingPayback)}
                    </Tag>
                </Tooltip>
            )}
        </Space>
    );
};
