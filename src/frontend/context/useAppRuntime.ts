import { createContext, useContext } from 'react';

export interface AppRuntimeContextState {
    /** Is the app running inside an Electron shell? */
    isElectron: boolean;
    /** Has the backend signaled that it's ready? */
    isBackendReady: boolean;
}

export const AppRuntimeContext = createContext<
    AppRuntimeContextState | undefined
>(undefined);

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
