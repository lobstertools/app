import { createContext, useContext } from 'react';
import { ComputedAppStatus, Reward, SessionStatusResponse } from '../../types';

export const MAX_CHANNELS_TO_RENDER = 4;

export interface SessionFormData {
    type: 'time-range' | 'fixed' | 'random';
    timeRangeSelection: 'short' | 'medium' | 'long';
    duration?: number;
    rangeMin?: number;
    rangeMax?: number;
    hideTimer: boolean;
    penaltyDuration: number;

    delayCh1: number;
    delayCh2: number;
    delayCh3: number;
    delayCh4: number;

    /** Whether to apply specific delays per channel or use delayCh1 for all. */
    useMultiChannelDelay: boolean;
}

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
