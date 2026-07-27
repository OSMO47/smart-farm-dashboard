import type { HistoryPoint, RangeConfig, SimulatorConfig, SimulatorMetric, ZoneStatus } from '../types/farm';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export type DeviceName = 'pump' | 'fan' | 'light';

export async function fetchZoneStatus(): Promise<ZoneStatus> {
  const res = await fetch(`${API_BASE_URL}/api/zone1/status`);
  if (!res.ok) throw new Error(`โหลดสถานะไม่สำเร็จ (${res.status})`);
  return res.json();
}

export async function setActuator(device: DeviceName, on: boolean): Promise<ZoneStatus> {
  const res = await fetch(`${API_BASE_URL}/api/zone1/actuator/${device}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on }),
  });
  if (!res.ok) throw new Error(`สั่งงาน ${device} ไม่สำเร็จ (${res.status})`);
  return res.json();
}

export async function setValve(plotId: string, open: boolean): Promise<ZoneStatus> {
  const res = await fetch(`${API_BASE_URL}/api/zone1/plot/${plotId}/valve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ open }),
  });
  if (!res.ok) throw new Error(`สั่งงานวาล์วแปลง ${plotId} ไม่สำเร็จ (${res.status})`);
  return res.json();
}

export async function fetchHistory(hours = 6): Promise<HistoryPoint[]> {
  const res = await fetch(`${API_BASE_URL}/api/zone1/history?hours=${hours}`);
  if (!res.ok) throw new Error(`โหลดประวัติข้อมูลไม่สำเร็จ (${res.status})`);
  return res.json();
}

export async function fetchSimulatorConfig(): Promise<SimulatorConfig> {
  const res = await fetch(`${API_BASE_URL}/api/zone1/simulator/config`);
  if (!res.ok) throw new Error(`โหลดค่าตั้งค่า simulator ไม่สำเร็จ (${res.status})`);
  return res.json();
}

export interface SimulatorConfigPatch {
  paused?: boolean;
  ranges?: Partial<Record<SimulatorMetric, Partial<RangeConfig>>>;
}

export async function updateSimulatorConfig(patch: SimulatorConfigPatch): Promise<SimulatorConfig> {
  const res = await fetch(`${API_BASE_URL}/api/zone1/simulator/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`อัปเดตค่าตั้งค่า simulator ไม่สำเร็จ (${res.status})`);
  return res.json();
}
