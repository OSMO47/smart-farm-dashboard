import type { LogEvent } from '../types/farm';

const LEVEL_DOT: Record<string, string> = {
  safe: '#16a34a',
  warn: '#b45309',
  danger: '#dc2626',
};

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function EventLog({ events }: { events: LogEvent[] }) {
  return (
    <div className="bg-white border border-[#e1ebe3] rounded-[18px] p-[18px] shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
      <h2 className="m-0 mb-3 text-[15.5px] font-bold text-[#0f2016]">ประวัติการทำงานล่าสุด · Activity Log</h2>
      {events.length === 0 ? (
        <div className="text-[13px] text-[#8a998f]">ยังไม่มีการเปลี่ยนแปลง</div>
      ) : (
        <ul className="flex flex-col gap-2.5 max-h-[240px] overflow-y-auto pr-1">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-2.5">
              <span
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ background: event.kind === 'alert' ? LEVEL_DOT[event.level ?? 'warn'] : '#2563eb' }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#0f2016] leading-snug">{event.message}</div>
                <div className="text-[11px] text-[#8a998f]">{formatTime(event.timestamp)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
