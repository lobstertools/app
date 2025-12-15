import { useState, useMemo } from 'react';
import { Form } from 'antd';
import { SessionFormData } from '../types';
import { DurationType, SessionConfig } from '../../../../../types';
import { useDeviceManager } from '../../../../context/useDeviceManager';
import { useSession } from '../../../../context/useSessionContext';

export const useConfigForm = () => {
    const { activeDevice } = useDeviceManager();
    const { startSession } = useSession();
    const [form] = Form.useForm<SessionFormData>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Watchers for UI state
    const selectedStrategy = Form.useWatch('triggerStrategy', form);
    const useMultiDelay = Form.useWatch('useMultiChannelDelay', form);
    const isManualTrigger = selectedStrategy === 'STRAT_BUTTON_TRIGGER';

    // ------------------------------------------------------------------------
    // 1. ADAPTIVE TIME SCALING
    // ------------------------------------------------------------------------
    const isDebugMode = useMemo(() => {
        const buildType = activeDevice?.identity?.buildType;
        return buildType === 'debug' || buildType === 'mock';
    }, [activeDevice?.identity?.buildType]);

    const timeScale = isDebugMode ? 1 : 60;
    const unitLabel = isDebugMode ? 'sec' : 'min';

    // ------------------------------------------------------------------------
    // 2. DYNAMIC SYSTEM LIMITS
    // ------------------------------------------------------------------------
    const minLockUnit = useMemo(
        () => Math.ceil((activeDevice?.presets?.minSessionDuration || 900) / timeScale),
        [activeDevice?.presets?.minSessionDuration, timeScale]
    );
    const maxLockUnit = useMemo(
        () => Math.floor((activeDevice?.presets?.maxSessionDuration || 10800) / timeScale),
        [activeDevice?.presets?.maxSessionDuration, timeScale]
    );

    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

    // ------------------------------------------------------------------------
    // 3. SMART DEFAULTS
    // ------------------------------------------------------------------------
    const presetValues = useMemo(() => {
        const p = activeDevice?.presets;
        const scale = (val: number | undefined, fallback: number) => Math.round((val ?? fallback) / timeScale);

        return {
            shortMin: scale(p?.shortMin, 1200),
            shortMax: scale(p?.shortMax, 2700),
            mediumMin: scale(p?.mediumMin, 3600),
            mediumMax: scale(p?.mediumMax, 5400),
            longMin: scale(p?.longMin, 7200),
            longMax: scale(p?.longMax, 10800),
            defaultFixed: Math.floor((minLockUnit + maxLockUnit) / 2),
            globalMin: minLockUnit,
            globalMax: maxLockUnit,
        };
    }, [activeDevice?.presets, timeScale, minLockUnit, maxLockUnit]);

    const defaultValues = useMemo(
        () => ({
            duration: presetValues.defaultFixed,
            rangeMin: presetValues.globalMin,
            rangeMax: presetValues.globalMax,
        }),
        [presetValues]
    );

    // ------------------------------------------------------------------------
    // 4. SUBMISSION HANDLER
    // ------------------------------------------------------------------------
    const handleFinish = async (values: SessionFormData) => {
        setIsSubmitting(true);
        try {
            let finalDurationUnits: number;
            let calculatedMin = values.rangeMin || minLockUnit;
            let calculatedMax = values.rangeMax || maxLockUnit;
            let durationType: DurationType = 'DUR_FIXED';

            if (values.type === 'fixed') {
                durationType = 'DUR_FIXED';
                finalDurationUnits = values.duration || defaultValues.duration;
                calculatedMin = finalDurationUnits;
                calculatedMax = finalDurationUnits;
            } else if (values.type === 'random') {
                durationType = 'DUR_RANDOM';
                finalDurationUnits = 0;
            } else {
                switch (values.timeRangeSelection) {
                    case 'short':
                        durationType = 'DUR_RANGE_SHORT';
                        calculatedMin = presetValues.shortMin;
                        calculatedMax = presetValues.shortMax;
                        break;
                    case 'medium':
                        durationType = 'DUR_RANGE_MEDIUM';
                        calculatedMin = presetValues.mediumMin;
                        calculatedMax = presetValues.mediumMax;
                        break;
                    case 'long':
                        durationType = 'DUR_RANGE_LONG';
                        calculatedMin = presetValues.longMin;
                        calculatedMax = presetValues.longMax;
                        break;
                    default:
                        durationType = 'DUR_RANGE_SHORT';
                        calculatedMin = presetValues.shortMin;
                        calculatedMax = presetValues.shortMax;
                }
                finalDurationUnits = 0;
            }

            if (durationType === 'DUR_FIXED') {
                finalDurationUnits = clamp(finalDurationUnits, minLockUnit, maxLockUnit);
            }

            // Channel Delays Logic
            const channels = activeDevice?.channels;
            const masterDelay = values.delayCh1 || 0;

            const resolveDelay = (isEnabled: boolean | undefined, specificDelay: number | undefined) => {
                if (!isEnabled) return 0;
                return values.useMultiChannelDelay ? specificDelay || 0 : masterDelay;
            };

            const channelDelays: [number, number, number, number] = [
                resolveDelay(channels?.ch1, values.delayCh1),
                resolveDelay(channels?.ch2, values.delayCh2),
                resolveDelay(channels?.ch3, values.delayCh3),
                resolveDelay(channels?.ch4, values.delayCh4),
            ];

            const payload: SessionConfig = {
                triggerStrategy: values.triggerStrategy,
                hideTimer: !!values.hideTimer,
                disableLED: !!values.disableLED,
                durationType: durationType,
                durationFixed: finalDurationUnits * timeScale,
                durationMin: calculatedMin * timeScale,
                durationMax: calculatedMax * timeScale,
                channelDelays: channelDelays,
            };

            startSession(payload);
        } catch (e) {
            console.error(e);
            setIsSubmitting(false);
        }
    };

    return {
        form,
        isSubmitting,
        handleFinish,
        isManualTrigger,
        useMultiDelay,
        isDebugMode,
        timeScale,
        unitLabel,
        minLockUnit,
        maxLockUnit,
        presetValues,
        defaultValues,
    };
};
