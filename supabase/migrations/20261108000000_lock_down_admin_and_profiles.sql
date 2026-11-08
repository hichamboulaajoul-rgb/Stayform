-- Stayform security fixes (2026-11-08)
--
-- Problems this fixes, all reachable with the public anon key shipped in the HTML:
--   1. admin_* RPCs had no admin check: anyone could give any account a paid plan or credits.
--   2. Signed-in hosts could update their own profiles.role / plan / reseller_* columns,
--      e.g. set role = 'admin' or plan = 'paid' for free.
--   3. profiles was readable by everyone (email, phone, CIN, role, plan of every host).
--   4. properties was readable by everyone (wifi passwords, iCal URLs of every host).
--   5. admin_profiles and expiring_plans views (SECURITY DEFINER) exposed all host emails to anon.
--   6. profiles_public / properties_public are auto-updatable SECURITY DEFINER views, so anon
--      could UPDATE any host's name, phone, CIN, link or wifi password through them.
--   7. invalidate_link / handle_new_user were callable over the REST API.
--
-- Guest check-in keeps working: it reads profiles_public / properties_public and calls
-- insert_guest, is_plan_active, get_host_email, rotate_link_id, increment_guest_count and
-- consume_reseller_credit, none of which change here.

begin;

-- 1. Admin helper ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- 2. Admin RPCs: require an admin caller -----------------------------------------
create or replace function public.admin_activate_plan(p_user_id uuid, p_plan text, p_months integer default 12)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.profiles set
    plan = p_plan,
    plan_activated_at = now(),
    plan_expires_at = now() + (p_months || ' months')::interval
  where id = p_user_id;
end; $$;

create or replace function public.admin_activate_reseller(p_user_id uuid, p_credits integer, p_pack text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.profiles set
    reseller_active = true,
    reseller_credits = reseller_credits + p_credits,
    reseller_pack = p_pack,
    reseller_activated_at = now()
  where id = p_user_id;
end; $$;

create or replace function public.admin_add_credits(p_user_id uuid, p_credits integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.profiles set reseller_credits = reseller_credits + p_credits where id = p_user_id;
end; $$;

create or replace function public.admin_expire_plan(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.profiles set plan = 'free', plan_expires_at = null where id = p_user_id;
end; $$;

create or replace function public.admin_deactivate_reseller(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.profiles set reseller_active = false, reseller_credits = 0 where id = p_user_id;
end; $$;

revoke all on function public.admin_activate_plan(uuid, text, integer)      from public, anon;
revoke all on function public.admin_activate_reseller(uuid, integer, text)  from public, anon;
revoke all on function public.admin_add_credits(uuid, integer)              from public, anon;
revoke all on function public.admin_expire_plan(uuid)                       from public, anon;
revoke all on function public.admin_deactivate_reseller(uuid)               from public, anon;
grant execute on function public.admin_activate_plan(uuid, text, integer)     to authenticated;
grant execute on function public.admin_activate_reseller(uuid, integer, text) to authenticated;
grant execute on function public.admin_add_credits(uuid, integer)             to authenticated;
grant execute on function public.admin_expire_plan(uuid)                      to authenticated;
grant execute on function public.admin_deactivate_reseller(uuid)              to authenticated;

-- 3. Hosts can no longer change billing / role columns on their own profile -------
-- Only applies to direct API calls (roles anon / authenticated). SECURITY DEFINER
-- functions run as their owner and the service role is not affected.
-- SECURITY INVOKER on purpose: current_user must be the API role, not the owner.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := null;
    new.plan := 'free';
    new.plan_expires_at := null;
    new.plan_activated_at := null;
    new.plan_interval := null;
    new.reseller_active := false;
    new.reseller_credits := 0;
    new.reseller_pack := null;
    new.reseller_activated_at := null;
    return new;
  end if;

  if new.id                    is distinct from old.id
  or new.email                 is distinct from old.email
  or new.role                  is distinct from old.role
  or new.plan                  is distinct from old.plan
  or new.plan_expires_at       is distinct from old.plan_expires_at
  or new.plan_activated_at     is distinct from old.plan_activated_at
  or new.plan_interval         is distinct from old.plan_interval
  or new.reseller_active       is distinct from old.reseller_active
  or new.reseller_credits      is distinct from old.reseller_credits
  or new.reseller_pack         is distinct from old.reseller_pack
  or new.reseller_activated_at is distinct from old.reseller_activated_at
  or new.reseller_used_month   is distinct from old.reseller_used_month
  or new.reseller_used_total   is distinct from old.reseller_used_total
  then
    raise exception 'these profile fields can only be changed by an admin' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke all on function public.protect_profile_columns() from public, anon, authenticated;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_columns();

-- 4. Stop exposing every host's profile and property to the world -----------------
-- Guests read hosts through profiles_public and properties_public instead.
drop policy if exists profiles_read_by_link_id on public.profiles;
drop policy if exists properties_select_anon on public.properties;

drop policy if exists profiles_admin_select_all on public.profiles;
create policy profiles_admin_select_all on public.profiles
  for select to authenticated using (public.is_admin());

-- 5. Admin-only views: respect RLS of the caller, hide from anon -------------------
alter view public.admin_profiles set (security_invoker = true);
alter view public.expiring_plans set (security_invoker = true);
revoke all on public.admin_profiles from anon;
revoke all on public.expiring_plans from anon;
revoke insert, update, delete, truncate on public.admin_profiles from authenticated;
revoke insert, update, delete, truncate on public.expiring_plans from authenticated;

-- 6. Public views are read-only ----------------------------------------------------
revoke insert, update, delete, truncate on public.profiles_public   from anon, authenticated;
revoke insert, update, delete, truncate on public.properties_public from anon, authenticated;

-- 7. Functions that should never be called over the REST API ---------------------
revoke all on function public.invalidate_link(uuid, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;
