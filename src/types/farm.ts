export interface SensorReading {
  temperature: number;
  humidity: number;
  soilMoisture: number;
  timestamp: string;
}

export interface DeviceState {
  pump: boolean;
  fan: boolean;
  light: boolean;
}

export interface PlotStatus {
  id: string;
  soilMoisture: number;
  valveOpen: boolean;
}

export interface ZoneStatus extends SensorReading, DeviceState {
  zoneId: string;
  zoneName: string;
  plots: PlotStatus[];
}

export type StatusLevel = 'safe' | 'warn' | 'danger';

export interface StatusInfo {
  level: StatusLevel;
  label: string;
  color: string;
  bg: string;
  border: string;
}

export interface Alert {
  id: string;
  message: string;
  level: StatusLevel;
}

export interface HistoryPoint {
  temperature: number;
  humidity: number;
  soilAvg: number;
  timestamp: string;
}

export type LogEventKind = 'device' | 'alert';

export interface LogEvent {
  id: string;
  timestamp: string;
  message: string;
  kind: LogEventKind;
  level?: StatusLevel;
}

export interface RangeConfig {
  min: number;
  max: number;
}

export type SimulatorMetric = 'temperature' | 'humidity' | 'soilMoisture';

export interface SimulatorConfig {
  paused: boolean;
  ranges: Record<SimulatorMetric, RangeConfig>;
  timestamp: string;
}
