import { TriggerStrategy } from '../../../../types';

export interface SessionFormData {
    triggerStrategy: TriggerStrategy;
    type: 'fixed' | 'random' | 'time-range';
    timeRangeSelection?: 'short' | 'medium' | 'long';
    duration?: number;
    rangeMin?: number;
    rangeMax?: number;
    hideTimer: boolean;
    disableLED: boolean;
    useMultiChannelDelay: boolean;
    delayCh1: number;
    delayCh2?: number;
    delayCh3?: number;
    delayCh4?: number;
}
