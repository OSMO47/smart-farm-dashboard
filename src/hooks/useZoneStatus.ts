import { useEffect, useRef, useState } from 'react';
import type { HistoryPoint, ZoneStatus } from '../types/farm';
import { fetchHistory, fetchZoneStatus, setActuator, setValve, type DeviceName } from '../api/client';

const POLL_INTERVAL_MS = 5000;
const HISTORY_LIMIT = 200;
const HISTORY_SEED_HOURS = 6;

function toHistoryPoint(status: ZoneStatus): HistoryPoint {
  const soilAvg = status.plots.reduce((sum, p) => sum + p.soilMoisture, 0) / status.plots.length;
  return { temperature: status.temperature, humidity: status.humidity, soilAvg, timestamp: status.timestamp };
}

interface UseZoneStatusResult {
  status: ZoneStatus | null;
  history: HistoryPoint[];
  error: string | null;
  setDevice: (device: DeviceName, on: boolean) => Promise<void>;
  toggleValve: (plotId: string, open: boolean) => Promise<void>;
}

// Phase 2: ดึงสถานะจริงจาก FastAPI mock backend ผ่าน HTTP polling ทุก 5 วินาที
// แทน useMockSensorData เดิมของ Phase 1 ที่สุ่มค่าในเบราว์เซอร์เอง
export function useZoneStatus(): UseZoneStatusResult {
  const [status, setStatus] = useState<ZoneStatus | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seenTimestamps = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await fetchZoneStatus();
        if (cancelled) return;
        setStatus(next);
        setError(null);
        if (!seenTimestamps.current.has(next.timestamp)) {
          seenTimestamps.current.add(next.timestamp);
          setHistory((prev) => [...prev, toHistoryPoint(next)].slice(-HISTORY_LIMIT));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'เชื่อมต่อ backend ไม่ได้');
      }
    };

    // Phase 4: seed the sparklines from Supabase-persisted history so they aren't blank on every
    // refresh. A failed seed is non-fatal — it must not trip the "backend unreachable" error state,
    // since live polling works fine independently of history.
    const seedHistory = async () => {
      try {
        const points = await fetchHistory(HISTORY_SEED_HOURS);
        if (cancelled || points.length === 0) return;
        points.forEach((p) => seenTimestamps.current.add(p.timestamp));
        setHistory(points.slice(-HISTORY_LIMIT));
      } catch {
        // no persisted history available — sparklines just start empty and fill up live, as before
      }
    };

    seedHistory().then(() => {
      if (cancelled) return;
      poll();
    });
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const setDevice = async (device: DeviceName, on: boolean) => {
    setStatus((prev) => (prev ? { ...prev, [device]: on } : prev));
    try {
      const next = await setActuator(device, on);
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `สั่งงาน ${device} ไม่สำเร็จ`);
    }
  };

  const toggleValve = async (plotId: string, open: boolean) => {
    setStatus((prev) =>
      prev ? { ...prev, plots: prev.plots.map((p) => (p.id === plotId ? { ...p, valveOpen: open } : p)) } : prev,
    );
    try {
      const next = await setValve(plotId, open);
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `สั่งงานวาล์วแปลง ${plotId} ไม่สำเร็จ`);
    }
  };

  return { status, history, error, setDevice, toggleValve };
}
