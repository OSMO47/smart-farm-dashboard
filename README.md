# Smart Farm Dashboard — Phase 4

แดชบอร์ดควบคุมโรงเรือนสตรอว์เบอร์รี่ขนาดทดลอง 1 โซน (8 แปลงปลูก) เปิดได้ทั้งจากคอมพิวเตอร์และมือถือ

นี่คือ **Phase 4 จาก 6 phase** ใน roadmap ของโปรเจค Smart Farm — ค่าเซนเซอร์เชื่อมกับ **MQTT** จริงตั้งแต่ Phase 3 (simulator แยก process publish เหมือนฮาร์ดแวร์จริงจะทำในอนาคต, backend subscribe แล้วเสิร์ฟผ่าน REST) และตอนนี้เพิ่ม **Supabase (Postgres)** เข้ามาเก็บประวัติค่าเซนเซอร์จริง ทำให้กราฟแนวโน้มไม่หายตอน refresh หน้าเว็บอีกต่อไป — ยังไม่มี Raspberry Pi หรือฮาร์ดแวร์จริง ทุกอย่างรันบนคอมพัฒนาได้

มีหน้า **"จำลองข้อมูล · Simulator"** (จาก Phase 3) ให้สั่งหยุด/เริ่มการจำลอง และปรับช่วงค่าสุ่ม (อุณหภูมิ/ความชื้นอากาศ/ความชื้นดิน) ได้แบบ real-time โดยไม่ต้องแก้โค้ด — มีปุ่มลัด "ทดสอบราสีเทา" บังคับความชื้นอากาศให้อยู่ 88–95% ทันทีเพื่อทดสอบระบบแจ้งเตือนโดยไม่ต้องรอสุ่ม

## วิธีรัน

ต้องรัน **4 processes** พร้อมกัน (คนละ terminal) ทั้งหมดใช้ venv เดียวกันใน `backend/`:

**0) ตั้งค่า Supabase (ทำครั้งเดียว)**

1. เปิด Supabase Dashboard → SQL Editor → รันไฟล์ `backend/supabase/schema.sql`
2. สร้าง `backend/.env` (ดูตัวอย่างใน `backend/.env.example`) ใส่:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxx
   ```
   ใช้ **secret key** (ไม่ใช่ publishable/anon key) เพราะ backend เขียนข้อมูลเองฝั่ง server ไม่ผ่าน RLS ของผู้ใช้ — ไฟล์นี้อยู่ใน `.gitignore` แล้ว ไม่ถูก commit

ถ้าไม่ตั้งค่า Supabase ระบบยังใช้งานได้ปกติทุกอย่าง แค่ endpoint ประวัติข้อมูล (`/api/zone1/history`) จะตอบ error และกราฟ sparkline จะเริ่มจากค่าว่างทุกครั้งที่ refresh (เหมือน Phase 3)

**1) MQTT Broker**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows (PowerShell/cmd)
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python -m broker.run_broker
```

**2) Simulator**

```bash
cd backend
venv\Scripts\activate
python -m simulator.run_simulator
```

**3) Backend (FastAPI)**

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**4) Frontend (Vite)**

```bash
npm install
npm run dev
```

เปิดเบราว์เซอร์ไปที่ URL ที่ Vite แสดง (ปกติ `http://localhost:5173`) ทดสอบมือถือได้ผ่าน DevTools mobile view

**ลำดับการรันไม่จำเป็นต้องเรียง** — broker/simulator/backend ทุกตัวมี auto-reconnect พร้อม backoff ในตัว ต่อให้ backend รันก่อน broker หรือ simulator ตายแล้วรันใหม่ ระบบก็เชื่อมกลับเองได้ภายในไม่กี่วินาที

ปรับ URL ของ backend ได้ผ่าน env var `VITE_API_BASE_URL` (ดูตัวอย่างใน `.env.example`) ค่าเริ่มต้นคือ `http://localhost:8000`

## สถาปัตยกรรม MQTT

