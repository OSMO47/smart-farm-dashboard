"""In-memory mock zone state. Phase 2: ยังไม่มีฮาร์ดแวร์จริง ตัวเลขยังสุ่มอยู่
เหมือน Phase 1 แต่ย้ายมาทำงานฝั่ง server แทนฝั่ง browser (ดู src/mock/mockData.ts เดิมของ frontend)
Phase 3 จะเปลี่ยนจุดนี้ให้รับค่าจาก MQTT แทนการสุ่ม
"""

import random
from datetime import datetime, timezone

PLOT_IDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"]


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_initial_state() -> dict:
    plots = [
        {"id": pid, "soilMoisture": 44 + ((i * 7) % 30), "valveOpen": i in (1, 5)}
        for i, pid in enumerate(PLOT_IDS)
    ]
    return {
        "zoneId": "zone1",
        "zoneName": "โซน 1",
        "temperature": 18 + random.random() * 8,  # 18-26
        "humidity": 55 + random.random() * 35,  # 55-90
        "soilMoisture": 40 + random.random() * 35,  # 40-75 (เฉลี่ยเริ่มต้น)
        "timestamp": now_iso(),
        "pump": True,
        "fan": False,
        "light": True,
        "plots": plots,
    }


state: dict = _generate_initial_state()


def step() -> None:
    """เดินสุ่มค่าถัดไปแบบต่อเนื่อง (random walk) — ทำงานทุก 5 วินาทีจาก background task ใน main.py"""
    fan_on = state["fan"]
    light_on = state["light"]
    pump_on = state["pump"]

    state["temperature"] = clamp(
        state["temperature"] + (random.random() - 0.5) * 0.8 + (-0.3 if fan_on else 0) + (0.15 if light_on else 0),
        14,
        33,
    )
    state["humidity"] = clamp(
        state["humidity"] + (random.random() - 0.5) * 2.5 + (-1.2 if fan_on else 0.3),
        40,
        97,
    )

    for i, plot in enumerate(state["plots"]):
        dry_rate = 0.4 + ((i * 13) % 10) / 18
        delta = 2.4 if (pump_on and plot["valveOpen"]) else -dry_rate
        plot["soilMoisture"] = clamp(plot["soilMoisture"] + (random.random() - 0.5) * 1.2 + delta, 22, 90)

    state["soilMoisture"] = sum(p["soilMoisture"] for p in state["plots"]) / len(state["plots"])
    state["timestamp"] = now_iso()
