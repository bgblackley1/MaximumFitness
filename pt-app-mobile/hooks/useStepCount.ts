import { useState, useEffect, useCallback } from 'react';
import { Pedometer } from 'expo-sensors';

export const DAILY_STEP_GOAL = 10_000;

export interface StepData {
  steps: number | null;
  isGranted: boolean;
  isLoading: boolean;
}

/**
 * Requests motion/activity permission on first mount and returns today's
 * step count, refreshed every 60 seconds.
 *
 * Returns { isGranted: false } — and nothing is rendered — when:
 *  • Running on web (Pedometer unavailable)
 *  • Device has no step sensor
 *  • User denies the OS permission prompt
 */
export function useStepCount(): StepData {
  const [steps,     setSteps]     = useState<number | null>(null);
  const [isGranted, setIsGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTodaySteps = useCallback(async (): Promise<void> => {
    const now        = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    try {
      const result = await Pedometer.getStepCountAsync(startOfDay, now);
      setSteps(result.steps);
    } catch (err) {
      console.warn('[useStepCount] getStepCountAsync failed:', err);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        // 1. Hardware / platform check (returns false on web, simulator w/o motion)
        const available = await Pedometer.isAvailableAsync();
        if (!available) return;

        // 2. OS permission prompt — iOS shows a dialog, Android uses runtime perm
        const { status } = await Pedometer.requestPermissionsAsync();
        if (status !== 'granted') return;

        // 3. Granted — fetch immediately then poll every minute
        setIsGranted(true);
        await fetchTodaySteps();
        interval = setInterval(fetchTodaySteps, 60_000);
      } catch (err) {
        console.warn('[useStepCount] initialise failed:', err);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchTodaySteps]);

  return { steps, isGranted, isLoading };
}