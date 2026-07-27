import { useEffect, useState } from 'react';
import type { SimulatorConfig, SimulatorMetric } from '../types/farm';
import { fetchSimulatorConfig, updateSimulatorConfig } from '../api/client';

const POLL_INTERVAL_MS = 5000;

interface UseSimulatorConfigResult {
  config: SimulatorConfig | null;
  error: string | null;
  setPaused: (paused: boolean) => Promise<void>;
  setRange: (metric: SimulatorMetric, min: number, max: number) => Promise<void>;
}

// Backs the Simulator Control page: polls the simulator's current config from the backend
// (same polling pattern as useZoneStatus.ts) and lets the page mutate it.
export function useSimulatorConfig(): UseSimulatorConfigResult {
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await fetchSimulatorConfig();
        if (cancelled) return;
        setConfig(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'เชื่อมต่อ simulator ไม่ได้');
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const setPaused = async (paused: boolean) => {
    setConfig((prev) => (prev ? { ...prev, paused } : prev));
    try {
      const next = await updateSimulatorConfig({ paused });
      setConfig(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สั่งหยุด/เริ่ม simulator ไม่สำเร็จ');
    }
  };

  const setRange = async (metric: SimulatorMetric, min: number, max: number) => {
    setConfig((prev) => (prev ? { ...prev, ranges: { ...prev.ranges, [metric]: { min, max } } } : prev));
    try {
      const next = await updateSimulatorConfig({ ranges: { [metric]: { min, max } } });
      setConfig(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `ปรับช่วงค่า ${metric} ไม่สำเร็จ`);
    }
  };

  return { config, error, setPaused, setRange };
}
