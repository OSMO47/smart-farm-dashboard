import asyncio
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import state as state_module

UPDATE_INTERVAL_SECONDS = 5
DeviceName = Literal["pump", "fan", "light"]


async def _simulate_loop() -> None:
    while True:
        await asyncio.sleep(UPDATE_INTERVAL_SECONDS)
        state_module.step()


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_simulate_loop())
    try:
        yield
    finally:
        task.cancel()


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


@app.get("/api/zone1/status")
def get_status() -> dict:
    return state_module.state


@app.post("/api/zone1/actuator/{device}")
def set_actuator(device: DeviceName, command: DeviceCommand) -> dict:
    state_module.state[device] = command.on
    return state_module.state


@app.post("/api/zone1/plot/{plot_id}/valve")
def set_valve(plot_id: str, command: ValveCommand) -> dict:
    for plot in state_module.state["plots"]:
        if plot["id"] == plot_id:
            plot["valveOpen"] = command.open
            return state_module.state
    raise HTTPException(status_code=404, detail="unknown plot")
