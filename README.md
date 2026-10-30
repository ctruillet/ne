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
- `scripts/notify.mjs` : Envoi des alertes ntfy.

## Automatisation
Le workflow GitHub Actions (`.github/workflows/history.yml`) lance `scripts/update-history.mjs` toutes les 15 minutes en soirée.
Le script ne fait rien hors saison (du **1er juin au 30 septembre**) ni avant **17h** (heure de Paris). Pendant ce créneau, il récupère les prévisions du lendemain pour toutes les zones de `camps.json` et met à jour `historique.json` dès qu'une valeur change, y compris pour les mises à jour publiées dans la soirée par les préfectures, jusqu'à minuit.

Un lancement manuel du workflow (« Run workflow ») ignore la saison et l'horaire.

## Alertes sur téléphone
Quand la prévision de demain d'un camp devient restrictive (**déconseillé** ou **interdit**), une alerte est envoyée sur téléphone via [ntfy](https://ntfy.sh), une application gratuite et sans compte. Une alerte part aussi quand l'accès redevient autorisé après une restriction, ou quand une préfecture révise sa prévision dans la soirée. Toucher l'alerte ouvre la page « été » du camp.

Mise en place :
1. Choisir un nom de sujet difficile à deviner, par exemple `ne-massifs-8f3k2q`. Toute personne qui le connaît peut lire les alertes.
2. Installer l'application ntfy (Android ou iPhone) et s'abonner à ce sujet. Chaque chef peut s'y abonner.
3. Dans le dépôt GitHub : *Settings → Secrets and variables → Actions → New repository secret*, nom `NTFY_TOPIC`, valeur : le nom du sujet.

Réglages facultatifs (*variables* GitHub ou variables d'environnement Docker) :
- `ALERT_MIN_COLOR` : niveau à partir duquel alerter, `3` = déconseillé (défaut), `4` = interdit seulement.
- `NTFY_SERVER` : serveur ntfy auto-hébergé, et `NTFY_TOKEN` (secret) si le sujet est protégé.
- `SITE_URL` : adresse du site ouverte par l'alerte (défaut : GitHub Pages).

Pour voir les alertes sans les envoyer : `NTFY_DRY_RUN=1 FORCE=1 node scripts/update-history.mjs`.

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

Pour les alertes, définir `NTFY_TOPIC` (et éventuellement `SITE_URL`) dans un fichier `.env` à côté de `docker-compose.yml`.

Si le site est hébergé avec Docker, désactiver le workflow GitHub Actions pour ne pas tenir deux historiques en parallèle.

Après une modification du site, de `camps.json` ou de `regles.json`, reconstruire avec `docker compose up -d --build`.
