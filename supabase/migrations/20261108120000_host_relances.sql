-- Relance par e-mail des hôtes inscrits sans contrat (2026-11-08)
--
--   host_emails  : journal de chaque e-mail envoyé par la fonction relance-hotes
--                  (évite d'écrire deux fois au même hôte, visible dans l'admin)
--   email_optout : hôtes qui ont cliqué sur « Se désinscrire » ; ils ne reçoivent plus de relance
--
-- Sécurité : seule la fonction relance-hotes (clé service_role) écrit dans ces tables.
-- Les admins peuvent les lire ; les hôtes et les visiteurs anonymes n'y ont pas accès.

begin;

create table if not exists public.host_emails (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  email      text not null,
  kind       text not null default 'relance_sans_contrat' check (char_length(kind) <= 64),
  resend_id  text,
  error      text,
  sent_by    uuid,
  created_at timestamptz not null default now()
);
create index if not exists host_emails_user_idx on public.host_emails (user_id, created_at desc);

create table if not exists public.email_optout (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.host_emails  enable row level security;
alter table public.email_optout enable row level security;

revoke all on public.host_emails  from public, anon, authenticated;
revoke all on public.email_optout from public, anon, authenticated;
grant select on public.host_emails  to authenticated;
grant select on public.email_optout to authenticated;

drop policy if exists host_emails_admin_select on public.host_emails;
create policy host_emails_admin_select on public.host_emails
  for select to authenticated using (public.is_admin());

drop policy if exists email_optout_admin_select on public.email_optout;
create policy email_optout_admin_select on public.email_optout
  for select to authenticated using (public.is_admin());

commit;
