// Récupère les niveaux de risque du lendemain pour toutes les zones de camps.json
// et les enregistre dans historique.json.
//
// Le script ne fait rien hors de la saison (lendemain entre le 1er juin et le
// 30 septembre) ni hors du créneau horaire (à partir de 17h, heure de Paris).
// Pendant le créneau, il interroge le site à chaque exécution, même si les
// données sont déjà connues, car les préfectures publient parfois des
// mises à jour dans la soirée. Le fichier n'est réécrit qu'en cas de changement.
//
// Variables d'environnement :
//   HISTORY_PATH, CAMPS_PATH : chemins des fichiers (défaut : racine du dépôt)
//   SEASON      : saison au format MM-JJ:MM-JJ (défaut 06-01:09-30)
//   START_HOUR  : heure de Paris à partir de laquelle interroger (défaut 17)
//   FORCE=1     : ignore la saison et l'horaire (lancement manuel)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const API_URL = 'https://www.risque-prevention-incendie.fr/static';
const HISTORY_PATH = process.env.HISTORY_PATH ?? new URL('../historique.json', import.meta.url);
const CAMPS_PATH = process.env.CAMPS_PATH ?? new URL('../camps.json', import.meta.url);
const [SEASON_START, SEASON_END] = (process.env.SEASON ?? '06-01:09-30').split(':');
const START_HOUR = Number(process.env.START_HOUR ?? 17);
const FORCE = process.env.FORCE === '1';

function getParisDate(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    // Le format en-CA donne directement AAAA-MM-JJ
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

function getParisHour() {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Paris' }).formatToParts(new Date());
    return Number(parts.find(p => p.type === 'hour').value);
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
const jourMois = dateKey.slice(5);

if (!FORCE) {
    if (jourMois < SEASON_START || jourMois > SEASON_END) {
        console.log(`💤 Hors saison (${SEASON_START} → ${SEASON_END}) pour le ${dateKey}, rien à faire.`);
        process.exit(0);
    }
    if (getParisHour() < START_HOUR) {
        console.log(`💤 Avant ${START_HOUR}h (heure de Paris), rien à faire.`);
        process.exit(0);
    }
}

const zones = JSON.parse(readFileSync(CAMPS_PATH, 'utf8')).flatMap(c => c.zones);
const history = existsSync(HISTORY_PATH) ? JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) : [];
const existant = history.find(item => item.date === dateKey);

const depts = [...new Set(zones.map(z => z.dept))];
const dataByDept = Object.fromEntries(
    await Promise.all(depts.map(async dept => [dept, await fetchDept(dept, dateStr)]))
);

// Nouvelle valeur si publiée, sinon on garde la valeur déjà enregistrée
const entry = { date: dateKey };
const manquants = [];
const changements = [];
for (const zone of zones) {
    const ancien = existant?.[zone.cle] ?? 'unknown';
    const nouveau = extractStatus(dataByDept[zone.dept], zone.id_massif);
    if (nouveau === null) manquants.push(zone.cle);
    entry[zone.cle] = nouveau ?? ancien;
    if (entry[zone.cle] !== ancien) changements.push(`${zone.cle} ${ancien} → ${entry[zone.cle]}`);
}

if (manquants.length > 0) {
    console.log(`⏳ Pas encore publié pour le ${dateKey} : ${manquants.join(', ')}.`);
}

if (changements.length === 0) {
    console.log(`✅ Aucun changement pour le ${dateKey}.`);
    process.exit(0);
}

const nouvelHistorique = history.filter(item => item.date !== dateKey);
nouvelHistorique.push(entry);
nouvelHistorique.sort((a, b) => a.date.localeCompare(b.date));

writeFileSync(HISTORY_PATH, JSON.stringify(nouvelHistorique, null, 2));
console.log(`✅ Historique mis à jour pour le ${dateKey} : ${changements.join(', ')}`);
