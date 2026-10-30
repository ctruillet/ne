# Nature Environnement - Prévisions des Massifs

Application web statique pour suivre les restrictions d'accès aux massifs forestiers (risques d'incendie) pour les camps SGDF.

**Lien du site :** https://ctruillet.github.io/ne

## Structure
- `index.html` : Structure de la page (contenu est injecté par JS).
- `style.css` : Feuille de style.
- `app.js` : Charge les fichiers JSON et applique les styles.
- `camps.json` : Liste des camps et massifs à surveiller.
- `regles.json` : Légende, couleurs et textes réglementaires par département (13, 34, 83).
- `historique.json` : Base de données contenant les états des risques.
- `scripts/update-history.mjs` : Script appelé par le workflow pour enregistrer les prévisions du lendemain.

## Automatisation
Le workflow GitHub Actions (`.github/workflows/history.yml`) tourne tous les quarts d'heure entre 14h et 18h UTC.
Il récupère les prévisions du lendemain sur le site officiel pour toutes les zones de `camps.json`, met à jour `historique.json` et pousse le commit. Tant que la préfecture n'a pas tout publié, l'exécution se termine sans erreur et la suivante réessaie. Une fois les données complètes, les exécutions suivantes de la journée s'arrêtent tout de suite.

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

Si le site est hébergé avec Docker, désactiver le workflow GitHub Actions pour ne pas tenir deux historiques en parallèle.

Après une modification du site, de `camps.json` ou de `regles.json`, reconstruire avec `docker compose up -d --build`.
