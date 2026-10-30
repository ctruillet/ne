// Récupère les niveaux de risque du lendemain pour toutes les zones de camps.json
// et les enregistre dans historique.json. Si la préfecture n'a pas encore tout publié,
// le script s'arrête sans erreur : la prochaine exécution planifiée réessaiera.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const API_URL = 'https://www.risque-prevention-incendie.fr/static';
// Chemins modifiables par variables d'environnement (utilisé par l'image Docker)
const HISTORY_PATH = process.env.HISTORY_PATH ?? new URL('../historique.json', import.meta.url);
const CAMPS_PATH = process.env.CAMPS_PATH ?? new URL('../camps.json', import.meta.url);

function getParisDate(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    // Le format en-CA donne directement AAAA-MM-JJ
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

// La valeur d'un massif peut être un tableau [niveau, ...] ou directement le niveau
function extractStatus(data, idMassif) {
    const value = data?.massifs?.[idMassif];
    const status = Array.isArray(value) ? value[0] : value;
    return status == null ? null : String(status);
}

async function fetchDept(dept, dateStr) {
    try {
        const res = await fetch(`${API_URL}/${dept}/import_data/${dateStr}.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.log(`⚠️ Fichier du département ${dept} indisponible (${e.message}).`);
        return null;
    }
}

const dateKey = getParisDate(1);
const dateStr = dateKey.replaceAll('-', '');

const zones = JSON.parse(readFileSync(CAMPS_PATH, 'utf8')).flatMap(c => c.zones);
let history = existsSync(HISTORY_PATH) ? JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) : [];

const existant = history.find(item => item.date === dateKey);
if (existant && zones.every(z => existant[z.cle] && existant[z.cle] !== 'unknown')) {
    console.log(`✅ Données déjà complètes pour le ${dateKey}. Pas besoin de relancer.`);
    process.exit(0);
}

const depts = [...new Set(zones.map(z => z.dept))];
const dataByDept = Object.fromEntries(
    await Promise.all(depts.map(async dept => [dept, await fetchDept(dept, dateStr)]))
);

const entry = { date: dateKey };
const manquants = [];
for (const zone of zones) {
    const status = extractStatus(dataByDept[zone.dept], zone.id_massif);
    if (status === null) manquants.push(zone.cle);
    entry[zone.cle] = status ?? 'unknown';
}

if (manquants.length > 0) {
    console.log(`⏳ Pas encore publié, massifs manquants : ${manquants.join(', ')}. Nouvelle tentative plus tard.`);
    process.exit(0);
}

history = history.filter(item => item.date !== dateKey);
history.push(entry);
history.sort((a, b) => a.date.localeCompare(b.date));

writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
console.log(`✅ Historique mis à jour avec succès pour le ${dateKey}`);
