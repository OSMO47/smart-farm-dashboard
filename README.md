# Smart Farm Dashboard — Phase 1

แดชบอร์ดควบคุมโรงเรือนสตรอว์เบอร์รี่ขนาดทดลอง 1 โซน (8 แปลงปลูก) เปิดได้ทั้งจากคอมพิวเตอร์และมือถือ

นี่คือ **Phase 1 จาก 6 phase** ใน roadmap ของโปรเจค Smart Farm — เฟสนี้สร้างเฉพาะหน้าเว็บ (UI) ด้วย **ข้อมูลจำลอง (mock data) ทั้งหมด** ยังไม่มีการเชื่อมต่อ backend, MQTT, หรือฮาร์ดแวร์จริงใดๆ

## วิธีรัน

```bash
npm install
npm run dev
```

เปิดเบราว์เซอร์ไปที่ URL ที่ Vite แสดง (ปกติ `http://localhost:5173`) ทดสอบมือถือได้ผ่าน DevTools mobile view

## โครงสร้างโปรเจค

```
src/
  types/farm.ts          ชนิดข้อมูล SensorReading, DeviceState, PlotStatus, ZoneStatus
  mock/mockData.ts        ฟังก์ชันสุ่มค่าเซนเซอร์และจำลองการเปลี่ยนแปลง (random walk)
  hooks/useMockSensorData.ts  hook จำลองข้อมูลเซนเซอร์เปลี่ยนทุก 5 วินาที
  lib/status.ts           เกณฑ์ปลอดภัย/เฝ้าระวัง/อันตราย ของอุณหภูมิ ความชื้นอากาศ ความชื้นดิน
  lib/automation.ts       กฎอัตโนมัติแบบ rule-based (if-then) preview ของ Phase 5 — ยังไม่ใช่ AI/ML
  components/
    Dashboard.tsx          หน้าหลัก รวมทุกอย่างเข้าด้วยกัน + ควบคุม state อุปกรณ์ + โหมดอัตโนมัติ
    GreenhouseFloorplan.tsx ผังโรงเรือนแบบ top-down: แปลงปลูก 8 แปลง, เซนเซอร์, ปั๊ม, พัดลม, ไฟ
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

## จุดที่ต้องแก้ตอน Phase 2

Phase 2 จะเพิ่ม FastAPI mock endpoint และเปลี่ยนให้ dashboard ดึงข้อมูลจริงแทนการสุ่มในเครื่อง จุดที่ต้องแก้:

1. **`src/hooks/useMockSensorData.ts`** — เปลี่ยนจากการสุ่มค่าด้วย `setInterval` ให้ polling หรือ subscribe ข้อมูลจาก FastAPI แทน (คอมเมนต์ไว้ในไฟล์แล้ว)
2. **`src/components/Dashboard.tsx`** — `togglePump` / `toggleFan` / `toggleLight` และ `toggleValve` ใน `useMockSensorData` ปัจจุบันแค่อัปเดต state ในเครื่อง Phase 2 ต้องเปลี่ยนให้ยิง API/MQTT command จริง (คอมเมนต์ไว้ในไฟล์แล้วที่จุดเรียกใช้)
3. **`src/mock/mockData.ts`** — จะไม่ถูกใช้แล้วเมื่อมี backend จริง (เก็บไว้อ้างอิง หรือใช้ต่อสำหรับ dev/test โดยไม่ต้องรัน backend)

Topic MQTT ที่ออกแบบไว้สำหรับ Phase 2-3 (แยกคำสั่งกับสถานะจริงตามแนวคิด command/state):

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

1. **Phase 1 (เฟสนี้)** — Dashboard UI ด้วย mock data ล้วนๆ
2. Phase 2 — FastAPI mock endpoint + เปลี่ยน hook ให้ดึงจาก API จริง
3. Phase 3 — MQTT simulator ปล่อยค่าเซนเซอร์แบบเรียลไทม์
4. Phase 4 — Database เก็บประวัติข้อมูลจริง + กราฟย้อนหลัง
5. Phase 5 — ระบบควบคุมอัตโนมัติ, Raspberry Pi เสิร์ฟเว็บเองแบบ offline-first
6. Phase 6 — AI ตรวจโรคใบ/ราสีเทา/ระยะสุกของผลจากกล้อง รันบน Pi
