import { useAppRuntime } from '../../context/useAppRuntime';
import { useDeviceManager } from '../../context/useDeviceManager';
import { Alert } from 'antd';

/**
 * A global banner that displays a warning if either the app
 * OR the connected device firmware is a beta version.
 */
export const BetaWarningBanner: React.FC = () => {
    const { isBeta: isAppBeta } = useAppRuntime();
    const { activeDevice } = useDeviceManager();

    // Check app beta status OR the active device's beta status
    const isFirmwareBeta = activeDevice?.isBeta || false;
    const showBanner = isAppBeta || isFirmwareBeta;

    if (!showBanner) {
        return null;
    }

    const appText = isAppBeta ? 'app' : '';
    const fwText = isFirmwareBeta ? 'firmware' : '';
    const conjunction = isAppBeta && isFirmwareBeta ? ' and ' : '';

    const versionType = `${appText}${conjunction}${fwText}`;

    const description = (
        <span>
            You are using a beta <strong>{versionType}</strong>. This is
            unfinished software currently in testing and not officially
            released. Please use with caution.
        </span>
    );

    return (
        <Alert
            message="Beta Version"
            description={description}
            type="warning"
            showIcon
            banner // Use banner style for full width, no border radius
        />
    );
};
