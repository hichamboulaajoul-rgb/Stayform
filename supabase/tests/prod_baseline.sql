-- Minimal copy of the production schema (as of 2026-11-08) used to test migrations locally.
-- Not a real migration: run only against a throwaway Postgres.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;

create table public.profiles (
  id uuid primary key, name text, email text, city text, plan text default 'free', guest_count int default 0,
  link_id text, created_at timestamptz default now(), reseller_active boolean default false, reseller_credits int default 0,
  reseller_used_month int default 0, reseller_used_total int default 0, reseller_hosts int, reseller_activated_at timestamptz,
  reseller_pack text, plan_expires_at timestamptz, plan_activated_at timestamptz, plan_interval text, role text, phone text, cin text);
create table public.properties (id uuid primary key default gen_random_uuid(), host_id uuid, name text, address text, wifi_name text, wifi_password text, created_at timestamptz default now());
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
create policy "Hôte crée son profil" on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_read_by_link_id on public.profiles for select using (true);
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy properties_select_own on public.properties for select using (auth.uid() = host_id);
create policy properties_select_anon on public.properties for select using (true);

create view public.profiles_public as select id, name, link_id, phone, cin from public.profiles;
create view public.properties_public as select id, host_id, name, address, wifi_name, wifi_password from public.properties;
create view public.admin_profiles as select id, name, email, plan from public.profiles p;
create view public.expiring_plans as select id, name, email, plan, plan_expires_at from public.profiles where plan <> 'free';
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

create function public.admin_activate_plan(p_user_id uuid, p_plan text, p_months integer) returns void language plpgsql security definer as $$
begin update public.profiles set plan = p_plan, plan_activated_at = now(), plan_expires_at = now() + (p_months || ' months')::interval where id = p_user_id; end $$;
create function public.admin_activate_reseller(p_user_id uuid, p_credits integer, p_pack text) returns void language plpgsql security definer as $$ begin end $$;
create function public.admin_add_credits(p_user_id uuid, p_credits integer) returns void language plpgsql security definer as $$ begin end $$;
create function public.admin_expire_plan(p_user_id uuid) returns void language plpgsql security definer as $$ begin end $$;
create function public.admin_deactivate_reseller(p_user_id uuid) returns void language plpgsql security definer as $$ begin end $$;
create function public.invalidate_link(p_host_id uuid, p_new_link_id text) returns void language plpgsql security definer as $$ begin update public.profiles set link_id = p_new_link_id where id = p_host_id; end $$;
create function public.rotate_link_id(p_host_id uuid) returns text language plpgsql security definer as $$
declare v text := md5(random()::text); begin update public.profiles set link_id = v where id = p_host_id; return v; end $$;
create function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin return new; end $$;

insert into public.profiles (id, name, email, role, link_id, cin) values
  ('00000000-0000-0000-0000-00000000000a', 'Admin', 'admin@x', 'admin', 'linkadmin', 'A1'),
  ('00000000-0000-0000-0000-00000000000b', 'Host B', 'b@x', null, 'linkb', 'B1'),
  ('00000000-0000-0000-0000-00000000000c', 'Host C', 'c@x', null, 'linkc', 'C1');
insert into public.properties (host_id, name, wifi_password) values ('00000000-0000-0000-0000-00000000000b', 'Riad B', 'secretB');
