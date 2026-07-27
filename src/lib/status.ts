import type { StatusInfo, StatusLevel } from '../types/farm';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const STATUS: Record<StatusLevel, StatusInfo> = {
  safe: { level: 'safe', label: 'ปลอดภัย', color: '#16a34a', bg: '#ecfdf3', border: '#bbf0d0' },
  warn: { level: 'warn', label: 'เฝ้าระวัง', color: '#b45309', bg: '#fff7ed', border: '#fde3b8' },
  danger: { level: 'danger', label: 'อันตราย', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
};

// ช่วงเหมาะสมสำหรับสตรอว์เบอร์รี่ในโรงเรือน อ้างอิงจากเอกสารออกแบบโปรเจค
export function getTemperatureStatus(temperature: number): StatusInfo {
  if (temperature < 16 || temperature > 30) return STATUS.danger;
  if (temperature < 18 || temperature > 26) return STATUS.warn;
  return STATUS.safe;
}

// ความชื้นอากาศเกิน 85% เสี่ยงราสีเทาในผลสตรอว์เบอร์รี่ เกิน 90% ถือว่าอันตราย
export function getHumidityStatus(humidity: number): StatusInfo {
  if (humidity > 90) return STATUS.danger;
  if (humidity > 85) return STATUS.warn;
  return STATUS.safe;
}

export function getSoilMoistureStatus(soilMoisture: number): StatusInfo {
  if (soilMoisture < 30 || soilMoisture > 82) return STATUS.danger;
  if (soilMoisture < 40 || soilMoisture > 75) return STATUS.warn;
  return STATUS.safe;
}

export { STATUS };
