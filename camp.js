// Page « été » d'un camp : chiffres clés, répartition et calendrier du
// 1er juin au 30 septembre, pour chaque zone. Données : historique.json uniquement.
// Adresse : camp.html?camp=<id du camp>&annee=<AAAA, optionnel>&zone=<clé, optionnel>

const SAISON = { debut: '06-01', fin: '09-30' };
const JOURS_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Toutes les dates de la saison de l'année donnée, au format AAAA-MM-JJ
function datesSaison(annee) {
    const dates = [];
    for (let d = `${annee}-${SAISON.debut}`; d <= `${annee}-${SAISON.fin}`; d = getIsoDate(1, d)) {
        dates.push(d);
    }
    return dates;
}

// Catégorie d'affichage d'un jour : couleur + libellé de la règle, ou cas particuliers
function categorie(date, status, reglesDept, today) {
    const config = reglesDept?.[status];
    if (config) return { cle: `${config.color}|${config.label}`, color: config.color, label: config.label, detail: config.detail };
    if (date > today) return { cle: 'future', color: 'future', label: 'À venir', detail: '' };
    return { cle: 'unknown', color: 'unknown', label: 'Sans donnée', detail: '' };
}

const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Chiffres clés, barre de répartition et légende
function genererResume(jours) {
    const groupes = new Map();
    for (const { cat } of jours) {
        const g = groupes.get(cat.cle) ?? { ...cat, nb: 0 };
        g.nb++;
        groupes.set(cat.cle, g);
    }
    // Du plus permissif au plus restrictif, puis « sans donnée » et « à venir »
    const ordre = g => (g.cle === 'unknown' ? 98 : g.cle === 'future' ? 99 : Number(g.color));
    const liste = [...groupes.values()].sort((a, b) => ordre(a) - ordre(b));
    const connus = jours.filter(j => j.cat.cle !== 'unknown' && j.cat.cle !== 'future').length;

    const nbSelon = (test) => jours.filter(j => test(Number(j.cat.color))).length;
    const tuiles = [
        { nb: nbSelon(c => c >= 4), texte: 'interdit', classe: 'stat-4' },
        { nb: nbSelon(c => c === 3), texte: 'déconseillé', classe: 'stat-3' },
        { nb: nbSelon(c => c === 1 || c === 2), texte: 'autorisé', classe: 'stat-1' }
    ].map(t => `
        <div class="stat ${t.classe}">
            <span class="stat-nb">${t.nb}</span>
            <span class="stat-label">${t.nb > 1 ? `jours ${t.texte}s` : `jour ${t.texte}`}</span>
        </div>`).join('');

    const barre = liste.map(g =>
        `<span class="bar-part bar-${g.color}" style="flex-grow:${g.nb}" title="${escapeHtml(g.label)} : ${g.nb} j"></span>`
    ).join('');
    const legende = liste.map(g => `
        <li><span class="legend-dot cell-${g.color}"></span>${escapeHtml(g.label)} <strong>${g.nb} j</strong></li>`
    ).join('');

    return `
        <div class="stats">${tuiles}</div>
        <div class="season-bar" aria-hidden="true">${barre}</div>
        <ul class="legend">${legende}</ul>
        <p class="hint">${pluriel(connus, 'jour')} renseigné${connus > 1 ? 's' : ''} sur ${jours.length}. Touchez un jour pour voir la règle appliquée.</p>`;
}

function genererMois(jours, today) {
    const parMois = new Map();
    for (const jour of jours) {
        const mois = jour.date.slice(0, 7);
        if (!parMois.has(mois)) parMois.set(mois, []);
        parMois.get(mois).push(jour);
    }

    return [...parMois.entries()].map(([mois, joursMois]) => {
        // Décalage du premier jour (lundi = 0)
        const decalage = (new Date(`${mois}-01T12:00:00Z`).getUTCDay() + 6) % 7;
        const vides = '<span class="cell-empty"></span>'.repeat(decalage);
        const cases = joursMois.map(({ date, cat }) => {
            const libelle = `${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} : ${cat.label}`;
            return `<button type="button" class="cell cell-${cat.color}${date === today ? ' cell-today' : ''}"
                        data-date="${date}" aria-label="${escapeHtml(libelle)}" title="${escapeHtml(libelle)}">${Number(date.slice(8))}</button>`;
        }).join('');

        return `
            <div class="month">
                <h3 class="month-title">${formatDate(`${mois}-01`, { month: 'long' })}</h3>
                <div class="month-grid">
                    ${JOURS_SEMAINE.map(j => `<span class="weekday">${j}</span>`).join('')}
                    ${vides}${cases}
                </div>
            </div>`;
    }).join('');
}

