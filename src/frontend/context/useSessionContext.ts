import { createContext, useContext } from 'react';
import {
    ComputedAppStatus,
    Reward,
    SessionFormData,
    SessionStatusResponse,
} from '../../types';

export const MAX_CHANNELS_TO_RENDER = 4;

export interface SessionContextState {
    status: SessionStatusResponse | null;
    currentState: ComputedAppStatus;
    rewardHistory: Reward[];
    sessionTimeRemaining: number;
    channelDelays: number[];
    isLocking: boolean;

    // --- Session Functions---
    startSession: (values: SessionFormData) => void;
    abortSession: () => void;
    startTestSession: () => void;
}

// Create the context
export const SessionContext = createContext<SessionContextState | undefined>(
    undefined
);

/**
 * Custom hook to easily access the SessionContext.
 */
export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};
