// src/components/session/SessionStats.tsx

import { useSession } from '../../context/useSessionContext';
import { Space, Tag, Tooltip } from 'antd';
import {
    FireOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    WarningOutlined,
} from '@ant-design/icons';

/**
 * Helper function to format seconds into a readable string (e.g., "12h 30m")
 */
const formatSeconds = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 60) return '0m';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

/**
 * A small component that displays the user's high-level session stats.
 */
export const SessionStats = () => {
    // The 'status' object is provided by the context
    const { status } = useSession();

    // Don't render anything if there's no device status or stats object
    if (!status || !status.stats) {
        return null;
    }

    // Extract stats from the nested 'stats' object.
    const {
        streaks = 0,
        totalTimeLockedSeconds = 0,
        completed = 0,
        aborted = 0,
        pendingPaybackSeconds = 0,
    } = status.stats;

    return (
        <Space size="small">
            <Tooltip title="Current Session Streak">
                <Tag icon={<FireOutlined />} color="gold" style={{ margin: 0 }}>
                    {streaks}
                </Tag>
            </Tooltip>
            <Tooltip title="Total Time Locked">
                <Tag icon={<ClockCircleOutlined />} color="blue" style={{ margin: 0 }}>
                    {formatSeconds(totalTimeLockedSeconds)}
                </Tag>
            </Tooltip>
            <Tooltip title="Total Sessions Completed">
                <Tag icon={<CheckCircleOutlined />} color="green" style={{ margin: 0 }}>
                    {completed}
                </Tag>
            </Tooltip>
            <Tooltip title="Total Sessions Aborted">
                <Tag icon={<CloseCircleOutlined />} color="red" style={{ margin: 0 }}>
                    {aborted}
                </Tag>
            </Tooltip>
            {pendingPaybackSeconds > 0 && (
                <Tooltip title="Accumulated Payback Debt">
                    <Tag icon={<WarningOutlined />} color="volcano" style={{ margin: 0 }}>
                        {formatSeconds(pendingPaybackSeconds)}
                    </Tag>
                </Tooltip>
            )}
        </Space>
    );
};
