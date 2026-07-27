// กฎอัตโนมัติแบบ rule-based (if-then ตามเกณฑ์ค่าที่ปลอดภัยสำหรับสตรอว์เบอร์รี่)
// ยังไม่ใช่ AI/ML จริง — เป็นการ preview พฤติกรรมของ Phase 5 (ควบคุมอัตโนมัติ) ไว้ล่วงหน้า
// ใช้ hysteresis (ช่วงกันสวิงตัวถี่) เพื่อไม่ให้อุปกรณ์เปิด-ปิดถี่เกินไปเมื่อค่าแกว่งใกล้เกณฑ์

// พัดลม: เปิดเมื่อร้อนหรือชื้นเกินเกณฑ์ ปิดเมื่อค่ากลับมาต่ำกว่าเกณฑ์แบบมีระยะกันสวิง
export function computeAutoFan(temperature: number, humidity: number, fanOn: boolean): boolean {
  const shouldTurnOn = temperature > 26 || humidity > 85;
  const shouldTurnOff = temperature < 24 && humidity < 80;
  if (fanOn) return !shouldTurnOff;
  return shouldTurnOn;
}

// วาล์วน้ำหยดต่อแปลง: เปิดเมื่อดินแห้งต่ำกว่า 40% ปิดเมื่อชื้นพอ (>=55%) กันเปิดปิดถี่
export function computeAutoValve(soilMoisture: number, valveOpen: boolean): boolean {
  if (valveOpen) return soilMoisture < 55;
  return soilMoisture < 40;
}

// ปั๊มหลัก: เปิดเมื่อมีอย่างน้อยหนึ่งวาล์วที่ควรเปิดอยู่ (ปั๊มต้องทำงานเพื่อส่งน้ำให้วาล์ว)
export function computeAutoPump(anyValveShouldBeOpen: boolean): boolean {
  return anyValveShouldBeOpen;
}

// ไฟปลูกพืชเสริม: เปิดช่วงกลางวัน (06:00-18:00) ตามที่ระบุในเอกสารออกแบบโปรเจค
export function computeAutoLight(hour: number): boolean {
  return hour >= 6 && hour < 18;
}
