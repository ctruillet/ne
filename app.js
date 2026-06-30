function getIsoDate(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const options = { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('fr-FR', options).formatToParts(d);
    
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}-${month}-${day}`;
}

async function fetchLiveData(dept, dateStr) {
    try {
        const response = await fetch(`https://www.risque-prevention-incendie.fr/static/${dept}/import_data/${dateStr}.json`);
        return response.ok ? await response.json() : null;
    } catch (e) {
        return null;
    }
}

function getQueryDate() {
    const params = new URLSearchParams(window.location.search);
    return params.get('date');
}

// Génère le code HTML - INVERSÉ : Aujourd'hui est en haut, Demain est en bas
function genererStructureCamp(camp) {
    let rowsHtml = camp.zones.map(zone => `
        <article id="row-${zone.cle}" class="zone-row status-unknown">
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

// Applique les styles de manière inversée (la carte prend la couleur d'Aujourd'hui)
function appliquerStyleRow(cle, statusTomorrow, statusToday, reglesDepartement) {
    const row = document.getElementById(`row-${cle}`);
    const txtToday = document.getElementById(`${cle}-today`);
    const txtTomorrow = document.getElementById(`${cle}-tomorrow`);

    const configToday = reglesDepartement?.[statusToday?.toString()];
    const configTomorrow = reglesDepartement?.[statusTomorrow?.toString()];

    // Rendu principal pour AUJOURD'HUI (gère le fond de la ligne complète et le gros badge)
    if (row && txtToday) {
        row.className = "zone-row";
        if (configToday) {
            row.classList.add(`card-status-${configToday.color}`);
            txtToday.textContent = configToday.label;
            
            row.setAttribute('title', configToday.detail);
            txtToday.setAttribute('title', configToday.detail);
        } else {
            row.classList.add('card-status-unknown');
            txtToday.textContent = "Non disponible";
            row.removeAttribute('title');
        }
    }

    // Rendu secondaire pour DEMAIN (petite ligne du bas)
    if (txtTomorrow) {
        txtTomorrow.className = "badge-tomorrow-sub";
        if (configTomorrow) {
            txtTomorrow.classList.add(`text-status-${configTomorrow.color}`);
            txtTomorrow.textContent = configTomorrow.label;
            
            txtTomorrow.setAttribute('title', configTomorrow.detail);
        } else {
            txtTomorrow.classList.add('text-status-unknown');
            txtTomorrow.textContent = "Non publié";
            txtTomorrow.removeAttribute('title');
        }
    }
}

async function init() {
    const container = document.getElementById('dashboard-container');
    const todayKey = getIsoDate(0);
    const tomorrowKey = getIsoDate(1);
    const todayStr = todayKey.replace(/-/g, '');
    const tomorrowStr = tomorrowKey.replace(/-/g, '');

    try {
        const [resCamps, resRegles, resHistory] = await Promise.all([
            fetch('./camps.json').then(r => r.json()),
            fetch('./regles.json').then(r => r.json()),
            fetch('./historique.json').then(r => r.json())
        ]);

        container.innerHTML = resCamps.map(camp => genererStructureCamp(camp)).join('');
        
        const updateUI = (dataToday, dataTomorrow) => {
            resCamps.forEach(camp => {
                camp.zones.forEach(zone => {
                    const statusToday = dataToday?.[zone.cle] || "unknown";
                    const statusTomorrow = dataTomorrow?.[zone.cle] || "unknown";
                    appliquerStyleRow(zone.cle, statusTomorrow, statusToday, resRegles[zone.dept]);
                });
            });
        };

        const hToday = resHistory.find(i => i.date === todayKey);
        const hTomorrow = resHistory.find(i => i.date === tomorrowKey);
        updateUI(hToday, hTomorrow);

        const depts = [...new Set(resCamps.flatMap(c => c.zones.map(z => z.dept)))];
        const liveData = { today: {}, tomorrow: {} };

        for (const dept of depts) {
            const dToday = await fetchLiveData(dept, todayStr);
            const dTomorrow = await fetchLiveData(dept, tomorrowStr);
            
            resCamps.forEach(c => c.zones.forEach(z => {
                if (z.dept === dept) {
                    if (dToday?.massifs?.[z.id_massif]) liveData.today[z.cle] = dToday.massifs[z.id_massif][0];
                    if (dTomorrow?.massifs?.[z.id_massif]) liveData.tomorrow[z.cle] = dTomorrow.massifs[z.id_massif][0];
                }
            }));
        }

        if (Object.keys(liveData.today).length > 0 || Object.keys(liveData.tomorrow).length > 0) {
            console.log("Données live récupérées, mise à jour de l'interface...");
            updateUI(liveData.today, liveData.tomorrow);
        }

    } catch (e) {
        console.error("Erreur d'initialisation :", e);
    }
}

init();
