-- Mesa da Equipe - modelo inicial Supabase
-- Rode este arquivo no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

create type app_role as enum ('manager', 'collaborator', 'finance', 'logistics');
create type client_priority as enum ('Alta', 'Media', 'Baixa');
create type client_health as enum ('Atencao', 'Estavel', 'Saudavel');
create type process_status as enum ('Entrada', 'A fazer', 'Em andamento', 'Aguardando', 'Concluido');
create type order_status as enum ('Em rota', 'Segurar', 'Aguardando limite', 'Nota bloqueada', 'Entregue');
create type flag_type as enum ('Segura entrega', 'Nao emite nota fiscal', 'Solicita limite');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role app_role not null default 'collaborator',
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text,
  owner_profile_id uuid references profiles(id),
  initials text,
  health client_health not null default 'Estavel',
  priority client_priority not null default 'Media',
  credit_limit numeric(12,2),
  used_limit numeric(12,2),
  next_due text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists client_flags (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  flag flag_type not null,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists processes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  status process_status not null default 'Entrada',
  category text,
  due_text text,
  priority client_priority not null default 'Media',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  code text not null,
  invoice text,
  shipment_forecast date,
  arrival_forecast date,
  delivery_date date,
  status order_status not null default 'Em rota',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  description text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clients_touch_updated_at on clients;
create trigger clients_touch_updated_at before update on clients for each row execute function touch_updated_at();

drop trigger if exists processes_touch_updated_at on processes;
create trigger processes_touch_updated_at before update on processes for each row execute function touch_updated_at();

drop trigger if exists orders_touch_updated_at on orders;
create trigger orders_touch_updated_at before update on orders for each row execute function touch_updated_at();

alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table client_flags enable row level security;
alter table processes enable row level security;
alter table orders enable row level security;
alter table client_history enable row level security;

create or replace function current_role()
returns app_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

create policy "profiles can read own profile" on profiles for select using (id = auth.uid());
create policy "managers can read all profiles" on profiles for select using (current_role() = 'manager');

create policy "clients read by role" on clients for select using (
  current_role() in ('manager', 'finance', 'logistics')
  or owner_profile_id = auth.uid()
);
create policy "clients write by manager" on clients for all using (current_role() = 'manager') with check (current_role() = 'manager');

create policy "related contacts read by visible client" on client_contacts for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related flags read by visible client" on client_flags for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related processes read by visible client" on processes for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related orders read by visible client" on orders for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related history read by visible client" on client_history for select using (exists (select 1 from clients c where c.id = client_id));

create policy "operational write by manager finance logistics" on client_flags for all using (current_role() in ('manager', 'finance', 'logistics')) with check (current_role() in ('manager', 'finance', 'logistics'));
create policy "process write by manager or owner" on processes for all using (current_role() = 'manager' or exists (select 1 from clients c where c.id = client_id and c.owner_profile_id = auth.uid())) with check (current_role() = 'manager' or exists (select 1 from clients c where c.id = client_id and c.owner_profile_id = auth.uid()));
create policy "orders write by manager finance logistics" on orders for all using (current_role() in ('manager', 'finance', 'logistics')) with check (current_role() in ('manager', 'finance', 'logistics'));
create policy "history insert authenticated" on client_history for insert with check (auth.uid() is not null);
