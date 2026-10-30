// Fonctions partagées entre la page d'accueil (app.js) et la page camp (camp.js)

// Date (+ offset en jours) au format AAAA-MM-JJ, à l'heure de Paris.
// Sans date de base, part d'aujourd'hui.
function getIsoDate(offset = 0, base = null) {
    if (base) {
        // Midi UTC : évite tout décalage de jour lié aux fuseaux
        const d = new Date(`${base}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + offset);
        return d.toISOString().slice(0, 10);
    }
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

function formatDate(isoDate, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
    return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' })
        .format(new Date(`${isoDate}T12:00:00Z`));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
    return response.json();
}
