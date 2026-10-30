// Page « été » d'un camp : calendrier du 1er juin au 30 septembre et décompte
// des jours par niveau, pour chaque zone. Données : historique.json uniquement.
// Adresse : camp.html?camp=<id du camp>&annee=<AAAA, optionnel>

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
    const total = jours.length;

    const barre = liste.map(g =>
        `<span class="bar-part cell-${g.color}" style="flex-grow:${g.nb}" title="${escapeHtml(g.label)} : ${g.nb} j"></span>`
    ).join('');
    const legende = liste.map(g => `
        <li><span class="legend-dot cell-${g.color}"></span>${escapeHtml(g.label)}
            <strong>${g.nb} j</strong> <span class="muted">(${Math.round(g.nb / total * 100)} %)</span></li>`
    ).join('');

    return `<div class="season-bar" aria-hidden="true">${barre}</div><ul class="legend">${legende}</ul>`;
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
                <h4 class="month-title">${formatDate(`${mois}-01`, { month: 'long' })}</h4>
                <div class="month-grid">
                    ${JOURS_SEMAINE.map(j => `<span class="weekday">${j}</span>`).join('')}
                    ${vides}${cases}
                </div>
            </div>`;
    }).join('');
}

function genererZone(zone, jours, today) {
    const nbInterdits = jours.filter(j => j.cat.color === '4' || j.cat.color === '5').length;
    return `
        <section class="main-card" data-zone="${escapeHtml(zone.cle)}">
            <h2 class="card-title">${escapeHtml(zone.label)}</h2>
            <p class="season-headline"><strong>${nbInterdits}</strong> jour${nbInterdits > 1 ? 's' : ''} d'accès interdit cet été</p>
            ${genererResume(jours)}
            <div class="months">${genererMois(jours, today)}</div>
            <p class="day-info-box" aria-live="polite">Touchez un jour pour voir la règle appliquée.</p>
        </section>`;
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

    document.title = `${camp.titre.replace(/^\W+/u, '')} – Été ${annee}`;
    document.getElementById('camp-title').textContent = camp.titre;
    const select = document.getElementById('year-select');
    select.innerHTML = annees.map(a => `<option value="${a}"${a === annee ? ' selected' : ''}>Été ${a}</option>`).join('');
    select.hidden = annees.length < 2;
    select.addEventListener('change', () => {
        params.set('annee', select.value);
        window.location.search = params.toString();
    });

    const dates = datesSaison(annee);
    const joursParZone = new Map(camp.zones.map(zone => [zone.cle, dates.map(date => ({
        date,
        cat: categorie(date, historyByDate.get(date)?.[zone.cle], regles[zone.dept], today)
    }))]));

    container.innerHTML = camp.zones.map(zone => genererZone(zone, joursParZone.get(zone.cle), today)).join('');

    // Toucher un jour affiche sa règle sous le calendrier de la zone
    container.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell) return;
        const section = cell.closest('[data-zone]');
        const jour = joursParZone.get(section.dataset.zone).find(j => j.date === cell.dataset.date);
        section.querySelectorAll('.cell-selected').forEach(c => c.classList.remove('cell-selected'));
        cell.classList.add('cell-selected');
        const titre = formatDate(jour.date, { weekday: 'long', day: 'numeric', month: 'long' });
        section.querySelector('.day-info-box').innerHTML =
            `<strong>${titre} : ${escapeHtml(jour.cat.label)}</strong>${jour.cat.detail ? `<br>${escapeHtml(jour.cat.detail)}` : ''}`;
    });
}

init();
