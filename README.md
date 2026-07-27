# Smart Farm Dashboard — Phase 2

แดชบอร์ดควบคุมโรงเรือนสตรอว์เบอร์รี่ขนาดทดลอง 1 โซน (8 แปลงปลูก) เปิดได้ทั้งจากคอมพิวเตอร์และมือถือ

นี่คือ **Phase 2 จาก 6 phase** ใน roadmap ของโปรเจค Smart Farm — frontend เชื่อมกับ **FastAPI mock backend** จริงแล้วผ่าน HTTP polling (ตัวเลขยังสุ่มอยู่เหมือน Phase 1 แต่ย้ายไปสุ่มฝั่ง server แทนฝั่ง browser) ยังไม่มี MQTT หรือฮาร์ดแวร์จริง

## วิธีรัน

ต้องรัน 2 servers พร้อมกัน (คนละ terminal):

**1) Backend (FastAPI)**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows (PowerShell/cmd)
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2) Frontend (Vite)**

```bash
npm install
npm run dev
```

เปิดเบราว์เซอร์ไปที่ URL ที่ Vite แสดง (ปกติ `http://localhost:5173`) ทดสอบมือถือได้ผ่าน DevTools mobile view — ถ้า backend ยังไม่รัน หน้าเว็บจะขึ้นข้อความแจ้งเชื่อมต่อไม่ได้พร้อมคำสั่งให้รันเอง

ปรับ URL ของ backend ได้ผ่าน env var `VITE_API_BASE_URL` (ดูตัวอย่างใน `.env.example`) ค่าเริ่มต้นคือ `http://localhost:8000`

## โครงสร้างโปรเจค

```
backend/                  FastAPI mock backend (Phase 2)
  requirements.txt
  app/main.py              routes: GET /api/zone1/status, POST .../actuator/{device}, POST .../plot/{id}/valve
  app/state.py              state จำลองในหน่วยความจำ + step() สุ่มค่าต่อเนื่องทุก 5 วิ (พอร์ตมาจาก mockData.ts เดิม)

src/
  types/farm.ts          ชนิดข้อมูล SensorReading, DeviceState, PlotStatus, ZoneStatus
  api/client.ts           fetch wrapper เรียก backend (getZoneStatus, setActuator, setValve)
  mock/mockData.ts        (Phase 1 เดิม) ฟังก์ชันสุ่มค่าเซนเซอร์ฝั่ง browser — เก็บไว้อ้างอิง ไม่ได้ใช้แล้ว
  hooks/useMockSensorData.ts  (Phase 1 เดิม) hook สุ่มข้อมูลในเบราว์เซอร์ — เก็บไว้อ้างอิง ไม่ได้ใช้แล้ว
  hooks/useZoneStatus.ts   hook ที่ใช้จริงตอนนี้: polling backend ทุก 5 วินาที + สั่งงานอุปกรณ์/วาล์วผ่าน API
  lib/status.ts           เกณฑ์ปลอดภัย/เฝ้าระวัง/อันตราย ของอุณหภูมิ ความชื้นอากาศ ความชื้นดิน
  lib/automation.ts       กฎอัตโนมัติแบบ rule-based (if-then) preview ของ Phase 5 — ยังไม่ใช่ AI/ML
  components/
    Dashboard.tsx          หน้าหลัก ดึงสถานะจาก useZoneStatus + แสดง loading/error เมื่อต่อ backend ไม่ได้
    GreenhouseFloorplan.tsx ผังโรงเรือนแบบ flexbox/grid: แปลงปลูก 8 แปลง, เซนเซอร์, ปั๊ม, พัดลม, ไฟ (responsive มือถือ)
    SensorCard.tsx          การ์ดแสดงค่าอุณหภูมิ/ความชื้นอากาศ/ความชื้นดิน พร้อมแถบช่วง ป้ายเตือน และ sparkline แนวโน้ม
    DeviceToggle.tsx        สวิตช์เปิด-ปิดอุปกรณ์หลัก (ปั๊ม/พัดลม/ไฟ) — ปิดใช้งานเมื่ออยู่โหมดอัตโนมัติ
    PlotValveList.tsx       รายการวาล์วน้ำหยดรายแปลง เปิด-ปิดทีละแปลงได้
    AlertBanner.tsx         แบนเนอร์แจ้งเตือนเมื่อค่าเซนเซอร์เกินช่วงปลอดภัย
    EventLog.tsx            ประวัติการเปิด/ปิดอุปกรณ์และการแจ้งเตือนล่าสุด (Activity Log)
    Sparkline.tsx           กราฟเส้นเล็กแสดงแนวโน้มค่าล่าสุด (เก็บใน memory เท่านั้น ไม่ persist)
    CameraPlaceholder.tsx   จุดที่จะแสดงภาพจากกล้องในอนาคต (Phase 6)
```

## โหมดควบคุมอัตโนมัติ (rule-based)

มีสวิตช์ **"โหมดควบคุม · Control Mode"** ที่หัวหน้าแดชบอร์ด สลับได้ 2 โหมด:

- **แมนนวล** (ค่าเริ่มต้น) — ควบคุมปั๊ม/พัดลม/ไฟ/วาล์วด้วยตัวเองทุกจุดเหมือนเดิม
- **อัตโนมัติ** — ระบบตัดสินใจเปิด/ปิดอุปกรณ์เองทุก 5 วินาทีตามกฎ if-then ง่ายๆ (ดูที่ `src/lib/automation.ts`) สวิตช์มือจะถูกปิดใช้งานชั่วคราวเพื่อไม่ให้ขัดกับระบบอัตโนมัติ

