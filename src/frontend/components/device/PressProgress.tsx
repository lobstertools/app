import { Progress, Typography } from 'antd';
const { Text } = Typography;

interface PressProgressProps {
    currentMs: number;
    thresholdMs: number;
    isPressed: boolean;
}

export const PressProgressBar = ({ currentMs, thresholdMs, isPressed }: PressProgressProps) => {
    // Calculate percentage (capped at 100%)
    const rawPercent = thresholdMs > 0 ? (currentMs / thresholdMs) * 100 : 0;
    const percent = Math.min(rawPercent, 100);

    // Visual Logic
    const isComplete = percent >= 100;
    const strokeColor = isComplete ? '#52c41a' : '#1890ff'; // Green if complete, Blue if holding
    const formatTime = (ms: number) => (ms / 1000).toFixed(1) + 's';

    return (
        <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    Hold Duration
                </Text>
                <Text style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    {formatTime(isPressed ? currentMs : 0)} / {formatTime(thresholdMs)}
                </Text>
            </div>
            <Progress
                percent={isPressed ? percent : 0} // Reset to 0 visually if button is released
                strokeColor={strokeColor}
                showInfo={false}
                size="small"
                status={isComplete ? 'success' : 'active'}
            />
        </div>
    );
};
