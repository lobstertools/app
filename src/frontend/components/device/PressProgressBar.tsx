import { useDeviceManager } from '../../context/useDeviceManager';
import { useSession } from '../../context/useSessionContext';

import { Progress, Typography } from 'antd';

const { Text } = Typography;

interface PressProgressBarProps {
    /**
     * Whether to hide the numeric time display (e.g., "1.2s / 5.0s").
     * @default true
     */
    hideTime?: boolean;

    /**
     * Whether to hide the 'Hold to abort' message.
     * @default false
     */
    hideTitle?: boolean;
}

export const PressProgressBar = ({ hideTime = true, hideTitle = false }: PressProgressBarProps) => {
    // 1. Access Global State
    const { status } = useSession();
    const { activeDevice } = useDeviceManager();

    // 2. Feature Check: Only render if the device supports the foot pedal
    const hasFootPedal = activeDevice?.features?.includes('footPedal');

    if (!hasFootPedal) {
        return null;
    }

    // 3. Derive specific values
    const isPressed = status?.telemetry?.buttonPressed ?? false;
    const currentMs = status?.telemetry?.currentPressDurationMs ?? 0;

    // Default to 0 if device settings aren't loaded yet
    const thresholdMs = (activeDevice?.defaults?.longPressDuration ?? 0) * 1000;

    // 4. Calculate percentage (capped at 100%)
    const rawPercent = thresholdMs > 0 ? (currentMs / thresholdMs) * 100 : 0;
    const percent = Math.min(rawPercent, 100);

    // 5. Visual Logic
    const isComplete = percent >= 100;
    const strokeColor = isComplete ? '#52c41a' : '#1890ff'; // Green if complete, Blue if holding
    const formatTime = (ms: number) => (ms / 1000).toFixed(1) + 's';

    // Safety: If threshold is 0 (config error or not loaded), don't render
    if (!thresholdMs) return null;

    return (
        <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                {!hideTitle && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        Hold to abort
                    </Text>
                )}
                {!hideTime && (
                    <Text style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                        {formatTime(isPressed ? currentMs : 0)} / {formatTime(thresholdMs)}
                    </Text>
                )}
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
