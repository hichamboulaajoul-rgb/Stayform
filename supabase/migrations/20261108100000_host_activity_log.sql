-- Suivi de l'activité des hôtes (2026-11-08)
--
-- Enregistre, pour chaque hôte connecté au tableau de bord :
--   - 'login'     : une ouverture de session (connexion ou retour sur le site avec une session active,
--                   au plus une fois par onglet ouvert)
--   - 'page_view' : chaque section du tableau de bord visitée (Accueil, Logements, Voyageurs, ...)
--
-- Sécurité :
--   - personne ne peut écrire directement dans la table : les hôtes passent par log_activity(),
--     qui prend toujours l'identifiant de l'appelant (auth.uid()), donc impossible d'écrire au nom d'un autre ;
--   - seuls les admins (profiles.role = 'admin') peuvent lire la table ;
--   - les visiteurs anonymes (voyageurs du check-in) n'ont aucun accès.

begin;

create table if not exists public.host_activity (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  event      text not null check (event in ('login', 'page_view')),
  page       text check (char_length(page) <= 64),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists host_activity_created_at_idx on public.host_activity (created_at desc);
create index if not exists host_activity_user_idx on public.host_activity (user_id, created_at desc);

alter table public.host_activity enable row level security;

revoke all on public.host_activity from public, anon, authenticated;
grant select on public.host_activity to authenticated;

drop policy if exists host_activity_admin_select on public.host_activity;
create policy host_activity_admin_select on public.host_activity
  for select to authenticated using (public.is_admin());

-- Écriture : uniquement via cette fonction, pour l'utilisateur connecté.
create or replace function public.log_activity(p_event text, p_page text default null, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if p_event not in ('login', 'page_view') then
    raise exception 'invalid event' using errcode = '22023';
  end if;
  insert into public.host_activity (user_id, event, page, user_agent)
  values (auth.uid(), p_event, left(p_page, 64), left(p_user_agent, 300));
end; $$;

revoke all on function public.log_activity(text, text, text) from public, anon;
grant execute on function public.log_activity(text, text, text) to authenticated;

commit;
