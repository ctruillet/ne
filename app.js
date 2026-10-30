const API_URL = 'https://www.risque-prevention-incendie.fr/static';

// Date du jour (+ offset) au format AAAA-MM-JJ, à l'heure de Paris
function getIsoDate(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
    return response.json();
}

async function fetchLiveData(dept, dateStr) {
    try {
        return await fetchJson(`${API_URL}/${dept}/import_data/${dateStr}.json`);
    } catch {
        return null;
    }
}

// La valeur d'un massif peut être un tableau [niveau, ...] ou directement le niveau
function extractStatus(data, idMassif) {
    const value = data?.massifs?.[idMassif];
    const status = Array.isArray(value) ? value[0] : value;
    return status == null ? undefined : String(status);
}

// Aujourd'hui en haut (carte principale), Demain en bas
function genererStructureCamp(camp) {
    const rowsHtml = camp.zones.map(zone => `
        <article id="row-${zone.cle}" class="zone-row card-status-unknown">
            <div class="row-header">
                <div class="day-info">
                    <span class="day-label">Aujourd'hui</span>
                    <span class="zone-tag">${zone.label}</span>
                </div>
                <span id="${zone.cle}-today" class="badge-today-main">...</span>
            </div>
            <div class="tomorrow-line">
                <span class="tomorrow-label">Demain</span>
                <span id="${zone.cle}-tomorrow" class="badge-tomorrow-sub text-status-unknown">...</span>
            </div>
        </article>
    `).join('');

    return `
        <section class="main-card">
            <h2 class="card-title">${camp.titre}</h2>
            <div class="rows-container">${rowsHtml}</div>
        </section>
    `;
}

function setTitle(el, config) {
    if (config) el.title = config.detail;
    else el.removeAttribute('title');
}

// La ligne prend la couleur d'Aujourd'hui, Demain n'est qu'un petit badge
function appliquerStyleRow(cle, statusToday, statusTomorrow, reglesDepartement) {
    const row = document.getElementById(`row-${cle}`);
    const txtToday = document.getElementById(`${cle}-today`);
    const txtTomorrow = document.getElementById(`${cle}-tomorrow`);

    const configToday = reglesDepartement?.[statusToday];
    const configTomorrow = reglesDepartement?.[statusTomorrow];

    if (row && txtToday) {
        row.className = `zone-row card-status-${configToday?.color ?? 'unknown'}`;
        txtToday.textContent = configToday?.label ?? 'Non disponible';
        setTitle(row, configToday);
        setTitle(txtToday, configToday);
    }
    if (txtTomorrow) {
        txtTomorrow.className = `badge-tomorrow-sub text-status-${configTomorrow?.color ?? 'unknown'}`;
        txtTomorrow.textContent = configTomorrow?.label ?? 'Non publié';
        setTitle(txtTomorrow, configTomorrow);
    }
}

async function init() {
    const container = document.getElementById('dashboard-container');
    const todayKey = getIsoDate(0);
    const tomorrowKey = getIsoDate(1);

    let camps, regles, history;
    try {
        [camps, regles, history] = await Promise.all([
            fetchJson('./camps.json'),
            fetchJson('./regles.json'),
            fetchJson('./historique.json')
        ]);
    } catch (e) {
        console.error("Erreur d'initialisation :", e);
        container.innerHTML = '<p class="loading">Impossible de charger les données. Réessayez plus tard.</p>';
        return;
    }

    const zones = camps.flatMap(c => c.zones);
    container.innerHTML = camps.map(genererStructureCamp).join('');

    // Statuts courants par clé de zone, initialisés depuis l'historique
    const statuts = {
        today: { ...history.find(i => i.date === todayKey) },
        tomorrow: { ...history.find(i => i.date === tomorrowKey) }
    };

    const updateUI = () => zones.forEach(zone =>
        appliquerStyleRow(zone.cle, statuts.today[zone.cle], statuts.tomorrow[zone.cle], regles[zone.dept])
    );
    updateUI();

    // Données en direct : complètent ou remplacent l'historique zone par zone
    const depts = [...new Set(zones.map(z => z.dept))];
    const [liveToday, liveTomorrow] = await Promise.all(
        [todayKey, tomorrowKey].map(key => {
            const dateStr = key.replaceAll('-', '');
            return Promise.all(depts.map(dept => fetchLiveData(dept, dateStr)))
                .then(results => Object.fromEntries(depts.map((dept, i) => [dept, results[i]])));
        })
    );

    let changed = false;
    for (const zone of zones) {
        for (const [jour, live] of [['today', liveToday], ['tomorrow', liveTomorrow]]) {
            const status = extractStatus(live[zone.dept], zone.id_massif);
            if (status !== undefined) {
                statuts[jour][zone.cle] = status;
                changed = true;
            }
        }
    }
    if (changed) updateUI();
}

init();
