const STATUS_LABELS = {
    "1": "Autorisé (Vert)",
    "2": "Autorisé (Jaune)",
    "3": "Réglementé (Orange)",
    "4": "Interdit (Rouge)"
};

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

// Génère le code HTML d'une section de camp de manière dynamique
function genererStructureCamp(camp) {
    let rowsHtml = camp.zones.map(zone => `
        <article id="row-${zone.cle}" class="zone-row status-unknown">
            <div class="row-header">
                <div class="day-info">
                    <span class="day-label">Demain</span>
                    <span class="zone-tag">${zone.label}</span>
                </div>
                <span id="${zone.cle}-tomorrow" class="badge-tomorrow">...</span>
            </div>
            <div class="today-line">
                <span class="today-label">Aujourd'hui</span>
                <span id="${zone.cle}-today" class="badge-today text-status-unknown">...</span>
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

function appliquerStyleRow(cle, statusTomorrow, statusToday) {
    const row = document.getElementById(`row-${cle}`);
    const txtTomorrow = document.getElementById(`${cle}-tomorrow`);
    const txtToday = document.getElementById(`${cle}-today`);

    // Style de la ligne globale (Demain)
    if (row && txtTomorrow) {
        row.className = "zone-row";
        if (["1", "2", "3", "4"].includes(statusTomorrow?.toString())) {
            row.classList.add(`card-status-${statusTomorrow}`);
            txtTomorrow.textContent = STATUS_LABELS[statusTomorrow];
        } else {
            row.classList.add('card-status-unknown');
            txtTomorrow.textContent = "Non disponible";
        }
    }

    // Style de la ligne du bas (Aujourd'hui)
    if (txtToday) {
        txtToday.className = "badge-today";
        if (["1", "2", "3", "4"].includes(statusToday?.toString())) {
            txtToday.classList.add(`text-status-${statusToday}`);
            txtToday.textContent = STATUS_LABELS[statusToday].split(' (')[0];
        } else {
            txtToday.classList.add('text-status-unknown');
            txtToday.textContent = "Non publié";
        }
    }
}

async function init() {
    const container = document.getElementById('dashboard-container');
    
    try {
        // 1. Charger la liste des camps configurés
        const resCamps = await fetch('./camps.json');
        if (!resCamps.ok) throw new Error("Impossible de charger camps.json");
        const camps = await resCamps.json();

        // 2. Construire le HTML sur la page
        container.innerHTML = camps.map(camp => genererStructureCamp(camp)).join('');

        // 3. Charger les données d'historique
        const resHistory = await fetch('./historique.json');
        if (!resHistory.ok) throw new Error("Impossible de charger historique.json");
        const history = await resHistory.json();
        
        const todayKey = getIsoDate(0);
        const tomorrowKey = getIsoDate(1);
        
        const todayData = history.find(item => item.date === todayKey);
        const tomorrowData = history.find(item => item.date === tomorrowKey);
        
        // 4. Appliquer les styles pour chaque zone détectée dans la config
        camps.forEach(camp => {
            camp.zones.forEach(zone => {
                const statusTomorrow = tomorrowData ? tomorrowData[zone.cle] : "unknown";
                const statusToday = todayData ? todayData[zone.cle] : "unknown";
                appliquerStyleRow(zone.cle, statusTomorrow, statusToday);
            });
        });

    } catch (e) {
        console.error("Erreur lors de l'initialisation du dashboard :", e);
        container.innerHTML = `<div style="text-align: center; color: var(--c-4-badge); padding: 20px;">⚠️ Erreur de chargement des données.</div>`;
    }
}

init();