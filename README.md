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

## Automatisation
Le workflow GitHub Actions (`.github/workflows/history.yml`) tourne tous les jours à **17h05**. 
Il récupère les prévisions du lendemain sur le site officiel, met à jour `historique.json` et pousse le commit.

## Ajouter un camp
Modifier uniquement `camps.json` :
```json
{
  "id": "identifiant-unique",
  "titre": "🏕️ Nom du Camp (Massif)",
  "zones": [
    { "cle": "cleDansHistorique", "label": "Nom affiché", "dept": "34" }
  ]
}