import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from shared import topics as topic_names

from . import state as state_module
from . import supabase_client
from .mqtt_bridge import MqttBridge
from .scheduler import WateringScheduler

# uvicorn configures its own uvicorn.* loggers but leaves the root logger at the Python default
# (WARNING) — without this, mqtt_bridge/scheduler/supabase_client's logger.info() calls are
# silently dropped and only exceptions (logger.exception, ERROR level) would ever show up.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s", force=True)

MAX_HISTORY_HOURS = 24

DeviceName = Literal["pump", "fan", "light"]

bridge = MqttBridge()
scheduler = WateringScheduler(bridge)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await bridge.connect()
    scheduler.start()
    try:
        yield
    finally:
        await scheduler.stop()
        await bridge.disconnect()


app = FastAPI(title="Smart Farm Mock API", lifespan=lifespan)

# Phase 2: frontend dev server รันที่ localhost:5173 (Vite ค่าเริ่มต้น)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DeviceCommand(BaseModel):
    on: bool


class ValveCommand(BaseModel):
    open: bool


class RangePatch(BaseModel):
    min: float | None = None
    max: float | None = None


class SimulatorConfigPatch(BaseModel):
    paused: bool | None = None
    ranges: dict[str, RangePatch] | None = None


class SchedulePatch(BaseModel):
    startTime: str
    durationMinutes: int
    enabled: bool


@app.get("/api/zone1/status")
def get_status() -> dict:
    return state_module.state


@app.post("/api/zone1/actuator/{device}")
async def set_actuator(device: DeviceName, command: DeviceCommand) -> dict:
    topic = topic_names.actuator_cmd_topic(device)
    try:
        await bridge.publish_and_await(topic, {"on": command.on})
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="simulator did not acknowledge in time") from None
    return state_module.state


@app.post("/api/zone1/plot/{plot_id}/valve")
async def set_valve(plot_id: str, command: ValveCommand) -> dict:
    if plot_id not in topic_names.PLOT_IDS:
        raise HTTPException(status_code=404, detail="unknown plot")
    topic = topic_names.valve_cmd_topic(plot_id)
    try:
        await bridge.publish_and_await(topic, {"open": command.open})
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="simulator did not acknowledge in time") from None
    return state_module.state


@app.get("/api/zone1/history")
async def get_history(hours: float = 6) -> list[dict]:
    hours = min(hours, MAX_HISTORY_HOURS)
    since_iso = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    try:
        return await supabase_client.fetch_history(since_iso)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="could not load history from Supabase") from None


@app.get("/api/zone1/schedules")
async def get_schedules() -> list[dict]:
    try:
        return await supabase_client.fetch_schedules()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="could not load watering schedules from Supabase") from None


@app.put("/api/zone1/plot/{plot_id}/schedule")
async def put_schedule(plot_id: str, patch: SchedulePatch) -> dict:
    if plot_id not in topic_names.PLOT_IDS:
        raise HTTPException(status_code=404, detail="unknown plot")
    try:
        return await supabase_client.upsert_schedule(plot_id, patch.startTime, patch.durationMinutes, patch.enabled)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="could not save watering schedule to Supabase") from None


@app.get("/api/zone1/simulator/config")
def get_simulator_config() -> dict:
    if bridge.simulator_config is None:
        raise HTTPException(status_code=503, detail="simulator config not received yet")
    return bridge.simulator_config


@app.post("/api/zone1/simulator/config")
async def update_simulator_config(patch: SimulatorConfigPatch) -> dict:
    body = patch.model_dump(exclude_none=True)
    if "ranges" in body:
        body["ranges"] = {metric: bounds for metric, bounds in body["ranges"].items() if bounds}
    try:
        return await bridge.publish_and_await(topic_names.SIM_CONFIG_CMD, body)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="simulator did not acknowledge config update") from None
