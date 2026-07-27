import type { PlotStatus, SensorReading, ZoneStatus } from '../types/farm';
import { clamp } from '../lib/status';

export const PLOT_IDS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];

// สุ่มค่าเริ่มต้นในช่วงที่สมจริงสำหรับสตรอว์เบอร์รี่ในโรงเรือน
export function generateMockReading(): SensorReading {
  return {
    temperature: 18 + Math.random() * 8, // 18-26
    humidity: 55 + Math.random() * 35, // 55-90
    soilMoisture: 40 + Math.random() * 35, // 40-75
    timestamp: new Date().toISOString(),
  };
}

export function generateMockPlots(): PlotStatus[] {
  return PLOT_IDS.map((id, i) => ({
    id,
    soilMoisture: 44 + ((i * 7) % 30),
    valveOpen: i === 1 || i === 5,
  }));
}

export function generateMockZoneStatus(): ZoneStatus {
  const reading = generateMockReading();
  return {
    ...reading,
    pump: true,
    fan: false,
    light: true,
    zoneId: 'zone1',
    zoneName: 'โซน 1',
    plots: generateMockPlots(),
  };
}

// เดินสุ่มค่าถัดไปแบบต่อเนื่อง (random walk) ให้ตัวเลขดูสมจริงเมื่ออัปเดตทุกไม่กี่วินาที
export function stepReading(
  prev: SensorReading,
  { fanOn, lightOn }: { fanOn: boolean; lightOn: boolean },
): SensorReading {
  const temperature = clamp(
    prev.temperature + (Math.random() - 0.5) * 0.8 + (fanOn ? -0.3 : 0) + (lightOn ? 0.15 : 0),
    14,
    33,
  );
  const humidity = clamp(prev.humidity + (Math.random() - 0.5) * 2.5 + (fanOn ? -1.2 : 0.3), 40, 97);
  return {
    temperature,
    humidity,
    soilMoisture: prev.soilMoisture,
    timestamp: new Date().toISOString(),
  };
}

export function stepPlots(prev: PlotStatus[], pumpOn: boolean): PlotStatus[] {
  return prev.map((plot, i) => {
    const dryRate = 0.4 + ((i * 13) % 10) / 18;
    const soilMoisture = clamp(
      plot.soilMoisture + (Math.random() - 0.5) * 1.2 + (pumpOn && plot.valveOpen ? 2.4 : -dryRate),
      22,
      90,
    );
    return { ...plot, soilMoisture };
  });
}
