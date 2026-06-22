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

function appliquerStyleCard(cardId, textId, status, labelParDefaut) {
    const card = document.getElementById(cardId);
    const text = document.getElementById(textId);
    if (!card || !text) return;
    
    card.className = "zone-card"; 
    if (["1", "2", "3", "4"].includes(status?.toString())) {
        card.classList.add(`card-status-${status}`);
        text.textContent = STATUS_LABELS[status];
    } else {
        card.classList.add('card-status-unknown');
        text.textContent = labelParDefaut;
    }
}

function appliquerStyleToday(textId, status) {
    const text = document.getElementById(textId);
    if (!text) return;
    
    text.className = "badge-today";
    if (["1", "2", "3", "4"].includes(status?.toString())) {
        text.classList.add(`text-status-${status}`);
        text.textContent = STATUS_LABELS[status].split(' (')[0];
    } else {
        text.classList.add('text-status-unknown');
        text.textContent = "Non publié";
    }
}

async function init() {
    const url = './historique.json';
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Historique non trouvé");
        const history = await response.json();
        
        const todayKey = getIsoDate(0);
        const tomorrowKey = getIsoDate(1);
        
        const todayData = history.find(item => item.date === todayKey);
        const tomorrowData = history.find(item => item.date === tomorrowKey);
        
        // 1. Rendu pour DEMAIN (Fonds colorés globaux)
        appliquerStyleCard('card-calanques', 'calanques-tomorrow', tomorrowData?.calanques, "Non disponible");
        appliquerStyleCard('card-sb13', 'sb13-tomorrow', tomorrowData?.sainteBaume13, "Non disponible");
        appliquerStyleCard('card-sb83', 'sb83-tomorrow', tomorrowData?.sainteBaume83, "Non disponible");
        appliquerStyleCard('card-garrigues', 'garrigues-tomorrow', tomorrowData?.garrigues, "Non disponible");
        
        // 2. Rendu pour AUJOURD'HUI (Petites lignes du bas)
        appliquerStyleToday('calanques-today', todayData?.calanques);
        appliquerStyleToday('sb13-today', todayData?.sainteBaume13);
        appliquerStyleToday('sb83-today', todayData?.sainteBaume83);
        appliquerStyleToday('garrigues-today', todayData?.garrigues);

    } catch (e) {
        console.error("Erreur lors de la lecture de l'historique :", e);
        const errLabel = "Données indisponibles";
        appliquerStyleCard('card-calanques', 'calanques-tomorrow', "unknown", errLabel);
        appliquerStyleCard('card-sb13', 'sb13-tomorrow', "unknown", errLabel);
        appliquerStyleCard('card-sb83', 'sb83-tomorrow', "unknown", errLabel);
        appliquerStyleCard('card-garrigues', 'garrigues-tomorrow', "unknown", errLabel);
    }
}

init();