กฎที่ใช้:

| อุปกรณ์ | เงื่อนไขเปิด | เงื่อนไขปิด |
|---|---|---|
| พัดลม | อุณหภูมิ > 26°C หรือ ความชื้นอากาศ > 85% | อุณหภูมิ < 24°C และ ความชื้นอากาศ < 80% |
| วาล์วต่อแปลง | ดินแห้งต่ำกว่า 40% | ดินชื้นถึง 55% ขึ้นไป |
| ปั๊มหลัก | มีอย่างน้อย 1 วาล์วที่ควรเปิด | ไม่มีวาล์วใดต้องเปิด |
| ไฟปลูกพืช | อยู่ในช่วงกลางวัน 06:00–18:00 | นอกช่วงเวลาดังกล่าว |

**สำคัญ**: นี่คือ automation แบบ rule-based ธรรมดา **ไม่ใช่ AI/ML** — เป็นการ preview พฤติกรรมของ Phase 5 เท่านั้น ส่วน AI จริง (ตรวจโรคใบ/ราสีเทา/ระยะสุกของผลจากภาพกล้อง) จะมาใน Phase 6 เมื่อมีกล้องจริงและ backend รันโมเดลแล้ว

## เกณฑ์ที่ใช้ในเฟสนี้

อ้างอิงจากเอกสารออกแบบโปรเจค (`../smart_farm_project_summary.pdf`):

- **อุณหภูมิอากาศ**: เหมาะสม 18–26°C, เฝ้าระวังนอกช่วงนี้, อันตรายต่ำกว่า 16°C หรือสูงกว่า 30°C
- **ความชื้นอากาศ**: เกิน 85% เฝ้าระวัง (เสี่ยงราสีเทา), เกิน 90% อันตราย
- **ความชื้นดิน**: เหมาะสม 40–75%, เฝ้าระวังนอกช่วงนี้, อันตรายต่ำกว่า 30% หรือสูงกว่า 82%

## สิ่งที่ทำใน Phase 2

- สร้าง **FastAPI mock backend** (`backend/`) ที่ยังสุ่มค่าเซนเซอร์เหมือนเดิม แต่ทำงานฝั่ง server แทนฝั่ง browser พร้อม background task สุ่มค่าต่อเนื่องทุก 5 วินาที
- Endpoints: `GET /api/zone1/status`, `POST /api/zone1/actuator/{pump|fan|light}`, `POST /api/zone1/plot/{id}/valve`
- ตั้งค่า CORS ให้ FastAPI (พอร์ต 8000) รับ request จาก Vite dev server (พอร์ต 5173) ได้
- เพิ่ม `src/hooks/useZoneStatus.ts` + `src/api/client.ts` — frontend polling backend ทุก 5 วินาที และสั่งเปิด/ปิดอุปกรณ์/วาล์วผ่าน HTTP POST แทนการอัปเดต local state ตรงๆ
- `Dashboard.tsx` แสดงหน้า loading/error พร้อมคำสั่งให้รัน backend เองเมื่อเชื่อมต่อไม่ได้

`src/mock/mockData.ts` และ `src/hooks/useMockSensorData.ts` (ของ Phase 1) ยังเก็บไว้ในโปรเจคเป็นข้อมูลอ้างอิง แต่ไม่ได้ถูกเรียกใช้แล้ว

## จุดที่ต้องแก้ตอน Phase 3

Phase 3 จะเพิ่ม MQTT simulator ปล่อยค่าเซนเซอร์แบบเรียลไทม์แทนการสุ่มใน `backend/app/state.py` โดย backend จะ subscribe ค่าจาก MQTT broker แทน แล้วยังคงเสิร์ฟผ่าน endpoint เดิมให้ frontend ไม่ต้องแก้

Topic MQTT ที่ออกแบบไว้ (แยกคำสั่งกับสถานะจริงตามแนวคิด command/state):

```
farm/zone1/sensor/temperature
farm/zone1/sensor/humidity
farm/zone1/sensor/soil_moisture
farm/zone1/actuator/pump/cmd
farm/zone1/actuator/pump/state
farm/zone1/camera/capture
farm/zone1/ai/detection
farm/system/alert
```

## Roadmap (6 phases)

1. Phase 1 — Dashboard UI ด้วย mock data ล้วนๆ ✅
2. **Phase 2 (เฟสนี้)** — FastAPI mock backend + frontend ดึงจาก API จริงผ่าน polling ✅
3. Phase 3 — MQTT simulator ปล่อยค่าเซนเซอร์แบบเรียลไทม์ (backend subscribe แทนการสุ่มเอง)
4. Phase 4 — Database เก็บประวัติข้อมูลจริง + กราฟย้อนหลัง
5. Phase 5 — ระบบควบคุมอัตโนมัติจริงบน Pi (ต่อยอดจาก rule-based ใน `lib/automation.ts`), Raspberry Pi เสิร์ฟเว็บเองแบบ offline-first
6. Phase 6 — AI ตรวจโรคใบ/ราสีเทา/ระยะสุกของผลจากกล้อง รันบน Pi
