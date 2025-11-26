import { createContext, useContext } from 'react';

export interface KeyboardContextState {
    isHelpOpen: boolean;
    openHelp: () => void;
    closeHelp: () => void;

    /** * Registers the callback to be fired when 's' is pressed.
     * Useful for triggering navigation to the configuration step.
     */
    registerStartConfigAction: (callback: () => void) => void;
}

export const KeyboardContext = createContext<KeyboardContextState | undefined>(undefined);

export const useKeyboard = () => {
    const ctx = useContext(KeyboardContext);
    if (!ctx) throw new Error('useKeyboard must be used within a KeyboardProvider');
    return ctx;
};
