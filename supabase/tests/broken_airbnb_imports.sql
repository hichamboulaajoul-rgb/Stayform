-- Logements enregistrés avec le titre de la page de redirection Airbnb au lieu du vrai nom.
-- Lecture seule : à lancer dans le SQL Editor pour voir qui est concerné.
select p.id, p.created_at::date, p.name, p.address, p.airbnb_url, pr.email
from properties p
left join profiles pr on pr.id = p.host_id
where p.name ~* '^(redirection vers|redirecting to)'
order by p.created_at desc;
