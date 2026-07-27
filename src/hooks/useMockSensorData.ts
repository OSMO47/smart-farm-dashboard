import { useEffect, useRef, useState } from 'react';
import type { DeviceState, HistoryPoint, PlotStatus, SensorReading } from '../types/farm';
import { generateMockPlots, generateMockReading, stepPlots, stepReading } from '../mock/mockData';

const UPDATE_INTERVAL_MS = 5000;
const HISTORY_LIMIT = 24;

interface SensorState {
  reading: SensorReading;
  plots: PlotStatus[];
  history: HistoryPoint[];
}

interface UseMockSensorDataResult {
  reading: SensorReading;
  plots: PlotStatus[];
  history: HistoryPoint[];
  toggleValve: (plotId: string) => void;
}

function toHistoryPoint(reading: SensorReading, plots: PlotStatus[]): HistoryPoint {
  return {
    temperature: reading.temperature,
    humidity: reading.humidity,
    soilAvg: plots.reduce((sum, p) => sum + p.soilMoisture, 0) / plots.length,
    timestamp: reading.timestamp,
  };
}

// Phase 1: จำลองข้อมูลเซนเซอร์ด้วย setInterval พร้อมเก็บประวัติสั้นๆ ไว้ทำ sparkline
// Phase 2: เปลี่ยน hook นี้ให้ดึงค่าจาก FastAPI (หรือ subscribe MQTT) แทนการสุ่มในเครื่อง
// ส่วนประวัติระยะยาวจะย้ายไปเก็บใน database ตาม Phase 4
export function useMockSensorData(devices: DeviceState): UseMockSensorDataResult {
  const [state, setState] = useState<SensorState>(() => {
    const reading = generateMockReading();
    const plots = generateMockPlots();
    return { reading, plots, history: [toHistoryPoint(reading, plots)] };
  });
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  useEffect(() => {
    const id = setInterval(() => {
      const { pump, fan, light } = devicesRef.current;
      setState((prev) => {
        const reading = stepReading(prev.reading, { fanOn: fan, lightOn: light });
        const plots = stepPlots(prev.plots, pump);
        const history = [...prev.history, toHistoryPoint(reading, plots)].slice(-HISTORY_LIMIT);
        return { reading, plots, history };
      });
    }, UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const toggleValve = (plotId: string) => {
    setState((prev) => ({
      ...prev,
      plots: prev.plots.map((plot) => (plot.id === plotId ? { ...plot, valveOpen: !plot.valveOpen } : plot)),
    }));
  };

  return { reading: state.reading, plots: state.plots, history: state.history, toggleValve };
}
