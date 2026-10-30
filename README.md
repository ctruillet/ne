# Nature Environnement - Prévisions des Massifs

Application web statique pour suivre les restrictions d'accès aux massifs forestiers (risques d'incendie) pour les camps SGDF.

**Lien du site :** https://ctruillet.github.io/ne

## Structure
- `index.html` : Structure de la page (contenu est injecté par JS).
- `style.css` : Feuille de style.
- `app.js` : Charge les fichiers JSON et applique les styles.
- `camp.html` / `camp.js` : Page « été » d'un camp (calendrier du 1er juin au 30 septembre et nombre de jours par niveau), accessible par le lien « Voir tout l'été » de chaque camp.
- `common.js` : Fonctions partagées entre les deux pages.
- `camps.json` : Liste des camps et massifs à surveiller.
- `regles.json` : Légende, couleurs et textes réglementaires par département (13, 34, 83).
- `historique.json` : Base de données contenant les états des risques.
- `scripts/update-history.mjs` : Script appelé par le workflow pour enregistrer les prévisions du lendemain.
- `scripts/notify.mjs` / `scripts/smtp.mjs` : Envoi des alertes par e-mail (sans dépendance externe).

## Automatisation
Le workflow GitHub Actions (`.github/workflows/history.yml`) lance `scripts/update-history.mjs` toutes les 15 minutes en soirée.
Le script ne fait rien hors saison (du **1er juin au 30 septembre**) ni avant **17h** (heure de Paris). Pendant ce créneau, il récupère les prévisions du lendemain pour toutes les zones de `camps.json` et met à jour `historique.json` dès qu'une valeur change, y compris pour les mises à jour publiées dans la soirée par les préfectures, jusqu'à minuit.

Un lancement manuel du workflow (« Run workflow ») ignore la saison et l'horaire.

## Alertes par e-mail
Quand la prévision de demain d'un camp devient restrictive (**déconseillé** ou **interdit**), un e-mail est envoyé aux chefs. Aucune application à installer. Un e-mail part aussi quand l'accès redevient autorisé après une restriction, ou quand une préfecture révise sa prévision dans la soirée. Toutes les alertes d'une mise à jour sont regroupées dans un seul e-mail, avec un lien vers la page « été » de chaque camp concerné.

Mise en place, une seule fois (exemple avec Gmail) :
1. Sur le compte Gmail qui enverra les alertes, activer la validation en deux étapes, puis créer un *mot de passe d'application* : https://myaccount.google.com/apppasswords
2. Dans le dépôt GitHub : *Settings → Secrets and variables → Actions → New repository secret*, créer :
   - `SMTP_HOST` : `smtp.gmail.com`
   - `SMTP_USER` : l'adresse Gmail
   - `SMTP_PASS` : le mot de passe d'application (16 lettres)
   - `MAIL_TO` : les adresses des chefs, séparées par des virgules (elles sont mises en copie cachée)

Tout autre fournisseur avec SMTP sécurisé (port 465) fonctionne aussi : Outlook (`smtp-mail.outlook.com`), OVH (`ssl0.ovh.net`), etc.

Réglages facultatifs (*variables* GitHub ou variables d'environnement Docker) :
- `ALERT_MIN_COLOR` : niveau à partir duquel alerter, `3` = déconseillé (défaut), `4` = interdit seulement.
- `SMTP_PORT` : port TLS (défaut `465`). `MAIL_FROM` : expéditeur affiché, par ex. `Alertes massifs <adresse@gmail.com>`.
- `SITE_URL` : adresse du site dans les liens (défaut : GitHub Pages).

Pour voir l'e-mail sans l'envoyer : `MAIL_DRY_RUN=1 FORCE=1 node scripts/update-history.mjs`.

## Consulter une date passée
Ajouter `?date=AAAA-MM-JJ` à l'adresse, par exemple https://ctruillet.github.io/ne/?date=2026-07-14 (données de l'historique uniquement).

## Ajouter un camp
Modifier uniquement `camps.json` (le workflow et le site s'adaptent automatiquement) :
```json
{
  "id": "identifiant-unique",
  "titre": "🏕️ Nom du Camp (Massif)",
  "zones": [
    { "cle": "cleDansHistorique", "label": "Nom affiché", "dept": "34", "id_massif": "344" }
  ]
}
```

## Docker
Le site peut aussi être hébergé hors de GitHub Pages avec Docker :
```bash
docker compose up -d --build
```
Le site est alors disponible sur http://localhost:8080 (port modifiable avec `PORT=80 docker compose up -d`).

Deux services sont lancés :
- `web` : nginx qui sert le site.
- `updater` : remplace le workflow GitHub Actions. Il lance `scripts/update-history.mjs` toutes les `UPDATE_INTERVAL_MINUTES` minutes (défaut `15`).

`historique.json` est stocké dans le volume `data`, partagé entre les deux services. Au premier lancement, il est initialisé avec le fichier du dépôt.

Pour les alertes, définir `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` et `MAIL_TO` (et éventuellement `SITE_URL`) dans un fichier `.env` à côté de `docker-compose.yml`.

Si le site est hébergé avec Docker, désactiver le workflow GitHub Actions pour ne pas tenir deux historiques en parallèle.

Après une modification du site, de `camps.json` ou de `regles.json`, reconstruire avec `docker compose up -d --build`.
