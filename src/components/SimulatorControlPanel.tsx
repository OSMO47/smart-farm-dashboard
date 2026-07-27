import { useEffect, useState } from 'react';
import type { SimulatorMetric } from '../types/farm';
import { useSimulatorConfig } from '../hooks/useSimulatorConfig';
import { useZoneStatus } from '../hooks/useZoneStatus';
import { getHumidityStatus, getSoilMoistureStatus, getTemperatureStatus } from '../lib/status';

const ACCENT = '#1f9d55';

const METRIC_META: Record<SimulatorMetric, { title: string; titleEn: string; unit: string }> = {
  temperature: { title: 'อุณหภูมิอากาศ', titleEn: 'Temp', unit: '°C' },
  humidity: { title: 'ความชื้นอากาศ', titleEn: 'Humidity', unit: '%' },
  soilMoisture: { title: 'ความชื้นดินเฉลี่ย', titleEn: 'Soil Avg', unit: '%' },
};

const DEFAULT_RANGES: Record<SimulatorMetric, { min: number; max: number }> = {
  temperature: { min: 14, max: 33 },
  humidity: { min: 40, max: 97 },
  soilMoisture: { min: 22, max: 90 },
};

function statusFor(metric: SimulatorMetric, value: number) {
  if (metric === 'temperature') return getTemperatureStatus(value);
  if (metric === 'humidity') return getHumidityStatus(value);
  return getSoilMoistureStatus(value);
}

interface MetricRangeCardProps {
  metric: SimulatorMetric;
  liveValue: number | undefined;
  range: { min: number; max: number };
  onApply: (min: number, max: number) => void;
}

function MetricRangeCard({ metric, liveValue, range, onApply }: MetricRangeCardProps) {
  const meta = METRIC_META[metric];
  const [minText, setMinText] = useState(() => String(range.min));
  const [maxText, setMaxText] = useState(() => String(range.max));
  const [validationError, setValidationError] = useState<string | null>(null);

  // Resync the inputs when the server-confirmed range actually changes (e.g. a preset button
  // applied a different metric's range, or Apply here just landed) — but not on every poll tick.
  useEffect(() => {
    setMinText(String(range.min));
    setMaxText(String(range.max));
  }, [range.min, range.max]);

  const status = liveValue !== undefined ? statusFor(metric, liveValue) : null;

  const handleApply = () => {
    const min = parseFloat(minText);
    const max = parseFloat(maxText);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      setValidationError('กรอกตัวเลขให้ครบ');
      return;
    }
    if (min >= max) {
      setValidationError('ค่าต่ำสุดต้องน้อยกว่าค่าสูงสุด');
      return;
    }
    setValidationError(null);
    onApply(min, max);
  };

  return (
    <div className="bg-white border border-[#e1ebe3] rounded-2xl p-[18px]">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[13.5px] font-bold text-[#0f2016]">
          {meta.title} · {meta.titleEn}
        </div>
        {status && (
          <div
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white"
            style={{ color: status.color, border: `1px solid ${status.border}` }}
          >
            {status.label}
          </div>
        )}
      </div>
      <div className="text-[26px] font-extrabold text-[#0f2016] mb-3">
        {liveValue !== undefined ? liveValue.toFixed(1) : '—'}
        <span className="text-base font-bold text-[#7c8d80]">{meta.unit}</span>
      </div>
      <div className="flex items-end gap-2.5">
        <label className="flex-1">
          <div className="text-[11px] font-semibold text-[#7c8d80] mb-1">ต่ำสุด · Min</div>
          <input
            type="number"
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            className="w-full text-[13.5px] px-2.5 py-1.5 rounded-lg border border-[#d9e8dd] focus:outline-none focus:border-[#1f9d55]"
          />
        </label>
        <label className="flex-1">
          <div className="text-[11px] font-semibold text-[#7c8d80] mb-1">สูงสุด · Max</div>
          <input
            type="number"
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            className="w-full text-[13.5px] px-2.5 py-1.5 rounded-lg border border-[#d9e8dd] focus:outline-none focus:border-[#1f9d55]"
          />
        </label>
        <button
          type="button"
          onClick={handleApply}
          className="text-[13px] font-bold text-white px-3.5 py-1.5 rounded-lg shrink-0"
          style={{ background: ACCENT }}
        >
          ปรับใช้
        </button>
      </div>
      {validationError && <div className="text-[11.5px] text-[#dc2626] mt-1.5">{validationError}</div>}
    </div>
  );
}

