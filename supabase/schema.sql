-- Mesa da Equipe - modelo inicial Supabase
-- Rode este arquivo no SQL Editor do Supabase.
-- Este script pode ser executado mais de uma vez.

create extension if not exists "pgcrypto";

do $$ begin
  create type app_role as enum ('manager', 'collaborator', 'finance', 'logistics');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type client_priority as enum ('Alta', 'Media', 'Baixa');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type client_health as enum ('Atencao', 'Estavel', 'Saudavel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type process_status as enum ('Entrada', 'A fazer', 'Em andamento', 'Aguardando', 'Concluido');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type order_status as enum ('Em rota', 'Segurar', 'Aguardando limite', 'Nota bloqueada', 'Entregue');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type flag_type as enum ('Segura entrega', 'Nao emite nota fiscal', 'Solicita limite');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type personal_task_status as enum ('A fazer', 'Em andamento', 'Concluida');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type client_task_status as enum ('A fazer', 'Em andamento', 'Concluida');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type client_task_restriction as enum ('Nao entregar', 'Aguardando pagamento', 'Nao faturar', 'Aguardando NF de transferencia', 'Sem restricoes', 'Reserva de pneus', 'Pedido sem estoque');
exception when duplicate_object then null;
end $$;

alter type client_task_restriction add value if not exists 'Reserva de pneus';
alter type client_task_restriction add value if not exists 'Pedido sem estoque';

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role app_role not null default 'collaborator',
  created_at timestamptz not null default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  client_code text,
  name text not null,
  cnpj text,
  uf text,
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

create table if not exists personal_tasks (
  id uuid primary key default gen_random_uuid(),
  assigned_profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  comments text,
  due_date date,
  status personal_task_status not null default 'A fazer',
  priority client_priority not null default 'Media',
  attachment_name text,
  attachment_url text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clients add column if not exists client_code text;
alter table clients add column if not exists cnpj text;
alter table clients add column if not exists uf text;

create table if not exists client_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  order_number text not null,
  assigned_profile_id uuid references profiles(id),
  next_profile_id uuid references profiles(id),
  title text not null,
  current_step text,
  next_step text,
  restriction_status client_task_restriction not null default 'Sem restricoes',
  notes text,
  attachment_name text,
  attachment_url text,
  status client_task_status not null default 'A fazer',
  priority client_priority not null default 'Media',
  created_by uuid references profiles(id),
  completed_by uuid references profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists personal_task_participants (
  personal_task_id uuid not null references personal_tasks(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (personal_task_id, profile_id)
);

create table if not exists client_task_events (
  id uuid primary key default gen_random_uuid(),
  client_task_id uuid not null references client_tasks(id) on delete cascade,
  event_type text not null default 'historico',
  description text not null,
  comment text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table client_tasks add column if not exists order_number text;
alter table client_tasks add column if not exists next_profile_id uuid references profiles(id);
alter table client_tasks add column if not exists restriction_status client_task_restriction not null default 'Sem restricoes';
alter table client_tasks add column if not exists notes text;
alter table client_tasks add column if not exists attachment_name text;
alter table client_tasks add column if not exists attachment_url text;
alter table personal_tasks add column if not exists attachment_name text;
alter table personal_tasks add column if not exists attachment_url text;
alter table personal_tasks add column if not exists comments text;
alter table personal_tasks add column if not exists completed_at timestamptz;
alter table personal_tasks add column if not exists recurrence_group_id uuid;
alter table personal_tasks add column if not exists recurrence_rule text default 'none';
alter table personal_tasks add column if not exists recurrence_until date;
alter table personal_tasks add column if not exists extension_due_date date;
alter table personal_tasks add column if not exists extension_reason text;
alter table personal_tasks add column if not exists extension_status text;
alter table personal_tasks add column if not exists extension_requested_at timestamptz;
alter table personal_tasks add column if not exists extension_requested_by uuid references profiles(id);
alter table personal_tasks add column if not exists extension_decided_at timestamptz;
alter table personal_tasks add column if not exists extension_decided_by uuid references profiles(id);

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

drop trigger if exists personal_tasks_touch_updated_at on personal_tasks;
create trigger personal_tasks_touch_updated_at before update on personal_tasks for each row execute function touch_updated_at();

drop trigger if exists client_tasks_touch_updated_at on client_tasks;
create trigger client_tasks_touch_updated_at before update on client_tasks for each row execute function touch_updated_at();

alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table client_flags enable row level security;
alter table processes enable row level security;
alter table orders enable row level security;
alter table client_history enable row level security;
alter table personal_tasks enable row level security;
alter table personal_task_participants enable row level security;
alter table client_tasks enable row level security;
alter table client_task_events enable row level security;

create or replace function get_app_user_role()
returns app_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

drop policy if exists "profiles can read own profile" on profiles;
drop policy if exists "managers can read all profiles" on profiles;
drop policy if exists "profiles can update own profile" on profiles;
drop policy if exists "managers can manage profiles" on profiles;
drop policy if exists "clients read by role" on clients;
drop policy if exists "clients write by manager" on clients;
drop policy if exists "clients insert authenticated" on clients;
drop policy if exists "clients update authenticated" on clients;
drop policy if exists "clients delete by manager" on clients;
drop policy if exists "related contacts read by visible client" on client_contacts;
drop policy if exists "related flags read by visible client" on client_flags;
drop policy if exists "related processes read by visible client" on processes;
drop policy if exists "related orders read by visible client" on orders;
drop policy if exists "related history read by visible client" on client_history;
drop policy if exists "operational write by manager finance logistics" on client_flags;
drop policy if exists "process write by manager or owner" on processes;
drop policy if exists "orders write by manager finance logistics" on orders;
drop policy if exists "history insert authenticated" on client_history;
drop policy if exists "personal tasks private read" on personal_tasks;
drop policy if exists "personal task participants read" on personal_task_participants;
drop policy if exists "personal task participants write" on personal_task_participants;
drop policy if exists "personal tasks private write" on personal_tasks;
drop policy if exists "personal tasks private insert" on personal_tasks;
drop policy if exists "personal tasks private update" on personal_tasks;
drop policy if exists "personal tasks delete by manager" on personal_tasks;
drop policy if exists "client tasks shared read" on client_tasks;
drop policy if exists "client task events shared read" on client_task_events;
drop policy if exists "client task events shared write" on client_task_events;
drop policy if exists "client tasks shared write" on client_tasks;
drop policy if exists "client tasks shared insert" on client_tasks;
drop policy if exists "client tasks shared update" on client_tasks;
drop policy if exists "client tasks delete by manager" on client_tasks;

create policy "profiles can read own profile" on profiles for select using (id = auth.uid());
create policy "managers can read all profiles" on profiles for select using (get_app_user_role() = 'manager');
create policy "profiles can update own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "managers can manage profiles" on profiles for all using (get_app_user_role() = 'manager') with check (get_app_user_role() = 'manager');

create policy "clients read by role" on clients for select using (auth.uid() is not null);

create policy "clients insert authenticated" on clients for insert with check (auth.uid() is not null);
create policy "clients update authenticated" on clients for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "clients delete by manager" on clients for delete using (get_app_user_role() = 'manager');

create policy "related contacts read by visible client" on client_contacts for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related flags read by visible client" on client_flags for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related processes read by visible client" on processes for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related orders read by visible client" on orders for select using (exists (select 1 from clients c where c.id = client_id));
create policy "related history read by visible client" on client_history for select using (exists (select 1 from clients c where c.id = client_id));

create policy "operational write by manager finance logistics" on client_flags for all using (get_app_user_role() in ('manager', 'finance', 'logistics')) with check (get_app_user_role() in ('manager', 'finance', 'logistics'));

create policy "process write by manager or owner" on processes for all using (
  get_app_user_role() = 'manager'
  or exists (select 1 from clients c where c.id = client_id and c.owner_profile_id = auth.uid())
) with check (
  get_app_user_role() = 'manager'
  or exists (select 1 from clients c where c.id = client_id and c.owner_profile_id = auth.uid())
);

create policy "orders write by manager finance logistics" on orders for all using (get_app_user_role() in ('manager', 'finance', 'logistics')) with check (get_app_user_role() in ('manager', 'finance', 'logistics'));
create policy "history insert authenticated" on client_history for insert with check (auth.uid() is not null);

create policy "personal tasks private read" on personal_tasks for select using (
  assigned_profile_id = auth.uid()
  or exists (select 1 from personal_task_participants p where p.personal_task_id = id and p.profile_id = auth.uid())
  or get_app_user_role() = 'manager'
);

create policy "personal tasks private insert" on personal_tasks for insert with check (auth.uid() is not null);

create policy "personal tasks private update" on personal_tasks for update using (
  assigned_profile_id = auth.uid()
  or created_by = auth.uid()
  or exists (select 1 from personal_task_participants p where p.personal_task_id = id and p.profile_id = auth.uid())
  or get_app_user_role() = 'manager'
) with check (
  assigned_profile_id = auth.uid()
  or created_by = auth.uid()
  or exists (select 1 from personal_task_participants p where p.personal_task_id = id and p.profile_id = auth.uid())
  or get_app_user_role() = 'manager'
);

create policy "personal tasks delete by manager" on personal_tasks for delete using (get_app_user_role() = 'manager');

create policy "personal task participants read" on personal_task_participants for select using (auth.uid() is not null);

create policy "personal task participants write" on personal_task_participants for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "client tasks shared read" on client_tasks for select using (auth.uid() is not null);
create policy "client tasks shared insert" on client_tasks for insert with check (auth.uid() is not null);
create policy "client tasks shared update" on client_tasks for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "client tasks delete by manager" on client_tasks for delete using (get_app_user_role() = 'manager');
create policy "client task events shared read" on client_task_events for select using (auth.uid() is not null);
create policy "client task events shared write" on client_task_events for insert with check (auth.uid() is not null);
