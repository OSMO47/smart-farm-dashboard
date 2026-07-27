import type { ZoneStatus } from '../types/farm';

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
