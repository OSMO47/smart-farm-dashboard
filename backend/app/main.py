import asyncio
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from shared import topics as topic_names

from . import state as state_module
from .mqtt_bridge import MqttBridge

DeviceName = Literal["pump", "fan", "light"]

bridge = MqttBridge()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await bridge.connect()
    try:
        yield
    finally:
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