export default function SimulatorControlPanel() {
  const { config, error, setPaused, setRange } = useSimulatorConfig();
  const { status: zoneStatus } = useZoneStatus();

  if (!config) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white border border-[#e1ebe3] rounded-2xl p-8 shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
          {error ? (
            <>
              <div className="text-lg font-bold text-[#dc2626] mb-2">เชื่อมต่อ simulator ไม่ได้</div>
              <div className="text-sm text-[#5b6d61] mb-1">{error}</div>
              <div className="text-xs text-[#8a998f] mt-3">
                ตรวจสอบว่ารัน broker และ simulator อยู่:{' '}
                <code className="bg-[#f2f7f3] px-1.5 py-0.5 rounded">python -m broker.run_broker</code> และ{' '}
                <code className="bg-[#f2f7f3] px-1.5 py-0.5 rounded">python -m simulator.run_simulator</code>
              </div>
            </>
          ) : (
            <div className="text-sm text-[#5b6d61]">กำลังเชื่อมต่อ simulator...</div>
          )}
        </div>
      </div>
    );
  }

  const liveValues: Record<SimulatorMetric, number | undefined> = {
    temperature: zoneStatus?.temperature,
    humidity: zoneStatus?.humidity,
    soilMoisture: zoneStatus?.soilMoisture,
  };

  const applyPreset = (metric: SimulatorMetric, min: number, max: number) => {
    void setRange(metric, min, max);
  };

  const resetDefaults = () => {
    (Object.keys(DEFAULT_RANGES) as SimulatorMetric[]).forEach((metric) => {
      const { min, max } = DEFAULT_RANGES[metric];
      void setRange(metric, min, max);
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {error && (
        <div className="bg-[#fff7ed] border border-[#fde3b8] text-[#b45309] text-[13px] font-semibold rounded-xl px-4 py-2.5 mb-4">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-[#e1ebe3] rounded-2xl px-5 py-4 mb-4 shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
        <div>
          <div className="text-[14.5px] font-bold text-[#0f2016]">จำลองข้อมูลเซนเซอร์ · Simulator</div>
          <div className="text-[12.5px] text-[#7c8d80]">
            {config.paused
              ? 'หยุดชั่วคราว — ค่าทั้งหมดค้างที่ค่าล่าสุด (ใช้ทดสอบสถานะข้อมูลนิ่ง)'
              : 'กำลังจำลองค่าต่อเนื่อง ทุก 5 วินาที'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!config.paused}
          aria-label="Simulator running"
          onClick={() => void setPaused(!config.paused)}
          className="w-[50px] h-[30px] rounded-full p-[3px] shrink-0 flex items-center transition-colors duration-200 cursor-pointer"
          style={{ background: config.paused ? '#d7e2db' : '#16a34a' }}
        >
          <span
            className="w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200"
            style={{ transform: config.paused ? 'translateX(0)' : 'translateX(20px)' }}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
        <MetricRangeCard
          metric="temperature"
          liveValue={liveValues.temperature}
          range={config.ranges.temperature}
          onApply={(min, max) => void setRange('temperature', min, max)}
        />
        <MetricRangeCard
          metric="humidity"
          liveValue={liveValues.humidity}
          range={config.ranges.humidity}
          onApply={(min, max) => void setRange('humidity', min, max)}
        />
        <MetricRangeCard
          metric="soilMoisture"
          liveValue={liveValues.soilMoisture}
          range={config.ranges.soilMoisture}
          onApply={(min, max) => void setRange('soilMoisture', min, max)}
        />
      </div>

      <div className="bg-white border border-[#e1ebe3] rounded-2xl p-[18px] flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[13.5px] font-bold text-[#0f2016] mb-0.5">ทางลัดทดสอบ · Presets</div>
          <div className="text-[12px] text-[#7c8d80]">บังคับค่าให้อยู่ในช่วงที่ต้องการทดสอบทันที ไม่ต้องรอสุ่ม</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset('humidity', 88, 95)}
            className="text-[12.5px] font-bold text-[#b45309] bg-[#fff7ed] border border-[#fde3b8] px-3.5 py-2 rounded-full"
          >
            ทดสอบราสีเทา · Humidity 88–95%
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="text-[12.5px] font-bold text-[#5b6d61] bg-[#f2f7f3] border border-[#d9e8dd] px-3.5 py-2 rounded-full"
          >
            รีเซ็ตค่าเริ่มต้น · Reset
          </button>
        </div>
      </div>
    </div>
  );
}
