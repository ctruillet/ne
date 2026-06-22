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

function appliquerStyleRow(cle, statusTomorrow, statusToday, reglesDepartement) {
    const row = document.getElementById(`row-${cle}`);
    const txtTomorrow = document.getElementById(`${cle}-tomorrow`);
    const txtToday = document.getElementById(`${cle}-today`);

    const configTomorrow = reglesDepartement?.[statusTomorrow?.toString()];
    const configToday = reglesDepartement?.[statusToday?.toString()];

    // Rendu pour DEMAIN
    if (row && txtTomorrow) {
        row.className = "zone-row";
        if (configTomorrow) {
            row.classList.add(`card-status-${configTomorrow.color}`);
            txtTomorrow.textContent = configTomorrow.label;
            
            // Ajoute l'infobulle textuelle au survol de la ligne et du badge
            row.setAttribute('title', configTomorrow.detail);
            txtTomorrow.setAttribute('title', configTomorrow.detail);
        } else {
            row.classList.add('card-status-unknown');
            txtTomorrow.textContent = "Non disponible";
            row.removeAttribute('title');
        }
    }

    // Rendu pour AUJOURD'HUI
    if (txtToday) {
        txtToday.className = "badge-today";
        if (configToday) {
            txtToday.classList.add(`text-status-${configToday.color}`);
            txtToday.textContent = configToday.label;
            
            // Ajoute l'infobulle textuelle au survol du petit texte du bas
            txtToday.setAttribute('title', configToday.detail);
        } else {
            txtToday.classList.add('text-status-unknown');
            txtToday.textContent = "Non publié";
            txtToday.removeAttribute('title');
        }
    }
}

async function init() {
    const container = document.getElementById('dashboard-container');
    
    try {
        // 1. Chargement parallèle de toutes les ressources JSON nécessaires
        const [resCamps, resRegles, resHistory] = await Promise.all([
            fetch('./camps.json'),
            fetch('./regles.json'),
            fetch('./historique.json')
        ]);

        if (!resCamps.ok || !resRegles.ok || !resHistory.ok) {
            throw new Error("Erreur de communication lors du chargement des fichiers JSON.");
        }

        const camps = await resCamps.json();
        const reglesGlobale = await resRegles.json();
        const history = await resHistory.json();

        // 2. Construire le squelette HTML des cartes sur la page
        container.innerHTML = camps.map(camp => genererStructureCamp(camp)).join('');

        // 3. Extraire les données de l'historique pour aujourd'hui et demain
        const todayKey = getIsoDate(0);
        const tomorrowKey = getIsoDate(1);
        
        const todayData = history.find(item => item.date === todayKey);
        const tomorrowData = history.find(item => item.date === tomorrowKey);
        
        // 4. Appliquer les styles et infobulles pour chaque zone détectée dans la config
        camps.forEach(camp => {
            camp.zones.forEach(zone => {
                const statusTomorrow = tomorrowData ? tomorrowData[zone.cle] : "unknown";
                const statusToday = todayData ? todayData[zone.cle] : "unknown";
                
                // Récupération de la table de règles du département associé (ex: reglesGlobale["13"])
                const reglesDept = reglesGlobale[zone.dept];
                
                appliquerStyleRow(zone.cle, statusTomorrow, statusToday, reglesDept);
            });
        });

    } catch (e) {
        console.error("Erreur lors de l'initialisation du dashboard :", e);
        container.innerHTML = `<div style="text-align: center; color: var(--c-4-badge); padding: 20px;">⚠️ Erreur de chargement des données.</div>`;
    }
}

// Lancement au chargement du script
init();