function genererZone(zone, jours, today, avecTitre) {
    return `
        <section class="main-card zone-panel" id="zone-${escapeHtml(zone.cle)}" data-zone="${escapeHtml(zone.cle)}"
                 ${avecTitre ? '' : 'role="tabpanel"'}>
            ${avecTitre ? `<h2 class="card-title">${escapeHtml(zone.label)}</h2>` : ''}
            ${genererResume(jours)}
            <div class="months">${genererMois(jours, today)}</div>
            <p class="day-info-box" aria-live="polite" hidden></p>
        </section>`;
}

// Onglets quand le camp a plusieurs zones (ex. Sainte-Baume : 13 et 83)
function genererOnglets(zones, active) {
    if (zones.length < 2) return '';
    return `
        <div class="zone-tabs" role="tablist" aria-label="Zone">
            ${zones.map(z => `
                <button type="button" role="tab" class="zone-tab" data-zone="${escapeHtml(z.cle)}"
                        aria-controls="zone-${escapeHtml(z.cle)}" aria-selected="${z.cle === active}">${escapeHtml(z.label)}</button>`).join('')}
        </div>`;
}

function activerZone(container, cle) {
    container.querySelectorAll('.zone-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.zone === cle)));
    container.querySelectorAll('.zone-panel').forEach(p => { p.hidden = p.dataset.zone !== cle; });
}

async function init() {
    const container = document.getElementById('camp-container');
    const params = new URLSearchParams(window.location.search);

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

    const camp = camps.find(c => c.id === params.get('camp'));
    if (!camp) {
        container.innerHTML = '<p class="loading">Camp introuvable. <a href="./">Retour à l\'accueil</a></p>';
        return;
    }

    const today = getIsoDate(0);
    const historyByDate = new Map(history.map(item => [item.date, item]));

    // Années disponibles : celles qui ont des données, plus l'année en cours
    const annees = [...new Set([...history.map(i => i.date.slice(0, 4)), today.slice(0, 4)])].sort().reverse();
    const annee = annees.includes(params.get('annee')) ? params.get('annee') : today.slice(0, 4);

    const nomCamp = camp.titre.replace(/^\W+/u, '').trim();
    document.title = `${nomCamp} – Été ${annee}`;
    document.getElementById('camp-title').textContent = nomCamp;

    const select = document.getElementById('year-select');
    select.innerHTML = annees.map(a => `<option value="${a}"${a === annee ? ' selected' : ''}>Été ${a}</option>`).join('');
    select.disabled = annees.length < 2;
    select.addEventListener('change', () => {
        params.set('annee', select.value);
        window.location.search = params.toString();
    });

    const dates = datesSaison(annee);
    const joursParZone = new Map(camp.zones.map(zone => [zone.cle, dates.map(date => ({
        date,
        cat: categorie(date, historyByDate.get(date)?.[zone.cle], regles[zone.dept], today)
    }))]));

    const plusieurs = camp.zones.length > 1;
    const zoneActive = camp.zones.some(z => z.cle === params.get('zone')) ? params.get('zone') : camp.zones[0].cle;
    container.innerHTML = genererOnglets(camp.zones, zoneActive)
        + camp.zones.map(zone => genererZone(zone, joursParZone.get(zone.cle), today, !plusieurs)).join('');
    if (plusieurs) activerZone(container, zoneActive);

    container.addEventListener('click', (e) => {
        // Changement d'onglet (mémorisé dans l'adresse pour le partage)
        const onglet = e.target.closest('.zone-tab');
        if (onglet) {
            activerZone(container, onglet.dataset.zone);
            params.set('zone', onglet.dataset.zone);
            window.history.replaceState(null, '', `?${params}`);
            return;
        }

        // Toucher un jour affiche sa règle en bas de l'écran
        const cell = e.target.closest('.cell');
        if (!cell) return;
        const section = cell.closest('[data-zone]');
        const jour = joursParZone.get(section.dataset.zone).find(j => j.date === cell.dataset.date);
        section.querySelectorAll('.cell-selected').forEach(c => c.classList.remove('cell-selected'));
        cell.classList.add('cell-selected');
        const titre = formatDate(jour.date, { weekday: 'long', day: 'numeric', month: 'long' });
        const box = section.querySelector('.day-info-box');
        box.hidden = false;
        box.innerHTML = `<span class="legend-dot cell-${jour.cat.color}"></span>
            <span><strong>${titre} : ${escapeHtml(jour.cat.label)}</strong>${jour.cat.detail ? `<br>${escapeHtml(jour.cat.detail)}` : ''}</span>`;
    });
}

init();
