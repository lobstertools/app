import { ReactNode, useEffect, useState } from 'react';

import { AppRuntimeContext, AppRuntimeContextState } from './useAppRuntime.ts';
import { BuildType } from '../../types/index.ts';

// --- LocalStorage Keys ---
const LOCALE_STORAGE_KEY = 'lobster-app-locale';
const WELCOME_STORAGE_KEY = 'lobster-show-welcome-on-startup';

export const AppRuntimeProvider = ({ children }: { children: ReactNode }) => {
    const [isElectron, setIsElectron] = useState(false);
    const [isBackendReady, setIsBackendReady] = useState(false);

    // Is the app running in a dev environment (Vite)?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDevelopmentMode = (import.meta as any).env?.DEV || false;

    // --- Application Version ---
    // VITE_APP_VERSION is injected by the build process (see .github/workflows/build-app.yml)
    // It defaults to '0.0.0-dev' if not provided (e.g., in local dev)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let version = (import.meta as any).env?.VITE_APP_VERSION || '0.0.0-debug';
    version = version.toLowerCase();

    let buildType: BuildType = 'release';

    // Determine BuildType based on version string priorities
    // Priority: Mock -> Debug -> Beta -> Release
    if (version.includes('mock')) {
        buildType = 'mock';
    } else if (version.includes('debug')) {
        buildType = 'debug';
    } else if (version.includes('beta')) {
        buildType = 'beta';
    } else {
        // Fallback for standard production builds
        // Ensure 'release' is added to your BuildType union type
        buildType = 'release';
    }

    // --- Persistent Welcome Screen State ---
    const [showWelcomeOnStartup, setShowWelcomeOnStartupState] = useState(() => {
        const saved = localStorage.getItem(WELCOME_STORAGE_KEY); // Use constant
        // Default to 'true' if it's not found
        return saved === null ? true : JSON.parse(saved);
    });

    // --- Temporary Modal State ---
    const [isWelcomeGuideOpen, setWelcomeGuideOpen] = useState(false);
    const [isAboutModalOpen, setAboutModalOpen] = useState(false);

    // --- Application Settings State ---
    const [isAppSettingsModalOpen, setAppSettingsModalOpen] = useState(false);
    const [locale, setLocaleState] = useState(() => {
        const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
        // Default to '' (browser default) if not found
        return savedLocale === null ? '' : savedLocale;
    });

    /**
     * Updates the persistent setting in state and localStorage.
     */
    const setShowWelcomeOnStartup = (show: boolean) => {
        setShowWelcomeOnStartupState(show);
        localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(show)); // Use constant
    };

    /**
     * Updates the locale in state and localStorage.
     */
    const setLocale = (newLocale: string) => {
        setLocaleState(newLocale);
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    };

    useEffect(() => {
        let removeBackendListener: (() => void) | undefined;
        let removeAboutListener: (() => void) | undefined;

        // Check for the Electron preload API on mount
        if (window.api) {
            setIsElectron(true);
            console.log('Frontend (Electron): waiting for backend-ready signal...');

            // Existing Backend Ready Listener
            removeBackendListener = window.api.onBackendReady(() => {
                console.log('Frontend Received: backend-ready signal!');
                setIsBackendReady(true);
            });

            // NEW: Listen for "About" menu click
            removeAboutListener = window.api.onOpenAboutModal(() => {
                console.log('Frontend Received: open-about-modal signal');
                setAboutModalOpen(true);
            });
        } else {
            // BROWSER MODE logic...
            console.log('Frontend (Browser): Standalone mode. Assuming backend is ready.');
            setIsElectron(false);
            setIsBackendReady(true);
        }

        // Cleanup listeners on unmount
        return () => {
            if (removeBackendListener) removeBackendListener();
            if (removeAboutListener) removeAboutListener();
        };
    }, []);

    const value: AppRuntimeContextState = {
        isElectron,
        isBackendReady,
        isDevelopmentMode,
        version,
        buildType,
        // Welcome
        showWelcomeOnStartup,
        setShowWelcomeOnStartup,
        isWelcomeGuideOpen,
        setWelcomeGuideOpen,
        // Settings
        isAppSettingsModalOpen,
        setAppSettingsModalOpen,
        locale,
        setLocale,
        // About
        isAboutModalOpen,
        setAboutModalOpen,
    };

    return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
};
