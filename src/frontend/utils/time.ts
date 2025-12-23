/**
 * Converts a number of seconds into a HH:MM:SS string.
 * Optionally hides the seconds part (HH:MM).
 */
export const formatSeconds = (totalSeconds: number, showSeconds: boolean = true): string => {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');

    if (showSeconds) {
        const ss = String(seconds).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    return `${hh}:${mm}`;
};