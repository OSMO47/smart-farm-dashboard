import type { StatusInfo } from '../types/farm';
import { clamp } from '../lib/status';
import Sparkline from './Sparkline';

type SensorKind = 'temperature' | 'humidity' | 'soil';

interface RangeConfig {
  min: number;
  max: number;
  gradient: string;
  leftLabel: string;
  centerLabel: string;
  rightLabel: string;
}

const RANGE_CONFIG: Record<SensorKind, RangeConfig> = {
  temperature: {
    min: 10,
    max: 35,
    gradient:
      'linear-gradient(90deg,#ef4444 0%,#ef4444 24%,#f59e0b 24%,#f59e0b 32%,#22c55e 32%,#22c55e 64%,#f59e0b 64%,#f59e0b 80%,#ef4444 80%,#ef4444 100%)',
    leftLabel: '10°',
    centerLabel: 'ช่วงเหมาะสม 18–26°C',
    rightLabel: '35°',
  },
  humidity: {
    min: 30,
    max: 100,
    gradient:
      'linear-gradient(90deg,#22c55e 0%,#22c55e 78.6%,#f59e0b 78.6%,#f59e0b 85.7%,#ef4444 85.7%,#ef4444 100%)',
    leftLabel: '30%',
    centerLabel: 'เกิน 85% เสี่ยงราสีเทา',
    rightLabel: '100%',
  },
  soil: {
    min: 20,
    max: 90,
    gradient:
      'linear-gradient(90deg,#ef4444 0%,#ef4444 14.3%,#f59e0b 14.3%,#f59e0b 28.6%,#22c55e 28.6%,#22c55e 78.6%,#f59e0b 78.6%,#f59e0b 85.7%,#ef4444 85.7%,#ef4444 100%)',
    leftLabel: '20%',
    centerLabel: 'เฉลี่ยจาก 8 แปลง · เหมาะสม 40–75%',
    rightLabel: '90%',
  },
};

interface SensorCardProps {
  kind: SensorKind;
  title: string;
  titleEn: string;
  value: string;
  unit: string;
  status: StatusInfo;
  history: number[];
}

export default function SensorCard({ kind, title, titleEn, value, unit, status, history }: SensorCardProps) {
  const range = RANGE_CONFIG[kind];
  const numericValue = parseFloat(value);
  const markerPercent = clamp(
    ((numericValue - range.min) / (range.max - range.min)) * 100,
    0,
    100,
  );

  return (
    <div
      className="flex-1 min-w-[150px] rounded-2xl p-4 pb-3.5"
      style={{ background: status.bg, border: `1px solid ${status.border}` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-bold text-[#5b6d61]">
          {title} · {titleEn}
        </div>
        <div
          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white"
          style={{ color: status.color, border: `1px solid ${status.border}` }}
        >
          {status.label}
        </div>
      </div>
      <div className="text-[30px] font-extrabold text-[#0f2016] mt-1.5">
        {value}
        <span className="text-base font-bold text-[#7c8d80]">{unit}</span>
      </div>
      <div className="h-2 rounded-full relative mt-3" style={{ background: range.gradient }}>
        <div
          className="absolute top-[-3px] bottom-[-3px] w-[3px] rounded-sm bg-[#0f2016]"
          style={{
            left: `${markerPercent}%`,
            transform: 'translateX(-50%)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.9)',
          }}
        />
      </div>
      <div className="flex justify-between text-[10.5px] text-[#93a39a] font-semibold mt-1.5">
        <span>{range.leftLabel}</span>
        <span>{range.centerLabel}</span>
        <span>{range.rightLabel}</span>
      </div>
      <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: status.border }}>
        <div className="text-[10px] font-semibold text-[#93a39a] mb-1">แนวโน้มล่าสุด · Trend</div>
        <Sparkline values={history} color={status.color} />
      </div>
    </div>
  );
}
