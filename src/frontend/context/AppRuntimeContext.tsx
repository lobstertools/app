import { ReactNode, useEffect, useState } from 'react';

import '../types/electron.d.ts';
import { AppRuntimeContext, AppRuntimeContextState } from './useAppRuntime.ts';

// --- LocalStorage Keys ---
const LOCALE_STORAGE_KEY = 'lobster-app-locale';
const WELCOME_STORAGE_KEY = 'lobster-show-welcome-on-startup';

export const AppRuntimeProvider = ({ children }: { children: ReactNode }) => {
    const [isElectron, setIsElectron] = useState(false);
    const [isBackendReady, setIsBackendReady] = useState(false);

    // Is the app running in a dev environment (Vite)?
    const isDevelopmentMode = (import.meta as any).env?.DEV || false;

    // --- Persistent Welcome Screen State ---
    const [showWelcomeOnStartup, setShowWelcomeOnStartupState] = useState(
        () => {
            const saved = localStorage.getItem(WELCOME_STORAGE_KEY); // Use constant
            // Default to 'true' if it's not found
            return saved === null ? true : JSON.parse(saved);
        }
    );

    // --- Temporary Modal State ---
    const [isWelcomeGuideOpen, setWelcomeGuideOpen] = useState(false);

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
        isDevelopmentMode,
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
    };

    return (
        <AppRuntimeContext.Provider value={value}>
            {children}
        </AppRuntimeContext.Provider>
    );
};
