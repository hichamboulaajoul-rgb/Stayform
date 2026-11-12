-- Onglet « Propriétés » de l'admin (2026-11-12)
--
-- Les admins (profiles.role = 'admin') peuvent lire toutes les propriétés, avec leur hôte
-- et leur lien Airbnb. Les hôtes continuent de ne voir que leurs propres logements,
-- et les visiteurs anonymes n'ont toujours aucun accès direct à la table.

begin;

drop policy if exists properties_admin_select_all on public.properties;
create policy properties_admin_select_all on public.properties
  for select to authenticated using (public.is_admin());

commit;
