-- 1) Extension (if not already enabled)
create extension if not exists "uuid-ossp";

-- 2) Table
create table if not exists public.unit_room_dimensions (
  id                uuid primary key default gen_random_uuid(),

  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  development_id    uuid not null references public.developments(id) on delete cascade,
  house_type_id     uuid not null references public.house_types(id) on delete cascade,
  unit_id           uuid references public.units(id) on delete cascade,

  -- Business fields
  room_name         text not null,                -- as seen by the user, e.g. "Living Room"
  room_key          text not null,                -- canonical, e.g. "living_room"
  floor             text,                         -- "ground", "first", etc. (optional enum later)

  length_m          numeric(6,2),                 -- 9999.99 max
  width_m           numeric(6,2),
  area_sqm          numeric(7,2),
  ceiling_height_m  numeric(5,2),

  source            text not null default 'unknown',  -- 'schedule_pdf' | 'floorplan_vision' | 'manual_override'
  verified          boolean not null default false,   -- only TRUE is used in answers

  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 3) Indexes for fast lookup
create index if not exists idx_urd_tenant_dev_house
  on public.unit_room_dimensions (tenant_id, development_id, house_type_id);

create index if not exists idx_urd_room_key
  on public.unit_room_dimensions (room_key);

create index if not exists idx_urd_unit
  on public.unit_room_dimensions (unit_id);

-- 4) Uniqueness guard:
-- At most one canonical record per (house_type, unit?, room_key, floor, source)
create unique index if not exists uniq_urd_house_room_floor_source
  on public.unit_room_dimensions (
    house_type_id,
    coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid),
    room_key,
    coalesce(floor, ''),
    source
  );

-- 5) Updated_at maintenance (if you want DB-level enforcement)
create or replace function set_unit_room_dimensions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_unit_room_dimensions_updated_at on public.unit_room_dimensions;

create trigger trg_unit_room_dimensions_updated_at
before update on public.unit_room_dimensions
for each row
execute function set_unit_room_dimensions_updated_at();
