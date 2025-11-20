import React from 'react';
import { useAppRuntime } from '../../context/useAppRuntime';
import { useDeviceManager } from '../../context/useDeviceManager';
import { Alert } from 'antd';

/**
 * A global banner that displays a warning if the system is in a
 * non-production state (Beta/Debug/Mock App, or Beta/Debug/Mock Firmware).
 */
export const BuildWarningBanner: React.FC = () => {
    // 1. Get the App Build Type
    const { buildType: appBuild } = useAppRuntime();
    const { activeDevice } = useDeviceManager();

    // 2. Get the Firmware Build Type
    const firmwareBuild = activeDevice?.buildType;

    // 3. Check for non-production states
    // We assume 'release' is the only production state.
    const isAppNonProd =
        appBuild === 'beta' || appBuild === 'debug' || appBuild === 'mock';

    const isFirmwareNonProd =
        firmwareBuild === 'beta' ||
        firmwareBuild === 'debug' ||
        firmwareBuild === 'mock';

    const showBanner = isAppNonProd || isFirmwareNonProd;

    if (!showBanner) {
        return null;
    }

    // 4. Build a list of active warnings
    const warnings: string[] = [];

    // -- App Warnings --
    if (appBuild === 'beta') {
        warnings.push('beta app');
    } else if (appBuild === 'debug') {
        warnings.push('debug app');
    } else if (appBuild === 'mock') {
        warnings.push('mock app');
    }

    // -- Firmware Warnings --
    if (firmwareBuild === 'beta') {
        warnings.push('beta firmware');
    } else if (firmwareBuild === 'debug') {
        warnings.push('debug firmware');
    } else if (firmwareBuild === 'mock') {
        warnings.push('mock firmware');
    }

    // 5. Format the list grammatically
    const versionString = formatList(warnings);

    // 6. Determine the alert title priority
    // If any part is 'debug', escalate the title to Debug.
    const isDebug = appBuild === 'debug' || firmwareBuild === 'debug';
    const title = isDebug ? 'Debug Build Detected' : 'Beta Version';

    const description = (
        <span>
            You are using a <strong>{versionString}</strong>. This is unfinished
            software currently in testing and not officially released. Please
            use with caution.
        </span>
    );

    return (
        <Alert
            message={title}
            description={description}
            type="warning"
            showIcon
            banner
        />
    );
};

/**
 * Helper to join a list of strings into a natural language sentence.
 */
function formatList(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;

    const last = items[items.length - 1];
    const rest = items.slice(0, -1);
    return `${rest.join(', ')}, and ${last}`;
}
