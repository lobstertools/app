import { theme as antdTheme, Card, Space, Typography } from 'antd';
import { useAppRuntime } from '../../context/AppRuntimeContext';
import { useDeviceManager } from '../../context/DeviceManagerContext';
import { useSession } from '../../context/SessionContext';

const { Text } = Typography;

/**
 * Renders a <pre> block for displaying debug JSON.
 */
const DebugJsonBlock = ({ title, data }: { title: string; data: unknown }) => {
    const { token } = antdTheme.useToken();
    return (
        <div>
            <Text strong>{title}</Text>
            <Card
                size="small"
                style={{
                    background: token.colorFillAlter,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginTop: 4,
                }}
            >
                <pre
                    style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                    }}
                >
                    {JSON.stringify(data, null, 2)}
                </pre>
            </Card>
        </div>
    );
};

/**
 * A component that displays the internal state of all major contexts.
 * Intended for use in a development-only debug modal.
 */
export const InternalDebugView = () => {
    // 1. App Runtime State
    const appRuntimeState = useAppRuntime();

    // 2. Device Manager State
    const { connectionHealth, activeDevice, discoveredDevices, serialPorts } =
        useDeviceManager();

    // 3. Session State
    const {
        currentState,
        status: rawDeviceStatus,
        rewardHistory,
    } = useSession();

    return (
        <Space direction="vertical" style={{ width: '100%' }}>
            <DebugJsonBlock title="AppRuntimeContext" data={appRuntimeState} />
            <DebugJsonBlock
                title="DeviceManagerContext"
                data={{
                    connectionHealth,
                    activeDevice,
                    discoveredDevices,
                    serialPorts,
                }}
            />
            <DebugJsonBlock
                title="SessionContext"
                data={{
                    currentState,
                    rawDeviceStatus,
                    rewardHistory,
                }}
            />
        </Space>
    );
};
