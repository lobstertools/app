import { Alert, Space, Statistic } from 'antd';
import { red } from '@ant-design/colors';
import { formatSeconds } from '../../../../utils/time';

interface ActiveStageProps {
    currentState: string;
    enableRewardCode: boolean;
    penaltyTimeRemaining: number;
}

export const ActiveStage = ({ currentState, enableRewardCode, penaltyTimeRemaining }: ActiveStageProps) => {
    const isLocked = currentState === 'LOCKED';

    let description = '';
    if (isLocked) {
        description = enableRewardCode
            ? 'The MagLock is engaged. Wait for the timer to end to get the code for the reward lock.'
            : 'The MagLock is engaged. Wait for the timer to end to complete the session.';
    } else {
        description = enableRewardCode
            ? 'The MagLock has disengaged. The code for the reward lock remains hidden until the penalty cooldown ends.'
            : 'The MagLock has disengaged. The session will remain in penalty state until the cooldown ends.';
    }

    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
                message={isLocked ? 'Session Active' : 'Penalty Cooldown'}
                description={description}
                type={isLocked ? 'info' : 'error'}
                showIcon
            />

            {!isLocked && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <Statistic
                        title="Penalty Time Remaining"
                        value={formatSeconds(penaltyTimeRemaining)}
                        valueStyle={{
                            fontSize: '2.5rem',
                            fontFamily: 'monospace',
                            color: red[5],
                        }}
                    />
                </div>
            )}
        </Space>
    );
};
