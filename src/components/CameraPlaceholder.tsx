export default function CameraPlaceholder() {
  return (
    <div className="bg-white border border-dashed border-[#cddcd1] rounded-[18px] p-[22px] flex flex-col items-center justify-center gap-2 min-h-[140px] text-center">
      <div className="w-11 h-11 rounded-xl bg-[#eef4ef] flex items-center justify-center text-[#93a39a]">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="7" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 10l5-2.5v9L16 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-sm font-bold text-[#3d5245]">รอเชื่อมต่อกล้อง</div>
      <div className="text-[12.5px] text-[#8a998f]">Camera not connected yet · Zone 1 มุมสูง</div>
      {/* Phase 6: จุดนี้จะแสดงภาพสดจากกล้องจริง + ผลตรวจโรค/ระยะสุกจาก AI */}
    </div>
  );
}
