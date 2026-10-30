const API_URL = 'https://www.risque-prevention-incendie.fr/static';
const JOURS_HISTORIQUE = 7;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Date demandée via ?date=AAAA-MM-JJ, sinon null
function getQueryDate() {
    const date = new URLSearchParams(window.location.search).get('date');
    return date && DATE_REGEX.test(date) ? date : null;
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

function genererStructureCamp(camp, labels) {
    const rowsHtml = camp.zones.map(zone => {
        const cle = escapeHtml(zone.cle);
        return `
        <article id="row-${cle}" class="zone-row card-status-unknown">
            <div class="row-header">
                <div class="day-info">
                    <span class="day-label">${labels.jour}</span>
                    <span class="zone-tag">${escapeHtml(zone.label)}</span>
                </div>
                <span id="${cle}-today" class="badge-today-main">...</span>
            </div>
            <div class="tomorrow-line">
                <span class="tomorrow-label">${labels.lendemain}</span>
                <span id="${cle}-tomorrow" class="badge-tomorrow-sub text-status-unknown">...</span>
            </div>
            <button type="button" class="detail-toggle" aria-expanded="false" aria-controls="${cle}-detail">
                Détails et 7 derniers jours
            </button>
            <div id="${cle}-detail" class="zone-detail" hidden></div>
        </article>`;
    }).join('');

    return `
        <section class="main-card">
            <h2 class="card-title">${escapeHtml(camp.titre)}</h2>
            <div class="rows-container">${rowsHtml}</div>
            <a class="season-link" href="camp.html?camp=${encodeURIComponent(camp.id)}">Voir tout l'été →</a>
        </section>`;
}

function setTitle(el, config) {
    if (config) el.title = config.detail;
    else el.removeAttribute('title');
}

// La ligne prend la couleur du jour affiché, le lendemain n'est qu'un petit badge
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

// Panneau dépliable : texte réglementaire, source des données et tendance sur 7 jours
function genererDetail({ zone, labels, statusToday, statusTomorrow, sources, regles, tendance }) {
    const ligneDetail = (titre, status, source) => {
        const config = regles?.[status];
        const texte = config ? escapeHtml(config.detail) : 'Aucune donnée.';
        const origine = config ? `<span class="source">${source}</span>` : '';
        return `<p><strong>${titre} :</strong> ${texte} ${origine}</p>`;
    };

    const points = tendance.map(({ date, status }) => {
        const config = regles?.[status];
        const label = `${formatDate(date)} : ${config?.label ?? 'inconnu'}`;
        return `<li class="dot dot-${config?.color ?? 'unknown'}" title="${escapeHtml(label)}">
                    <span class="dot-day">${formatDate(date, { weekday: 'narrow' })}</span>
                    <span class="visually-hidden">${escapeHtml(label)}</span>
                </li>`;
    }).join('');

    return `
        ${ligneDetail(labels.jour, statusToday, sources.today[zone.cle])}
        ${ligneDetail(labels.lendemain, statusTomorrow, sources.tomorrow[zone.cle])}
        <p class="trend-title">${JOURS_HISTORIQUE} jours précédents</p>
        <ul class="trend">${points}</ul>`;
}

function brancherDetails(container) {
    container.addEventListener('click', (e) => {
        const bouton = e.target.closest('.detail-toggle');
        if (!bouton) return;
        const panneau = document.getElementById(bouton.getAttribute('aria-controls'));
        const ouvert = bouton.getAttribute('aria-expanded') === 'true';
        bouton.setAttribute('aria-expanded', String(!ouvert));
        panneau.hidden = ouvert;
    });
}

function afficherDepartements(zones) {
    const depts = [...new Set(zones.map(z => z.dept))].sort();
    const liste = depts.length > 1
        ? `${depts.slice(0, -1).join(', ')} et ${depts.at(-1)}`
        : depts.join('');
    document.getElementById('footer-depts').textContent =
        `Données issues des préfectures ${depts.length > 1 ? 'des départements' : 'du département'} ${liste}.`;
}

async function init() {
    const container = document.getElementById('dashboard-container');
    const statusLine = document.getElementById('status-line');

    const dateDemandee = getQueryDate();
    const todayKey = dateDemandee ?? getIsoDate(0);
    const tomorrowKey = getIsoDate(1, todayKey);
    const estAujourdhui = todayKey === getIsoDate(0);
    const labels = estAujourdhui
        ? { jour: "Aujourd'hui", lendemain: 'Demain' }
        : { jour: formatDate(todayKey), lendemain: formatDate(tomorrowKey) };

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
    const historyByDate = new Map(history.map(item => [item.date, item]));
    afficherDepartements(zones);
    container.innerHTML = camps.map(camp => genererStructureCamp(camp, labels)).join('');
    brancherDetails(container);

    // Statuts courants par clé de zone, initialisés depuis l'historique
    const statuts = {
        today: { ...historyByDate.get(todayKey) },
        tomorrow: { ...historyByDate.get(tomorrowKey) }
    };
    const sources = { today: {}, tomorrow: {} };
    for (const jour of ['today', 'tomorrow']) {
        for (const zone of zones) sources[jour][zone.cle] = '(historique)';
    }

    const datesTendance = Array.from({ length: JOURS_HISTORIQUE },
        (_, i) => getIsoDate(i - JOURS_HISTORIQUE, todayKey));

    const updateUI = () => zones.forEach(zone => {
        const statusToday = statuts.today[zone.cle];
        const statusTomorrow = statuts.tomorrow[zone.cle];
        appliquerStyleRow(zone.cle, statusToday, statusTomorrow, regles[zone.dept]);
        document.getElementById(`${zone.cle}-detail`).innerHTML = genererDetail({
            zone, labels, statusToday, statusTomorrow, sources,
            regles: regles[zone.dept],
            tendance: datesTendance.map(date => ({ date, status: historyByDate.get(date)?.[zone.cle] }))
        });
    });
    updateUI();

    // Pour une date passée, l'historique fait foi : pas d'appel au site officiel
    if (!estAujourdhui) {
        statusLine.textContent = `Données enregistrées pour le ${formatDate(todayKey, { day: 'numeric', month: 'long', year: 'numeric' })}`;
        return;
    }

    statusLine.textContent = 'Vérification des données en direct...';

    // Données en direct : complètent ou remplacent l'historique zone par zone
    const depts = [...new Set(zones.map(z => z.dept))];
    const [liveToday, liveTomorrow] = await Promise.all(
        [todayKey, tomorrowKey].map(async key => {
            const dateStr = key.replaceAll('-', '');
            const results = await Promise.all(depts.map(dept => fetchLiveData(dept, dateStr)));
            return Object.fromEntries(depts.map((dept, i) => [dept, results[i]]));
        })
    );

    let nbLive = 0;
    for (const zone of zones) {
        for (const [jour, live] of [['today', liveToday], ['tomorrow', liveTomorrow]]) {
            const status = extractStatus(live[zone.dept], zone.id_massif);
            if (status !== undefined) {
                statuts[jour][zone.cle] = status;
                sources[jour][zone.cle] = '(site officiel, en direct)';
                nbLive++;
            }
        }
    }
    if (nbLive > 0) updateUI();

    const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date());
    statusLine.textContent = nbLive > 0
        ? `Mis à jour à ${heure} depuis le site officiel`
        : `Site officiel injoignable : données enregistrées (vérifié à ${heure})`;
}

init();
