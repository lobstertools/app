import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from 'react';

import '../types/electron.d.ts'; // This import is still needed for window.api

interface AppRuntimeContextState {
    /** Is the app running inside an Electron shell? */
    isElectron: boolean;
    /** Has the backend signaled that it's ready? */
    isBackendReady: boolean;
}

const AppRuntimeContext = createContext<AppRuntimeContextState | undefined>(
    undefined
);

/**
 * Provides context on the app's runtime (Electron vs. Browser)
 * and whether the backend is ready for API calls.
 */
export const useAppRuntime = () => {
    const ctx = useContext(AppRuntimeContext);
    if (!ctx)
        throw new Error(
            'useAppRuntime must be used within an AppRuntimeProvider'
        );
    return ctx;
};

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
