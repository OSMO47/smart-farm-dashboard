import { useEffect, useState } from 'react';
import type { PlotSchedule, PlotStatus } from '../types/farm';

const DEFAULT_START_TIME = '06:00';
const DEFAULT_DURATION_MINUTES = 15;

interface WateringScheduleListProps {
  plots: PlotStatus[];
  schedules: PlotSchedule[];
  onSave: (plotId: string, startTime: string, durationMinutes: number, enabled: boolean) => void;
}

function isCurrentlyActive(schedule: PlotSchedule | undefined): boolean {
  if (!schedule || !schedule.enabled) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [h, m] = schedule.startTime.split(':').map(Number);
  const startMinutes = h * 60 + m;
  const endMinutes = startMinutes + schedule.durationMinutes;
  if (endMinutes <= 24 * 60) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes - 24 * 60;
}

interface ScheduleRowProps {
  plot: PlotStatus;
  schedule: PlotSchedule | undefined;
  onSave: (plotId: string, startTime: string, durationMinutes: number, enabled: boolean) => void;
}

function ScheduleRow({ plot, schedule, onSave }: ScheduleRowProps) {
  const [startTime, setStartTime] = useState(schedule?.startTime ?? DEFAULT_START_TIME);
  const [duration, setDuration] = useState(String(schedule?.durationMinutes ?? DEFAULT_DURATION_MINUTES));
  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);
  const [dirty, setDirty] = useState(false);

  // Resync from the server-confirmed schedule once it first arrives (poll landed after mount) or
  // changes from elsewhere — but not while the user has unsaved local edits.
  useEffect(() => {
    if (dirty) return;
    setStartTime(schedule?.startTime ?? DEFAULT_START_TIME);
    setDuration(String(schedule?.durationMinutes ?? DEFAULT_DURATION_MINUTES));
    setEnabled(schedule?.enabled ?? false);
  }, [schedule, dirty]);

  const active = isCurrentlyActive(schedule);

  const handleSave = () => {
    const durationMinutes = parseInt(duration, 10);
    if (Number.isNaN(durationMinutes) || durationMinutes <= 0) return;
    onSave(plot.id, startTime, durationMinutes, enabled);
    setDirty(false);
  };

  return (
    <div className="flex items-center justify-between gap-2.5 px-3 py-2.5 border border-[#e6efe8] rounded-xl flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[12.5px] font-extrabold shrink-0"
          style={{ background: active ? '#2563eb' : '#eef2ef', color: active ? '#ffffff' : '#5b6d61' }}
        >
          {plot.id}
        </span>
        {active && (
          <span className="text-[10.5px] font-bold text-[#2563eb] bg-[#eff6ff] border border-[#bfdbfe] px-2 py-0.5 rounded-full whitespace-nowrap">
            กำลังรดน้ำตามตาราง
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="time"
          value={startTime}
          onChange={(e) => {
            setStartTime(e.target.value);
            setDirty(true);
          }}
          className="text-[13px] px-2 py-1.5 rounded-lg border border-[#d9e8dd] focus:outline-none focus:border-[#1f9d55] w-[100px]"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setDirty(true);
            }}
            className="text-[13px] px-2 py-1.5 rounded-lg border border-[#d9e8dd] focus:outline-none focus:border-[#1f9d55] w-[64px]"
          />
          <span className="text-[11.5px] text-[#7c8d80]">นาที</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`เปิดใช้ตารางรดน้ำแปลง ${plot.id}`}
          onClick={() => {
            setEnabled((prev) => !prev);
            setDirty(true);
          }}
          className="w-[42px] h-[26px] rounded-full p-[3px] shrink-0 flex items-center transition-colors duration-200 cursor-pointer"
          style={{ background: enabled ? '#16a34a' : '#d7e2db' }}
        >
          <span
            className="w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200"
            style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }}
          />
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className="text-[12px] font-bold text-white px-3 py-1.5 rounded-lg shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: '#1f9d55' }}
        >
          บันทึก
        </button>
      </div>
    </div>
  );
}

export default function WateringScheduleList({ plots, schedules, onSave }: WateringScheduleListProps) {
  const scheduleByPlot = new Map(schedules.map((s) => [s.plotId, s]));

  return (
    <div className="bg-white border border-[#e1ebe3] rounded-[20px] p-[22px] shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
      <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2">
        <h2 className="m-0 text-[16.5px] font-bold text-[#0f2016]">ตารางรดน้ำอัตโนมัติ · Watering Schedule</h2>
        <div className="text-xs text-[#7c8d80] font-medium">ทำงานที่ backend — รันต่อแม้ปิดหน้าเว็บ</div>
      </div>
      <div className="flex flex-col gap-2">
        {plots.map((plot) => (
          <ScheduleRow key={plot.id} plot={plot} schedule={scheduleByPlot.get(plot.id)} onSave={onSave} />
        ))}
      </div>
    </div>
  );
}