ใช้ [`amqtt`](https://github.com/Yakifo/amqtt) — MQTT broker/client แบบ pure-Python ติดตั้งผ่าน `pip` ล้วนๆ ไม่ต้องลงโปรแกรมแยก ไม่ต้องใช้สิทธิ์ admin เหมาะกับ dev บนคอม เพราะยังไม่มี Raspberry Pi จริง (ตอนมีฮาร์ดแวร์จริงค่อยสลับไปใช้ Mosquitto ได้ เนื่องจากพูด MQTT มาตรฐานเดียวกัน ระบบส่วนอื่นไม่ต้องแก้)

```
Simulator ──publish──> MQTT Broker <──subscribe── Backend ──REST──> Frontend
    ▲                                                  │
    └──────────────── subscribe cmd topics ◄───────────┘
                         (publish cmd)
```

### Topic ที่ใช้

```
# เซนเซอร์ — simulator publish, RETAINED
farm/zone1/sensor/temperature
farm/zone1/sensor/humidity
farm/zone1/sensor/soil_moisture/{plotId}         # A1..B4, backend subscribe ผ่าน wildcard +

# อุปกรณ์หลัก (ปั๊ม/พัดลม/ไฟ) — cmd จาก backend (ไม่ retain), state จาก simulator (retain)
farm/zone1/actuator/{pump|fan|light}/cmd
farm/zone1/actuator/{pump|fan|light}/state

# วาล์วรายแปลง — cmd จาก backend (ไม่ retain), state จาก simulator (retain)
farm/zone1/plot/{plotId}/valve/cmd
farm/zone1/plot/{plotId}/valve/state

# ควบคุม simulator — ใช้กับหน้า Simulator Control
farm/zone1/sim/config/cmd            ส่ง patch บางส่วน (paused / ranges) ไม่ retain
farm/zone1/sim/config/state          ค่าปัจจุบันทั้งหมด, retain, publish ใหม่ทุกครั้งที่เปลี่ยน
farm/zone1/sim/status                retain + เป็น MQTT Last Will (simulator ตาย → broker ประกาศ offline ให้อัตโนมัติ)

# จองไว้ใช้ phase หลัง — ยังไม่มีโค้ด
farm/zone1/camera/capture
farm/zone1/ai/detection
farm/system/alert
```

**retained/LWT:** ทุก topic `*/state`, `sim/config/state`, `sim/status` ตั้ง retain เพื่อให้ backend/simulator ที่เพิ่ง restart ได้ค่าล่าสุดทันทีโดยไม่ต้องรอ tick ถัดไป ส่วน topic `*/cmd` **ไม่ retain** เพื่อไม่ให้ simulator ที่เพิ่ง reconnect เผลอ replay คำสั่งเก่า

**คำสั่ง → ผลลัพธ์แบบ sync:** ทุกคำสั่ง (เปิด/ปิดอุปกรณ์, วาล์ว, ปรับ config) แนบ `requestId` แบบสุ่มไปด้วย backend รอ event `*/state` ที่มี `requestId` เดียวกันกลับมาก่อนตอบ REST response (timeout 2 วินาที ถ้าไม่ตอบกลับจะได้ HTTP 504) ทำให้ endpoint POST ยังคงพฤติกรรมเดิมของ Phase 2 (ยิงแล้วได้ state ล่าสุดกลับมาทันที) แม้เบื้องหลังจะเป็น async ผ่าน MQTT แล้ว

**โหมดหยุดชั่วคราว (pause):** เมื่อกดหยุดที่หน้า Simulator Control, simulator จะไม่ publish ค่าเซนเซอร์ใหม่เลย ทำให้ทั้งค่าตัวเลขและ `timestamp` ที่ backend เห็นค้างนิ่ง (ใช้ทดสอบ UI ในสถานะ "ข้อมูลไม่อัปเดต" ได้) คำสั่งเปิด/ปิดอุปกรณ์และปรับ config ยังทำงานได้ปกติระหว่างหยุด

## โครงสร้างโปรเจค

```
backend/
  requirements.txt
  .env                      SUPABASE_URL, SUPABASE_SECRET_KEY (ไม่ commit — ดู .env.example)
  supabase/schema.sql        SQL สร้างตาราง sensor_readings — รันครั้งเดียวใน Supabase SQL Editor
  shared/topics.py           topic constants + payload helpers ใช้ร่วมกันทั้ง broker/simulator/app
  broker/
    broker_config.yaml       config ของ amqtt broker (listener 0.0.0.0:1883, allow-anonymous)
    run_broker.py            python -m broker.run_broker
  simulator/
    config.py                SimulatorConfig: paused + ranges ต่อ metric, ปรับได้แบบ runtime
    engine.py                random-walk ล้วนๆ (พอร์ตมาจาก state.py เดิม), re-clamp ค่าปัจจุบันทันทีเมื่อ range เปลี่ยน
    run_simulator.py         python -m simulator.run_simulator — publish เซนเซอร์ทุก 5 วิ, ตอบสนอง cmd ทันที
  app/
    state.py                 cache สถานะล่าสุดในหน่วยความจำ (ไม่สุ่มเองแล้ว) + setter ให้ bridge เรียก
    mqtt_bridge.py            MQTT client ฝั่ง backend + publish_and_await() สำหรับ endpoint แบบ sync
                               + persist ค่าเซนเซอร์ลง Supabase ทุก tick (ดู sim/status handler)
    supabase_client.py        httpx wrapper เรียก Supabase PostgREST: insert_reading(), fetch_history()
    main.py                   routes: GET /api/zone1/status, POST .../actuator/{device}, POST .../plot/{id}/valve,
                               GET/POST /api/zone1/simulator/config, GET /api/zone1/history

src/
  types/farm.ts             ชนิดข้อมูล SensorReading, DeviceState, PlotStatus, ZoneStatus, SimulatorConfig, RangeConfig
  api/client.ts               fetch wrapper เรียก backend (getZoneStatus, setActuator, setValve,
                               fetchSimulatorConfig, updateSimulatorConfig, fetchHistory)
  mock/mockData.ts          (Phase 1 เดิม) ฟังก์ชันสุ่มค่าเซนเซอร์ฝั่ง browser — เก็บไว้อ้างอิง ไม่ได้ใช้แล้ว
  hooks/useMockSensorData.ts  (Phase 1 เดิม) hook สุ่มข้อมูลในเบราว์เซอร์ — เก็บไว้อ้างอิง ไม่ได้ใช้แล้ว
  hooks/useZoneStatus.ts   hook ที่ใช้จริงตอนนี้: seed ประวัติจาก Supabase ครั้งแรก + polling backend ทุก 5 วินาที
                             + สั่งงานอุปกรณ์/วาล์วผ่าน API
  hooks/useSimulatorConfig.ts หน้า Simulator Control ใช้: polling config ทุก 5 วิ + setPaused/setRange
  lib/status.ts             เกณฑ์ปลอดภัย/เฝ้าระวัง/อันตราย ของอุณหภูมิ ความชื้นอากาศ ความชื้นดิน
  lib/automation.ts         กฎอัตโนมัติแบบ rule-based (if-then) preview ของ Phase 5 — ยังไม่ใช่ AI/ML
  components/
    Dashboard.tsx            หน้าหลัก ดึงสถานะจาก useZoneStatus + แสดง loading/error เมื่อต่อ backend ไม่ได้
    GreenhouseFloorplan.tsx ผังโรงเรือนแบบ flexbox/grid: แปลงปลูก 8 แปลง, เซนเซอร์, ปั๊ม, พัดลม, ไฟ (responsive มือถือ)
    SensorCard.tsx          การ์ดแสดงค่าอุณหภูมิ/ความชื้นอากาศ/ความชื้นดิน พร้อมแถบช่วง ป้ายเตือน และ sparkline แนวโน้ม
    DeviceToggle.tsx        สวิตช์เปิด-ปิดอุปกรณ์หลัก (ปั๊ม/พัดลม/ไฟ) — ปิดใช้งานเมื่ออยู่โหมดอัตโนมัติ
    PlotValveList.tsx       รายการวาล์วน้ำหยดรายแปลง เปิด-ปิดทีละแปลงได้
    AlertBanner.tsx         แบนเนอร์แจ้งเตือนเมื่อค่าเซนเซอร์เกินช่วงปลอดภัย
    EventLog.tsx            ประวัติการเปิด/ปิดอุปกรณ์และการแจ้งเตือนล่าสุด (Activity Log)
    Sparkline.tsx           กราฟเส้นเล็กแสดงแนวโน้มค่าล่าสุด — ตอนนี้ seed มาจาก Supabase ตอนโหลดหน้า (Phase 4)
    CameraPlaceholder.tsx   จุดที่จะแสดงภาพจากกล้องในอนาคต (Phase 6)
    SimulatorControlPanel.tsx หน้าใหม่ Phase 3: หยุด/เริ่มจำลอง, ปรับช่วงค่าสุ่มต่อ metric, ปุ่มลัดทดสอบราสีเทา
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

ช่วงเริ่มต้นของ simulator (ปรับได้ที่หน้า Simulator Control): อุณหภูมิ 14–33°C, ความชื้นอากาศ 40–97%, ความชื้นดิน 22–90%

## สิ่งที่ทำใน Phase 3

- สร้าง **MQTT broker** แบบ pure-Python (`amqtt`) รันด้วย `python -m broker.run_broker` ไม่ต้องติดตั้งโปรแกรมแยก
- แยก **simulator process** (`backend/simulator/`) ออกจาก backend โดยสิ้นเชิง — สุ่มค่าเซนเซอร์แบบเดียวกับ Phase 2 เดิม (พอร์ตมาจาก `state.py`) แต่ publish ผ่าน MQTT แทน และตอบสนองคำสั่งอุปกรณ์/วาล์วผ่าน MQTT cmd/state topic
- เพิ่มช่วงค่าที่ปรับได้แบบ runtime (`simulator/config.py`) — เปลี่ยนช่วงแล้วค่าปัจจุบัน re-clamp เข้าช่วงใหม่ทันที ไม่ต้องรอสุ่ม
- Backend เปลี่ยนจากสุ่มเองมาเป็น **`mqtt_bridge.py`** — subscribe ทุก topic ที่เกี่ยวข้อง อัปเดต state cache ในหน่วยความจำ และมี `publish_and_await()` ให้ REST endpoint ยังตอบกลับแบบ sync ได้เหมือนเดิม
- เพิ่ม endpoint `GET/POST /api/zone1/simulator/config` และหน้าใหม่ **Simulator Control** (`SimulatorControlPanel.tsx` + `useSimulatorConfig.ts`) สลับดูได้จาก tab บนสุดของหน้าเว็บ
- ทุกจุดเชื่อมต่อ MQTT (simulator, backend) มี auto-reconnect + backoff ในตัว รองรับการรัน 4 terminal แบบไม่เรียงลำดับ

`src/mock/mockData.ts` และ `src/hooks/useMockSensorData.ts` (ของ Phase 1) ยังเก็บไว้ในโปรเจคเป็นข้อมูลอ้างอิง แต่ไม่ได้ถูกเรียกใช้แล้ว

## สิ่งที่ทำใน Phase 4

- เพิ่มตาราง `sensor_readings` บน **Supabase (Postgres)** — schema อยู่ที่ `backend/supabase/schema.sql`
- `backend/app/supabase_client.py` คุยกับ Supabase ผ่าน PostgREST โดยตรงด้วย `httpx` (ไม่ใช้ SDK `supabase-py` เต็มตัว เพราะต้องการแค่ insert 1 แบบ กับ select 1 แบบ):
  - `insert_reading()` — บันทึก 1 แถวต่อ tick, ไม่ throw ถ้า Supabase ล่ม (แค่ log แล้วปล่อยผ่าน ไม่ให้ MQTT bridge พัง)
  - `fetch_history()` — ดึงย้อนหลังตามช่วงเวลา ให้ error ปกติถ้าดึงไม่ได้ (endpoint จะแปลงเป็น 502)
- `mqtt_bridge.py` เกาะกับ heartbeat `farm/zone1/sim/status` ที่มีอยู่แล้ว (ส่งทุก tick หลัง publish ค่าเซนเซอร์) เป็นสัญญาณ "มีค่าที่บันทึกได้แล้ว" — ไม่ต้องเพิ่ม topic หรือ timer ใหม่ ข้ามการบันทึกตอน pause และตอน snapshot แรกที่เพิ่งต่อ broker (`lastTick` เป็น `null`)
- เพิ่ม `GET /api/zone1/history?hours=6` (สูงสุด 24 ชม.) คืนค่าเป็น array รูปแบบเดียวกับ `HistoryPoint` ฝั่ง frontend ไม่ต้องแปลงข้อมูลเพิ่ม
- `useZoneStatus.ts` เรียก `fetchHistory()` ครั้งเดียวตอนโหลดหน้า มาเติม sparkline ก่อนเริ่ม polling สด — ถ้าดึงไม่ได้ (ยังไม่ตั้ง Supabase หรือเน็ตมีปัญหา) จะเงียบแล้วเริ่มจากค่าว่างเหมือน Phase 3 เดิม ไม่กระทบสถานะ "เชื่อมต่อ backend ไม่ได้" ที่ใช้แสดงหน้า error เต็มจอ

## จุดที่ต้องแก้ตอน Phase 5

Phase 5 จะย้ายจาก rule-based automation (`src/lib/automation.ts`, รันฝั่ง browser) ไปเป็นระบบควบคุมอัตโนมัติจริงที่รันบน Raspberry Pi แบบ offline-first — จุดที่ต้องคิดเพิ่มคือ Pi จะต่อ Supabase ตรงได้ไหมตอนเน็ตหลุด หรือต้อง queue ไว้ sync ทีหลัง (Supabase ยังใช้เก็บ history ต่อได้เหมือนเดิม ไม่ต้องเปลี่ยน schema)

## Roadmap (6 phases)

1. Phase 1 — Dashboard UI ด้วย mock data ล้วนๆ ✅
2. Phase 2 — FastAPI mock backend + frontend ดึงจาก API จริงผ่าน polling ✅
3. Phase 3 — MQTT simulator แยก process จริง + หน้าควบคุม simulator ✅
4. **Phase 4 (เฟสนี้)** — เก็บประวัติข้อมูลจริงใน Supabase + กราฟย้อนหลังไม่หายตอน refresh ✅
5. Phase 5 — ระบบควบคุมอัตโนมัติจริงบน Pi (ต่อยอดจาก rule-based ใน `lib/automation.ts`), Raspberry Pi เสิร์ฟเว็บเองแบบ offline-first
6. Phase 6 — AI ตรวจโรคใบ/ราสีเทา/ระยะสุกของผลจากกล้อง รันบน Pi
