import { createContext, useContext } from 'react';

export interface AppRuntimeContextState {
    version: string;
    isBeta: boolean;
    isElectron: boolean;
    isBackendReady: boolean;
    isDevelopmentMode: boolean;
    // Welcome Guide
    showWelcomeOnStartup: boolean;
    setShowWelcomeOnStartup: (show: boolean) => void;
    isWelcomeGuideOpen: boolean;
    setWelcomeGuideOpen: (isOpen: boolean) => void;
    // App Settings
    isAppSettingsModalOpen: boolean;
    setAppSettingsModalOpen: (isOpen: boolean) => void;
    isAboutModalOpen: boolean;
    setAboutModalOpen: (isOpen: boolean) => void;
    locale: string;
    setLocale: (locale: string) => void;
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
