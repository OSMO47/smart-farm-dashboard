type DeviceIcon = 'pump' | 'fan' | 'light';

interface DeviceToggleProps {
  label: string;
  labelEn: string;
  icon: DeviceIcon;
  accent: string;
  on: boolean;
  statusText: string;
  onToggle: () => void;
  disabled?: boolean;
}

function DeviceIconSvg({ icon }: { icon: DeviceIcon }) {
  if (icon === 'pump') {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (icon === 'fan') {
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
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
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
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

export default function DeviceToggle({
  label,
  labelEn,
  icon,
  accent,
  on,
  statusText,
  onToggle,
  disabled = false,
}: DeviceToggleProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-3.5 py-3 border border-[#e6efe8] rounded-2xl"
      style={disabled ? { opacity: 0.6 } : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: on ? accent : '#eef2ef', color: on ? '#ffffff' : '#93a39a' }}
        >
          <DeviceIconSvg icon={icon} />
        </div>
        <div>
          <div className="text-[14.5px] font-bold text-[#0f2016]">
            {label} · {labelEn}
          </div>
          <div className="text-[12.5px] text-[#7c8d80]">{statusText}</div>
        </div>
      </div>
      {/* Phase 2: onToggle จะยิงคำสั่งไปที่ farm/zone1/actuator/{device}/cmd แทนการอัปเดต state ในเครื่อง */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label} · ${labelEn}`}
        onClick={onToggle}
        disabled={disabled}
        className="w-[46px] h-[27px] rounded-full p-[3px] shrink-0 flex items-center transition-colors duration-200"
        style={{ background: on ? accent : '#d7e2db', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span
          className="w-[21px] h-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200"
          style={{ transform: on ? 'translateX(19px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}
