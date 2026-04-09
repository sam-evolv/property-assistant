-- Agent profiles (linked to auth.users)
create table if not exists agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  name text not null,
  firm text,
  title text,
  avatar_initials text,
  phone text,
  created_at timestamptz default now()
);

-- Schemes an agent manages
create table if not exists agent_schemes (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agent_profiles(id) on delete cascade,
  name text not null,
  developer_name text,
  location text,
  total_units integer default 0,
  completion_date text,
  created_at timestamptz default now()
);

-- Pipeline stage counts per scheme
create table if not exists agent_scheme_stages (
  scheme_id uuid references agent_schemes(id) on delete cascade primary key,
  deposit integer default 0,
  contracts_issued integer default 0,
  contracts_signed integer default 0,
  closed integer default 0
);

-- Individual units within a scheme
create table if not exists agent_units (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid references agent_schemes(id) on delete cascade,
  unit_ref text not null,
  unit_type text,
  sqm integer,
  price integer,
  status text default 'available'
    check (status in ('available','reserved','sale_agreed','exchanged','contracts_out','let_agreed')),
  buyer_name text,
  solicitor_name text,
  aip_approved boolean default false,
  contracts_status text,
  deposit_date date,
  contracts_date date,
  contracts_signed_date date,
  closing_date date,
  is_urgent boolean default false,
  created_at timestamptz default now()
);

-- Buyers in the pipeline
create table if not exists agent_buyers (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agent_profiles(id) on delete cascade,
  initials text,
  name text not null,
  unit_ref text,
  scheme_name text,
  developer text,
  source text,
  ai_score integer default 50,
  aip_approved boolean default false,
  status text default 'enquiry',
  last_contact text,
  notes text,
  phone text,
  email text,
  budget text,
  timeline text,
  deposit_date date,
  contracts_date date,
  contracts_signed_date date,
  closing_date date,
  is_urgent boolean default false,
  created_at timestamptz default now()
);

-- Documents
create table if not exists agent_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agent_profiles(id) on delete cascade,
  name text not null,
  scheme_name text,
  file_url text,
  views integer default 0,
  uploaded_at date default current_date
);

-- Viewings
create table if not exists agent_viewings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agent_profiles(id) on delete cascade,
  viewing_time text,
  buyer_name text,
  unit_ref text,
  scheme_name text,
  status text default 'pending' check (status in ('confirmed','pending')),
  viewing_date text,
  created_at timestamptz default now()
);

-- Intelligence conversation history
create table if not exists agent_intelligence_history (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agent_profiles(id) on delete cascade,
  user_input text not null,
  steps jsonb not null,
  created_at timestamptz default now()
);

-- RLS policies
alter table agent_profiles enable row level security;
alter table agent_schemes enable row level security;
alter table agent_scheme_stages enable row level security;
alter table agent_units enable row level security;
alter table agent_buyers enable row level security;
alter table agent_documents enable row level security;
alter table agent_viewings enable row level security;
alter table agent_intelligence_history enable row level security;

create policy "agent own profile" on agent_profiles
  for all using (user_id = auth.uid());

create policy "agent own schemes" on agent_schemes
  for all using (agent_id in (select id from agent_profiles where user_id = auth.uid()));

create policy "agent own scheme stages" on agent_scheme_stages
  for all using (scheme_id in (
    select id from agent_schemes where agent_id in (
      select id from agent_profiles where user_id = auth.uid())));

create policy "agent own units" on agent_units
  for all using (scheme_id in (
    select id from agent_schemes where agent_id in (
      select id from agent_profiles where user_id = auth.uid())));

create policy "agent own buyers" on agent_buyers
  for all using (agent_id in (select id from agent_profiles where user_id = auth.uid()));

create policy "agent own documents" on agent_documents
  for all using (agent_id in (select id from agent_profiles where user_id = auth.uid()));

create policy "agent own viewings" on agent_viewings
  for all using (agent_id in (select id from agent_profiles where user_id = auth.uid()));

create policy "agent own intel history" on agent_intelligence_history
  for all using (agent_id in (select id from agent_profiles where user_id = auth.uid()));
