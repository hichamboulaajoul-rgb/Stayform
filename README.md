# Stayform

**Votre accueil, zéro papier.** — [stayform.link](https://stayform.link)

Stayform est une application de check-in en ligne pour les hôtes de location courte durée au Maroc.
L'hôte envoie un lien à son voyageur, qui choisit ses dates, scanne sa pièce d'identité, signe le
contrat de location en ligne et reçoit un dossier PDF complet.

## Pages

| Fichier | Rôle |
| --- | --- |
| `index.html` | Site public + tableau de bord de l'hôte (logements, voyageurs, fiche de police, abonnement) |
| `checkin.html` | Parcours de check-in du voyageur (dates, identité, signature, PDF) |
| `welcome.html` | Page d'accueil envoyée au voyageur après le check-in |
| `pricing.html` | Tarifs |
| `admin.html` | Panneau d'administration (plans, crédits revendeurs) |

## Stack

- HTML, CSS et JavaScript sans étape de build, déployés par Netlify (le fichier `CNAME` est un reste de GitHub Pages)
- [Supabase](https://supabase.com) : base Postgres, authentification et Edge Functions
  (`verify-identity`, `send-checkin-email`, `scrape-airbnb`, `fetch-ical`, `send-upgrade-nudge`)
- jsPDF pour le dossier PDF, Chart.js pour le tableau de bord

La clé Supabase présente dans les pages est la clé publique `anon` : elle est faite pour être
dans le navigateur. La sécurité repose sur les règles RLS et les droits définis dans
`supabase/migrations/`.

## Base de données

Les changements de schéma et de sécurité sont dans `supabase/migrations/`. Ils ne sont pas
appliqués automatiquement : appliquez-les depuis le SQL Editor de Supabase ou avec
`supabase db push`.

`supabase/tests/` contient une copie minimale du schéma de production et des tests qui
vérifient qui peut lire et modifier quoi (visiteur anonyme, hôte, admin).

## Tests

```bash
npm install
npx playwright install chromium
npm test
```

Les tests ouvrent chaque page dans Chromium (desktop et mobile) et vérifient qu'elle s'affiche
sans erreur JavaScript. Les appels à Supabase sont simulés : les tests ne touchent jamais la
base de production. GitHub Actions lance ces tests et les tests de base de données à chaque
pull request.

## Déploiement

Netlify publie `main` et crée un aperçu pour chaque pull request.
