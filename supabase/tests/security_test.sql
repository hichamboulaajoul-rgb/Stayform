-- Run after prod_baseline.sql + migrations. Each block raises if an expectation fails.
\set ON_ERROR_STOP on
create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then raise notice 'ok (blocked): %', label; return; end;
  raise exception 'FAIL, should have been blocked: %', label;
end $$;
create or replace function pg_temp.expect_ok(sql text, label text) returns void language plpgsql as $$
begin execute sql; raise notice 'ok (allowed): %', label; end $$;

-- anonymous visitor
set role anon; select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_fail($$select public.admin_activate_plan('00000000-0000-0000-0000-00000000000b','paid',12)$$, 'anon admin_activate_plan');
select pg_temp.expect_fail($$select public.invalidate_link('00000000-0000-0000-0000-00000000000b','x')$$, 'anon invalidate_link');
select pg_temp.expect_fail($$update public.profiles_public set cin='hacked'$$, 'anon update profiles_public');
select pg_temp.expect_fail($$update public.properties_public set wifi_password='hacked'$$, 'anon update properties_public');
select pg_temp.expect_fail($$select * from public.admin_profiles$$, 'anon read admin_profiles');
select pg_temp.expect_fail($$select * from public.expiring_plans$$, 'anon read expiring_plans');
do $$ begin if (select count(*) from public.profiles) <> 0 then raise exception 'FAIL anon can read profiles'; end if;
             if (select count(*) from public.properties) <> 0 then raise exception 'FAIL anon can read properties'; end if;
             raise notice 'ok: anon sees no profiles/properties rows'; end $$;
-- guest check-in flow still works
do $$ begin if (select count(*) from public.profiles_public where link_id='linkb') <> 1 then raise exception 'FAIL profiles_public'; end if;
             if (select count(*) from public.properties_public where host_id='00000000-0000-0000-0000-00000000000b') <> 1 then raise exception 'FAIL properties_public'; end if;
             raise notice 'ok: guest flow reads public views'; end $$;
select pg_temp.expect_ok($$select public.rotate_link_id('00000000-0000-0000-0000-00000000000c')$$, 'anon rotate_link_id (guest flow)');
reset role;

-- regular host B
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.expect_fail($$select public.admin_activate_plan('00000000-0000-0000-0000-00000000000b','paid',12)$$, 'host admin_activate_plan');
select pg_temp.expect_fail($$update public.profiles set plan='paid' where id=auth.uid()$$, 'host self-upgrade plan');
select pg_temp.expect_fail($$update public.profiles set role='admin' where id=auth.uid()$$, 'host self-promote admin');
select pg_temp.expect_fail($$update public.profiles set reseller_credits=999 where id=auth.uid()$$, 'host self-add credits');
select pg_temp.expect_ok($$update public.profiles set name='B2', phone='0600', cin='B9', guest_count=3, link_id='newb' where id=auth.uid()$$, 'host edits own name/phone/cin/guest_count/link');
do $$ begin if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL host sees other profiles'; end if;
             if (select count(*) from public.admin_profiles) <> 1 then raise exception 'FAIL host sees admin_profiles of others'; end if;
             raise notice 'ok: host only sees own profile'; end $$;
reset role;

-- admin
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_ok($$select public.admin_activate_plan('00000000-0000-0000-0000-00000000000b','pro',12)$$, 'admin activates plan');
do $$ begin if (select plan from public.profiles where id='00000000-0000-0000-0000-00000000000b') <> 'pro' then raise exception 'FAIL admin plan not applied'; end if;
             if (select count(*) from public.profiles) <> 3 then raise exception 'FAIL admin cannot list all profiles'; end if;
             if (select count(*) from public.admin_profiles) <> 3 then raise exception 'FAIL admin cannot read admin_profiles'; end if;
             perform * from public.expiring_plans;
             raise notice 'ok: admin sees all users and can activate plans'; end $$;
reset role;

-- service role (webhooks / edge functions) is unaffected
set role service_role;
select pg_temp.expect_ok($$update public.profiles set plan='paid' where id='00000000-0000-0000-0000-00000000000c'$$, 'service_role sets plan');
reset role;
-- host activity log (20261108100000_host_activity_log.sql)
set role anon; select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_fail($$select public.log_activity('login')$$, 'anon log_activity');
select pg_temp.expect_fail($$select * from public.host_activity$$, 'anon read host_activity');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.expect_ok($$select public.log_activity('login', null, 'test-agent')$$, 'host logs a login');
select pg_temp.expect_ok($$select public.log_activity('page_view', 'guests')$$, 'host logs a page view');
select pg_temp.expect_fail($$select public.log_activity('hack', 'x')$$, 'host logs an unknown event');
select pg_temp.expect_fail($$insert into public.host_activity (user_id, event) values ('00000000-0000-0000-0000-00000000000c', 'login')$$, 'host inserts activity for someone else');
select pg_temp.expect_fail($$delete from public.host_activity$$, 'host deletes activity');
do $$ begin if (select count(*) from public.host_activity) <> 0 then raise exception 'FAIL host can read activity log'; end if;
             raise notice 'ok: host cannot read the activity log'; end $$;
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin if (select count(*) from public.host_activity where user_id = '00000000-0000-0000-0000-00000000000b') <> 2 then raise exception 'FAIL admin cannot read activity log'; end if;
             raise notice 'ok: admin reads the activity log'; end $$;
reset role;
\echo ALL SECURITY TESTS PASSED
