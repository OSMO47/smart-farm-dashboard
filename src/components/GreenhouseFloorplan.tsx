import type { DeviceState, PlotStatus } from '../types/farm';
import { getSoilMoistureStatus } from '../lib/status';

const TINT: Record<string, string> = {
  safe: 'rgba(34,197,94,0.16)',
  warn: 'rgba(245,158,11,0.22)',
  danger: 'rgba(239,68,68,0.22)',
};
const EDGE: Record<string, string> = {
  safe: 'rgba(34,150,74,0.4)',
  warn: 'rgba(217,119,6,0.55)',
  danger: 'rgba(220,38,38,0.55)',
};

function LightBulbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.4 10.9c.6.4.9 1 .9 1.7v.4h5v-.4c0-.7.3-1.3.9-1.7A6 6 0 0 0 12 3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 12c0-3 2-6 4.5-6S21 8 21 10.5 18.5 14 16 14c-1 0-2-.3-3-1M12 12c-3 0-6-2-6-4.5S8.5 3 11 3 15 5.5 15 8c0 1-.3 2-1 3M12 12c0 3-2 6-4.5 6S3 16 3 13.5 5.5 10 8 10c1 0 2 .3 3 1M12 12c3 0 6 2 6 4.5S15.5 21 13 21 9 18.5 9 16c0-1 .3-2 1-3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function PumpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 10l5-2.5v9L16 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ValveDropIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface GreenhouseFloorplanProps {
  devices: DeviceState;
  plots: PlotStatus[];
  temperatureDisplay: string;
  humidityDisplay: string;
  unitLabel: string;
  onToggleValve: (plotId: string) => void;
  disabled?: boolean;
}

export default function GreenhouseFloorplan({
  devices,
  plots,
  temperatureDisplay,
  humidityDisplay,
  unitLabel,
  onToggleValve,
  disabled = false,
}: GreenhouseFloorplanProps) {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-[#d3e6d8]" style={{ background: '#e9f4ec' }}>
      {/* แถวไฟปลูกพืชด้านบน */}
      <div
        className="flex items-center justify-evenly px-[10%] py-2 border-b border-dashed border-[#b9d9c1]"
        style={{ background: '#dcefe1' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[38px] h-[38px] rounded-xl flex items-center justify-center shadow-[0_2px_6px_rgba(20,50,30,0.08)]"
            style={{
              background: '#ffffff',
              border: `1px solid ${devices.light ? '#d97706' : '#dfe8e2'}`,
              color: devices.light ? '#d97706' : '#93a39a',
            }}
          >
            <div className={devices.light ? 'animate-pulse-glow' : ''}>
              <LightBulbIcon />
            </div>
          </div>
        ))}
      </div>

      {/* กลาง: กริดแปลงปลูก (2 คอลัมน์บนมือถือ, 4 คอลัมน์บนจอกว้าง) + คอลัมน์เซนเซอร์/พัดลม */}
      <div className="flex gap-2 sm:gap-3 p-2.5 sm:p-3">
        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {plots.map((plot) => {
            const status = getSoilMoistureStatus(plot.soilMoisture);
            const watering = devices.pump && plot.valveOpen;
            return (
              <button
                key={plot.id}
                type="button"
                onClick={() => onToggleValve(plot.id)}
                disabled={disabled}
                className="rounded-xl flex flex-col justify-between gap-1.5 px-2.5 py-2 min-w-0 min-h-[72px] sm:min-h-[84px] text-left"
                style={{
                  background: `repeating-linear-gradient(135deg, ${TINT[status.level]} 0px, ${TINT[status.level]} 7px, rgba(255,255,255,0.25) 7px, rgba(255,255,255,0.25) 14px)`,
                  border: `1.5px solid ${plot.valveOpen ? '#2563eb' : EDGE[status.level]}`,
                  transition: 'border-color 0.2s ease',
                  opacity: disabled ? 0.6 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                aria-label={`แปลง ${plot.id} · ดิน ${plot.soilMoisture.toFixed(0)}% · แตะเพื่อ${plot.valveOpen ? 'ปิด' : 'เปิด'}วาล์ว`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[11.5px] font-extrabold text-[#3d5245] bg-white/80 rounded-md px-1.5 py-0.5">
                    {plot.id}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${watering ? 'animate-drip-pulse' : ''}`}
                    style={{
                      background: plot.valveOpen ? '#2563eb' : 'rgba(255,255,255,0.8)',
                      color: plot.valveOpen ? '#ffffff' : '#b3c2b8',
                    }}
                  >
                    <ValveDropIcon />
                  </span>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-base font-extrabold text-[#0f2016] leading-none">
                    {plot.soilMoisture.toFixed(0)}%
                  </div>
                  <div className="text-[10.5px] font-semibold text-[#5b6d61] mt-1">ดิน · Soil</div>
                </div>
                <div className="h-1.5 rounded-full bg-white/65 relative overflow-hidden">
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-500"
                    style={{ width: `${plot.soilMoisture}%`, background: status.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* คอลัมน์ขวา: กล้อง / เซนเซอร์อากาศ / พัดลม */}
        <div className="w-[70px] sm:w-20 shrink-0 flex flex-col items-center justify-between gap-2">
          <div className="w-11 h-11 rounded-xl bg-white border border-[#d9e2db] flex items-center justify-center text-[#93a39a] shadow-[0_2px_6px_rgba(20,50,30,0.08)]">
            <CameraIcon />
          </div>
          <div className="bg-white border border-[#d3e6d8] rounded-[10px] px-2 py-1.5 shadow-[0_2px_6px_rgba(20,50,30,0.1)] w-full">
            <div className="text-[10.5px] font-bold text-[#5b6d61] text-center">อากาศ · Air</div>
            <div className="text-[13px] font-extrabold text-[#0f2016] text-center whitespace-nowrap">
              {temperatureDisplay}°{unitLabel}
            </div>
            <div className="text-[13px] font-extrabold text-[#0f2016] text-center whitespace-nowrap">
              {humidityDisplay}%
            </div>
          </div>
          <div
            className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-[0_2px_6px_rgba(20,50,30,0.08)]"
            style={{
              border: `1px solid ${devices.fan ? '#1f9d55' : '#dfe8e2'}`,
              color: devices.fan ? '#1f9d55' : '#93a39a',
            }}
          >
            <div className={`flex items-center justify-center ${devices.fan ? 'animate-fan-spin' : ''}`}>
              <FanIcon />
            </div>
          </div>
        </div>
      </div>

      {/* แถวปั๊มน้ำหลักด้านล่าง */}
      <div
        className="flex items-center justify-center gap-2.5 py-2.5 px-3 border-t border-dashed border-[#b9d9c1] flex-wrap text-center"
        style={{ background: '#dcefe1' }}
      >
        <div
          className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-[0_2px_6px_rgba(20,50,30,0.08)] shrink-0"
          style={{
            border: `1px solid ${devices.pump ? '#2563eb' : '#dfe8e2'}`,
            color: devices.pump ? '#2563eb' : '#93a39a',
          }}
        >
          <div className={devices.pump ? 'animate-pulse-glow' : ''}>
            <PumpIcon />
          </div>
        </div>
        <div className="text-[11px] font-bold text-[#5b6d61]">ปั๊มหลัก + ท่อเมนน้ำหยด · Main pump &amp; drip line</div>
      </div>
    </div>
  );
}
