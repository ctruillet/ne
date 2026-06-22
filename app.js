const STATUS_LABELS = {
    "1": "Autorisé (Vert)",
    "2": "Autorisé (Jaune)",
    "3": "Réglementé (Orange)",
    "4": "Interdit (Rouge)"
};

function getFormattedDate(offset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const options = { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('fr-FR', options).formatToParts(d);
    
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return `${year}${month}${day}`;
}

async function fetchZoneData(dateStr) {
    const url = `https://www.risque-prevention-incendie.fr/static/13/import_data/${dateStr}.json`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("404");
        const data = await response.json();
        
        let calanques = "unknown";
        let sainteBaume = "unknown";

        if (data && data.massifs) {
            const cData = data.massifs["133"];
            const sData = data.massifs["1322"];
            
            calanques = (Array.isArray(cData) ? cData[0] : cData) || "unknown";
            sainteBaume = (Array.isArray(sData) ? sData[0] : sData) || "unknown";
        }
        return { calanques, sainteBaume };
    } catch (e) {
        return { calanques: "unknown", sainteBaume: "unknown" };
    }
}

function appliquerStyleCard(cardId, textId, status, labelParDefaut) {
    const card = document.getElementById(cardId);
    const text = document.getElementById(textId);
    
    card.className = "zone-card"; 
    if (["1", "2", "3", "4"].includes(status.toString())) {
        card.classList.add(`card-status-${status}`);
        text.textContent = STATUS_LABELS[status];
    } else {
        card.classList.add('card-status-unknown');
        text.textContent = labelParDefaut;
    }
}

function appliquerStyleToday(textId, status) {
    const text = document.getElementById(textId);
    text.className = "badge-today";
    
    if (["1", "2", "3", "4"].includes(status.toString())) {
        text.classList.add(`text-status-${status}`);
        text.textContent = STATUS_LABELS[status].split(' (')[0];
    } else {
        text.classList.add('text-status-unknown');
        text.textContent = "Non publié";
    }
}

async function init() {
    // On charge le fichier généré par notre GitHub Action sur notre propre dépôt
    const url = './previsions.json';
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Fichier non trouvé");
        const data = await response.json();
        
        // Comme le fichier contient déjà la prévision préparée par le script :
        appliquerStyleCard('card-calanques', 'calanques-tomorrow', data.calanques, "Non disponible");
        appliquerStyleCard('card-saintebaume', 'saintebaume-tomorrow', data.sainteBaume, "Non disponible");
        
        // Pour aujourd'hui (Optionnel ou en attente d'historique)
        appliquerStyleToday('calanques-today', data.calanques); // Modifiable selon le besoin
        appliquerStyleToday('saintebaume-today', data.sainteBaume);

    } catch (e) {
        console.error("Erreur de chargement des prévisions locales :", e);
        appliquerStyleCard('card-calanques', 'calanques-tomorrow', "unknown", "Données indisponibles");
        appliquerStyleCard('card-saintebaume', 'saintebaume-tomorrow', "unknown", "Données indisponibles");
    }
}

// Lancement au chargement du script
init();