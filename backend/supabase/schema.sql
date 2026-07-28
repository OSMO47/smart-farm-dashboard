-- Phase 4: sensor history table.
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

create table if not exists sensor_readings (
  id bigint generated always as identity primary key,
  zone_id text not null default 'zone1',
  temperature double precision not null,
  humidity double precision not null,
  soil_moisture double precision not null,
  recorded_at timestamptz not null
);

create index if not exists sensor_readings_zone_recorded_idx
  on sensor_readings (zone_id, recorded_at desc);

alter table sensor_readings enable row level security;
-- backend uses the secret key, which bypasses RLS -- no policy needed for the app to work;
-- this just keeps the table closed to the anon/public key.

-- Watering schedules: one row per plot (plot_id is the primary key -- one active
-- schedule per plot). The backend's scheduler.py checks these every ~20s.
create table if not exists watering_schedules (
  plot_id text primary key,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table watering_schedules enable row level security;
-- same as sensor_readings: backend uses the secret key and bypasses RLS.
