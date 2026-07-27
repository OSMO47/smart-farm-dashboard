import { useEffect, useMemo, useRef, useState } from 'react';
import type { Alert, LogEvent } from '../types/farm';
import { useZoneStatus } from '../hooks/useZoneStatus';
import { getHumidityStatus, getSoilMoistureStatus, getTemperatureStatus } from '../lib/status';
import { computeAutoFan, computeAutoLight, computeAutoPump, computeAutoValve } from '../lib/automation';
import GreenhouseFloorplan from './GreenhouseFloorplan';
import SensorCard from './SensorCard';
import DeviceToggle from './DeviceToggle';
import PlotValveList from './PlotValveList';
import CameraPlaceholder from './CameraPlaceholder';
import AlertBanner from './AlertBanner';
import EventLog from './EventLog';

const ACCENT = '#1f9d55';
const EVENT_LOG_LIMIT = 30;

export default function Dashboard() {
  // Phase 2: สถานะจริงมาจาก FastAPI mock backend ผ่าน useZoneStatus (polling ทุก 5 วินาที)
  // แทนการสุ่มในเบราว์เซอร์แบบ Phase 1 (ดู useMockSensorData เดิมเป็นตัวอ้างอิง)
  const { status, history, error, setDevice, toggleValve } = useZoneStatus();

  // โหมดอัตโนมัติ: preview ของ Phase 5 ด้วยกฎ if-then ธรรมดา (ยังไม่ใช่ AI/ML จริง)
  const [autoMode, setAutoMode] = useState(false);

  const [events, setEvents] = useState<LogEvent[]>([]);
  const pushEvent = (message: string, kind: LogEvent['kind'], level?: LogEvent['level']) => {
    setEvents((prev) =>
      [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date().toISOString(), message, kind, level }, ...prev].slice(
        0,
        EVENT_LOG_LIMIT,
      ),
    );
  };

  // กฎอัตโนมัติทำงานทุกครั้งที่ค่าเซนเซอร์อัปเดต (ทุก 5 วินาที) เมื่อโหมดอัตโนมัติเปิดอยู่เท่านั้น
  useEffect(() => {
    if (!autoMode || !status) return;

    const nextFan = computeAutoFan(status.temperature, status.humidity, status.fan);
    if (nextFan !== status.fan) {
      setDevice('fan', nextFan);
      pushEvent(`อัตโนมัติ: ${nextFan ? 'เปิด' : 'ปิด'}พัดลมระบายอากาศ · Auto Fan ${nextFan ? 'On' : 'Off'}`, 'device');
    }

    const hour = new Date(status.timestamp).getHours();
    const nextLight = computeAutoLight(hour);
    if (nextLight !== status.light) {
      setDevice('light', nextLight);
      pushEvent(`อัตโนมัติ: ${nextLight ? 'เปิด' : 'ปิด'}ไฟปลูกพืช · Auto Light ${nextLight ? 'On' : 'Off'}`, 'device');
    }

    let anyValveShouldBeOpen = false;
    status.plots.forEach((plot) => {
      const nextValve = computeAutoValve(plot.soilMoisture, plot.valveOpen);
      if (nextValve) anyValveShouldBeOpen = true;
      if (nextValve !== plot.valveOpen) {
        toggleValve(plot.id, nextValve);
        pushEvent(`อัตโนมัติ: วาล์วแปลง ${plot.id} ${nextValve ? 'เปิด' : 'ปิด'} · Auto Valve ${nextValve ? 'On' : 'Off'}`, 'device');
      }
    });

    const nextPump = computeAutoPump(anyValveShouldBeOpen);
    if (nextPump !== status.pump) {
      setDevice('pump', nextPump);
      pushEvent(`อัตโนมัติ: ${nextPump ? 'เปิด' : 'ปิด'}ปั๊มน้ำหลัก · Auto Pump ${nextPump ? 'On' : 'Off'}`, 'device');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoMode]);

  const alerts: Alert[] = useMemo(() => {
    if (!status) return [];
    const result: Alert[] = [];
    const humidityStatus = getHumidityStatus(status.humidity);
    const temperatureStatus = getTemperatureStatus(status.temperature);
    if (humidityStatus.level !== 'safe') {
      result.push({
        id: 'humidity',
        level: humidityStatus.level,
        message: `เตือน: ความชื้นอากาศ ${status.humidity.toFixed(0)}% ${humidityStatus.level === 'danger' ? 'สูงมาก' : 'เกินเกณฑ์'} — เสี่ยงราสีเทาในผลสตรอว์เบอร์รี่`,
      });
    }
    if (temperatureStatus.level !== 'safe') {
      result.push({
        id: 'temperature',
        level: temperatureStatus.level,
        message: `เตือน: อุณหภูมิอากาศ ${status.temperature.toFixed(1)}°C อยู่นอกช่วงเหมาะสมสำหรับสตรอว์เบอร์รี่`,
      });
    }
    const dryPlots = status.plots.filter((p) => p.soilMoisture < 40);
    if (dryPlots.length > 0) {
      result.push({
        id: 'dry-plots',
        level: 'warn',
        message: `แปลง ${dryPlots.map((p) => p.id).join(', ')} ดินแห้งต่ำกว่า 40% — เปิดวาล์วน้ำหยดหรือตรวจระบบน้ำ`,
      });
    }
    return result;
  }, [status]);
  const prevAlertIdsRef = useRef<Set<string>>(new Set());

  // บันทึกลง Activity Log เฉพาะตอนที่แจ้งเตือนเกิดใหม่ ไม่บันทึกซ้ำทุกครั้งที่ค่าอัปเดต
  useEffect(() => {
    const currentIds = new Set(alerts.map((a) => a.id));
    const newAlerts = alerts.filter((a) => !prevAlertIdsRef.current.has(a.id));
    if (newAlerts.length > 0) {
      setEvents((prev) =>
        [
          ...newAlerts.map((a) => ({
            id: `alert-${a.id}-${Date.now()}`,
            timestamp: new Date().toISOString(),
            message: a.message,
            kind: 'alert' as const,
            level: a.level,
          })),
          ...prev,
        ].slice(0, EVENT_LOG_LIMIT),
      );
    }
    prevAlertIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f2f7f3' }}>
        <div className="max-w-md text-center bg-white border border-[#e1ebe3] rounded-2xl p-8 shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
          {error ? (
            <>
              <div className="text-lg font-bold text-[#dc2626] mb-2">เชื่อมต่อ backend ไม่ได้</div>
              <div className="text-sm text-[#5b6d61] mb-1">{error}</div>
              <div className="text-xs text-[#8a998f] mt-3">
                ตรวจสอบว่ารัน backend อยู่: <code className="bg-[#f2f7f3] px-1.5 py-0.5 rounded">cd backend &amp;&amp; uvicorn app.main:app --reload</code>
              </div>
            </>
          ) : (
            <div className="text-sm text-[#5b6d61]">กำลังเชื่อมต่อ backend...</div>
          )}
        </div>
      </div>
    );
  }

  const togglePump = () => {
    const next = !status.pump;
    setDevice('pump', next);
    pushEvent(next ? 'เปิดปั๊มน้ำหลัก · Main Pump On' : 'ปิดปั๊มน้ำหลัก · Main Pump Off', 'device');
  };
  const toggleFan = () => {
    const next = !status.fan;
    setDevice('fan', next);
    pushEvent(next ? 'เปิดพัดลมระบายอากาศ · Fan On' : 'ปิดพัดลมระบายอากาศ · Fan Off', 'device');
  };
  const toggleLight = () => {
    const next = !status.light;
    setDevice('light', next);
    pushEvent(next ? 'เปิดไฟปลูกพืช · Grow Light On' : 'ปิดไฟปลูกพืช · Grow Light Off', 'device');
  };
  const handleToggleValve = (plotId: string) => {
    const plot = status.plots.find((p) => p.id === plotId);
    if (plot) {
      const next = !plot.valveOpen;
      toggleValve(plotId, next);
      pushEvent(`วาล์วแปลง ${plotId} ${next ? 'เปิด' : 'ปิด'} · Valve ${next ? 'On' : 'Off'}`, 'device');
    }
  };

  const temperatureStatus = getTemperatureStatus(status.temperature);
  const humidityStatus = getHumidityStatus(status.humidity);
  const soilStatus = getSoilMoistureStatus(status.soilMoisture);

  const temperatureDisplay = status.temperature.toFixed(1);
  const humidityDisplay = status.humidity.toFixed(0);
  const soilAvgDisplay = status.soilMoisture.toFixed(0);

  const updatedLabel = new Date(status.timestamp).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const temperatureHistory = history.map((h) => h.temperature);
  const humidityHistory = history.map((h) => h.humidity);
  const soilHistory = history.map((h) => h.soilAvg);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-9 box-border" style={{ background: '#f2f7f3', color: '#16261a' }}>
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-start gap-4 flex-wrap mb-4.5">
          <div>
            <div className="text-[12.5px] font-bold tracking-[0.14em] uppercase" style={{ color: ACCENT }}>
              SMART FARM · PHASE 2
            </div>
            <h1 className="text-2xl sm:text-3xl mt-1.5 mb-0 font-extrabold text-[#0f2016] tracking-tight">
              โรงเรือนสตรอว์เบอร์รี่ · โซน 1
            </h1>
            <div className="text-[13.5px] text-[#5b6d61] mt-1">
              8 แปลงปลูก · เซนเซอร์ดินรายแปลง · วาล์วน้ำหยดรายแปลง — เชื่อมกับ FastAPI mock backend
            </div>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white border border-[#d9e8dd] rounded-full px-3.5 py-2 text-[13px] font-semibold text-[#1c3324]">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: error ? '#f59e0b' : '#22c55e', boxShadow: `0 0 0 3px ${error ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.18)'}` }}
              />
              {error ? 'เชื่อมต่อ backend มีปัญหา — แสดงข้อมูลล่าสุดที่มี' : 'เชื่อมต่อ backend ปกติ'}
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-[#d9e8dd] rounded-full px-3.5 py-2 text-[13px] font-semibold text-[#5b6d61]">
              อัปเดตล่าสุด {updatedLabel}
            </div>
          </div>
        </div>

        {alerts.map((alert) => (
          <AlertBanner key={alert.id} alert={alert} />
        ))}

        <div className="flex items-center justify-between gap-4 flex-wrap bg-white border border-[#e1ebe3] rounded-2xl px-5 py-4 mb-4 shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: autoMode ? '#ecfdf3' : '#eef2ef', color: autoMode ? '#16a34a' : '#93a39a' }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path
                  d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div className="text-[14.5px] font-bold text-[#0f2016]">โหมดควบคุม · Control Mode</div>
              <div className="text-[12.5px] text-[#7c8d80]">
                {autoMode
                  ? 'อัตโนมัติ (rule-based) — ระบบเปิด/ปิดอุปกรณ์เองตามเกณฑ์เซนเซอร์'
                  : 'แมนนวล — ควบคุมปั๊ม/พัดลม/ไฟ/วาล์วด้วยตัวเองทุกจุด'}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoMode}
            aria-label="โหมดควบคุม · Control Mode"
            onClick={() => {
              const next = !autoMode;
              setAutoMode(next);
              pushEvent(next ? 'เปิดโหมดอัตโนมัติ · Auto Mode On' : 'ปิดโหมดอัตโนมัติ กลับสู่แมนนวล · Auto Mode Off', 'device');
            }}
            className="w-[50px] h-[30px] rounded-full p-[3px] shrink-0 flex items-center transition-colors duration-200 cursor-pointer"
            style={{ background: autoMode ? '#16a34a' : '#d7e2db' }}
          >
            <span
              className="w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200"
              style={{ transform: autoMode ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
        </div>

        <div className="flex gap-5 flex-wrap items-start mt-3">
          <div className="flex-[2_1_500px] flex flex-col gap-4 min-w-0">
            <div className="bg-white border border-[#e1ebe3] rounded-[20px] p-[22px] shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
              <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                <h2 className="m-0 text-[16.5px] font-bold text-[#0f2016]">ผังโรงเรือน · มุมมองจากด้านบน</h2>
                <div className="text-xs text-[#7c8d80] font-medium">แตะแปลงเพื่อเปิด/ปิดวาล์วน้ำหยด</div>
              </div>
              <div className="flex gap-3.5 flex-wrap mb-3 text-[11.5px] text-[#5b6d61] font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-[9px] h-[9px] rounded-sm inline-block" style={{ background: '#22c55e' }} />
                  ดินชื้นพอดี
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-[9px] h-[9px] rounded-sm inline-block" style={{ background: '#f59e0b' }} />
                  เฝ้าระวัง
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-[9px] h-[9px] rounded-sm inline-block" style={{ background: '#ef4444' }} />
                  แห้ง/แฉะเกิน
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-[9px] h-[9px] rounded-full inline-block" style={{ background: '#2563eb' }} />
                  วาล์วเปิดอยู่
                </span>
              </div>
              <GreenhouseFloorplan
                devices={status}
                plots={status.plots}
                temperatureDisplay={temperatureDisplay}
                humidityDisplay={humidityDisplay}
                unitLabel="C"
                onToggleValve={handleToggleValve}
                disabled={autoMode}
              />
            </div>

            <PlotValveList plots={status.plots} pumpOn={status.pump} onToggleValve={handleToggleValve} disabled={autoMode} />
          </div>

          <div className="flex-[1_1_340px] flex flex-col gap-4 min-w-0">
            <div className="flex gap-3.5 flex-wrap">
              <SensorCard
                kind="temperature"
                title="อุณหภูมิอากาศ"
                titleEn="Temp"
                value={temperatureDisplay}
                unit="°C"
                status={temperatureStatus}
                history={temperatureHistory}
              />
              <SensorCard
                kind="humidity"
                title="ความชื้นอากาศ"
                titleEn="Humidity"
                value={humidityDisplay}
                unit="%"
                status={humidityStatus}
                history={humidityHistory}
              />
              <SensorCard
                kind="soil"
                title="ความชื้นดินเฉลี่ย"
                titleEn="Soil Avg"
                value={soilAvgDisplay}
                unit="%"
                status={soilStatus}
                history={soilHistory}
              />
            </div>

            <div className="bg-white border border-[#e1ebe3] rounded-[18px] p-[18px] shadow-[0_1px_3px_rgba(20,50,30,0.05)]">
              <h2 className="m-0 mb-3.5 text-[15.5px] font-bold text-[#0f2016]">ควบคุมอุปกรณ์หลัก · Main Devices</h2>
              <div className="flex flex-col gap-2.5">
                <DeviceToggle
                  label="ปั๊มน้ำหลัก"
                  labelEn="Main Pump"
                  icon="pump"
                  accent="#2563eb"
                  on={status.pump}
                  statusText={(status.pump ? 'จ่ายน้ำเข้าท่อเมน · On' : 'ปิดอยู่ · Off') + (autoMode ? ' · Auto' : '')}
                  onToggle={togglePump}
                  disabled={autoMode}
                />
                <DeviceToggle
                  label="พัดลมระบายอากาศ"
                  labelEn="Fan"
                  icon="fan"
                  accent={ACCENT}
                  on={status.fan}
                  statusText={(status.fan ? 'กำลังระบายอากาศ · On' : 'ปิดอยู่ · Off') + (autoMode ? ' · Auto' : '')}
                  onToggle={toggleFan}
                  disabled={autoMode}
                />
                <DeviceToggle
                  label="ไฟปลูกพืช"
                  labelEn="Grow Light"
                  icon="light"
                  accent="#d97706"
                  on={status.light}
                  statusText={(status.light ? 'เปิดอยู่ · On' : 'ปิดอยู่ · Off') + (autoMode ? ' · Auto' : '')}
                  onToggle={toggleLight}
                  disabled={autoMode}
                />
              </div>
            </div>

            <EventLog events={events} />

            <CameraPlaceholder />
          </div>
        </div>
      </div>
    </div>
  );
}
