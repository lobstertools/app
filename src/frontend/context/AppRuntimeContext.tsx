import { ReactNode, useEffect, useState } from 'react';

import '../types/electron.d.ts'; // This import is still needed for window.api
import { AppRuntimeContext, AppRuntimeContextState } from './useAppRuntime.ts';

export const AppRuntimeProvider = ({ children }: { children: ReactNode }) => {
    const [isElectron, setIsElectron] = useState(false);
    const [isBackendReady, setIsBackendReady] = useState(false);

    useEffect(() => {
        let removeBackendListener: (() => void) | undefined;

        // Check for the Electron preload API on mount
        if (window.api) {
            setIsElectron(true);
            console.log(
                'Frontend (Electron): waiting for backend-ready signal...'
            );
            // This listener is defined in preload.cts
            removeBackendListener = window.api.onBackendReady(() => {
                console.log('Frontend Received: backend-ready signal!');
                setIsBackendReady(true);
            });
        } else {
            // BROWSER MODE:
            // We are in a standalone browser. Assume the backend is ready.
            console.log(
                'Frontend (Browser): Standalone mode. Assuming backend is ready.'
            );
            setIsElectron(false);
            setIsBackendReady(true);
        }

        // Cleanup listener on unmount
        return () => {
            if (removeBackendListener) {
                removeBackendListener();
            }
        };
    }, []); // This effect runs only once on mount

    const value: AppRuntimeContextState = {
        isElectron,
        isBackendReady,
    };

    return (
        <AppRuntimeContext.Provider value={value}>
            {children}
        </AppRuntimeContext.Provider>
    );
};
