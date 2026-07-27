import type { PlotStatus } from '../types/farm';
import { getSoilMoistureStatus } from '../lib/status';

interface PlotValveListProps {
  plots: PlotStatus[];
  pumpOn: boolean;
  onToggleValve: (plotId: string) => void;
  disabled?: boolean;
}

function statusLabel(status: ReturnType<typeof getSoilMoistureStatus>, soilMoisture: number): string {
  if (status.level === 'safe') return '· พอดี';
  if (status.level === 'warn') return '· เฝ้าระวัง';
  return soilMoisture < 40 ? '· แห้ง!' : '· แฉะ!';
}

export default function PlotValveList({ plots, pumpOn, onToggleValve, disabled = false }: PlotValveListProps) {
  return (
    <div className="bg-white border border-[#e1ebe3] rounded-[20px] p-[22px] shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
      <div className="flex justify-between items-center mb-3.5 flex-wrap gap-2">
        <h2 className="m-0 text-[16.5px] font-bold text-[#0f2016]">วาล์วน้ำหยดรายแปลง · Drip Valves</h2>
        <div
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={
            pumpOn
              ? { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }
              : { background: '#fff7ed', color: '#b45309', border: '1px solid #fde3b8' }
          }
        >
          {pumpOn ? 'ปั๊มหลักเปิดอยู่ — วาล์วที่เปิดจะให้น้ำ' : 'ปั๊มหลักปิดอยู่ — เปิดปั๊มก่อน วาล์วจึงจะให้น้ำ'}
        </div>
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))' }}>
        {plots.map((plot) => {
          const status = getSoilMoistureStatus(plot.soilMoisture);
          const watering = pumpOn && plot.valveOpen;
          return (
            <div
              key={plot.id}
              className="flex items-center justify-between gap-2.5 px-3 py-2.5 border border-[#e6efe8] rounded-xl"
              style={disabled ? { opacity: 0.6 } : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[12.5px] font-extrabold shrink-0"
                  style={{
                    background: plot.valveOpen ? '#2563eb' : '#eef2ef',
                    color: plot.valveOpen ? '#ffffff' : '#5b6d61',
                  }}
                >
                  {plot.id}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#0f2016] whitespace-nowrap">
                    ดิน {plot.soilMoisture.toFixed(0)}%{' '}
                    <span style={{ color: status.color, fontWeight: 700 }}>{statusLabel(status, plot.soilMoisture)}</span>
                  </div>
                  <div className="text-[11.5px] text-[#7c8d80] whitespace-nowrap">
                    {watering ? 'กำลังให้น้ำ · Watering' : plot.valveOpen ? 'วาล์วเปิด (รอปั๊มหลัก)' : 'วาล์วปิด · Off'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={plot.valveOpen}
                aria-label={`วาล์วแปลง ${plot.id}`}
                onClick={() => onToggleValve(plot.id)}
                disabled={disabled}
                className="w-[46px] h-[27px] rounded-full p-[3px] shrink-0 flex items-center transition-colors duration-200"
                style={{ background: plot.valveOpen ? '#2563eb' : '#d7e2db', cursor: disabled ? 'not-allowed' : 'pointer' }}
              >
                <span
                  className="w-[21px] h-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200"
                  style={{ transform: plot.valveOpen ? 'translateX(19px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
