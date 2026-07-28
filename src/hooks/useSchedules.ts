import { useEffect, useState } from 'react';
import type { PlotSchedule } from '../types/farm';
import { fetchSchedules, updateSchedule } from '../api/client';

const POLL_INTERVAL_MS = 10000;

interface UseSchedulesResult {
  schedules: PlotSchedule[];
  error: string | null;
  saveSchedule: (plotId: string, startTime: string, durationMinutes: number, enabled: boolean) => Promise<void>;
}

// Backs the watering-schedule editor on the dashboard: polls the per-plot schedule rows
// (backend/app/scheduler.py acts on these independently, with or without this page open) and
// lets the page create/update one plot's schedule at a time.
export function useSchedules(): UseSchedulesResult {
  const [schedules, setSchedules] = useState<PlotSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await fetchSchedules();
        if (cancelled) return;
        setSchedules(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'โหลดตารางรดน้ำไม่สำเร็จ');
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const saveSchedule = async (plotId: string, startTime: string, durationMinutes: number, enabled: boolean) => {
    try {
      const saved = await updateSchedule(plotId, { startTime, durationMinutes, enabled });
      setSchedules((prev) => {
        const next = prev.filter((s) => s.plotId !== plotId);
        next.push(saved);
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `บันทึกตารางรดน้ำแปลง ${plotId} ไม่สำเร็จ`);
    }
  };

  return { schedules, error, saveSchedule };
}
