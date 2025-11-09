import { createContext, useContext } from 'react';
import { DeviceManagerContextState } from '../../types';

export interface DeviceHealthResponse {
    status: 'ok' | 'error';
    message: string;
}

export const DeviceManagerContext = createContext<
    DeviceManagerContextState | undefined
>(undefined);

/**
 * Custom hook to consume the DeviceManagerContext.
 * Provides access to all device state and management functions.
 */
export const useDeviceManager = () => {
    const ctx = useContext(DeviceManagerContext);
    if (!ctx)
        throw new Error(
            'useDeviceManager must be used within a DeviceManagerProvider'
        );
    return ctx;
};
