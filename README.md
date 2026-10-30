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

## Automatisation
Le workflow GitHub Actions (`.github/workflows/history.yml`) lance `scripts/update-history.mjs` toutes les 15 minutes en soirée.
Le script ne fait rien hors saison (du **1er juin au 30 septembre**) ni avant **17h** (heure de Paris). Pendant ce créneau, il récupère les prévisions du lendemain pour toutes les zones de `camps.json` et met à jour `historique.json` dès qu'une valeur change, y compris pour les mises à jour publiées dans la soirée par les préfectures, jusqu'à minuit.

Un lancement manuel du workflow (« Run workflow ») ignore la saison et l'horaire.

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