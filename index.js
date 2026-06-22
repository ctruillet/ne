const axios = require('axios');

// PARAMÈTRES OFFICIELS META
const WHATSAPP_TOKEN = "EAASFj3rchIgBRwXuXuZCxXqdqYXC4JuTlIIKByeXIrBj9Kb9cPiMQ0hpBZAvoM22uMVQQJKLZAKlCkgNLaTDVEQuODVe99K7wwEUZBq2jylz0wKh8dil6qiWcOHwTAV6QF8piTs4FZARZBUrVtSoJVYPWHfyAvK8eL8aaf38d6r6DpIh6Fr3dHctbeg6Ht34ahqL4ZBZCXXe34miuZB3bG9jvP3sOAqx6209gkoKDMw353MBF0K9W4f6OvNmmvpMxmVZBmDuCQkvRidf6JvTQyZAPZBf7QZDZD"; // Ton token Meta
const PHONE_NUMBER_ID = "1196445703547564"; // Ton Phone Number ID Meta
const CANAL_ID = "120363XXXXXXXXX@newsletter"; // L'identifiant de ton Canal WhatsApp

// Correspondance des codes de statut/couleur du site
const STATUS_COLORS = {
    "1": "🟢 VERT (Accès autorisé)",
    "2": "🟡 JAUNE (Accès autorisé)",
    "3": "🟠 ORANGE (Accès autorisé toute la journée / Travaux réglementés)",
    "4": "🔴 ROUGE (Accès INTERDIT)"
};

async function executerAlerteIncendie() {
    // 1. Calcul de la date de DEMAIN (Fuseau Paris)
    const aujourdhui = new Date();
    const demain = new Date(aujourdhui);
    demain.setDate(demain.getDate() + 1); // On ajoute 1 jour

    const optionsDate = { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('fr-FR', optionsDate);
    const parts = formatter.formatToParts(demain); // Formate la date de demain
    
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const dateStr = `${year}${month}${day}`;

    const jsonUrl = `https://www.risque-prevention-incendie.fr/static/13/import_data/${dateStr}.json`;
    console.log(`Tentative de récupération du fichier du lendemain : ${jsonUrl}`);

    let msg = `🔥 *Prévisions Risque Incendie (13)* 🔥\n📅 Pour le : ${day}/${month}/${year}\n\n`;

    try {
        // 2. Téléchargement du fichier JSON
        const reponse = await axios.get(jsonUrl);
        const data = reponse.data;

        let statutCalanques = "Inconnu";
        let statutSainteBaume = "Inconnu";

        // Détection de la structure et extraction (gestion des différents formats possibles)
        if (Array.isArray(data)) {
            const calanquesData = data.find(item => item.id == 133 || item.code == 133);
            const sainteBaumeData = data.find(item => item.id == 1322 || item.code == 1322);

            statutCalanques = calanquesData ? (STATUS_COLORS[calanquesData.statut] || calanquesData.statut) : "Non trouvé";
            statutSainteBaume = sainteBaumeData ? (STATUS_COLORS[sainteBaumeData.statut] || sainteBaumeData.statut) : "Non trouvé";
        } else if (data.massifs) {
            const c = data.massifs["133"];
            const s = data.massifs["1322"];
            statutCalanques = c ? (STATUS_COLORS[c.statut] || c.statut) : "Non trouvé";
            statutSainteBaume = s ? (STATUS_COLORS[s.statut] || s.statut) : "Non trouvé";
        } else {
            statutCalanques = data["133"]?.statut || "Non trouvé";
            statutSainteBaume = data["1322"]?.statut || "Non trouvé";
        }

        msg += `📍 *Calanques (133) :* ${statutCalanques}\n`;
        msg += `📍 *Sainte-Baume (1322) :* ${statutSainteBaume}\n`;

    } catch (error) {
        console.error("Erreur lors de la récupération du JSON :", error.message);
        msg += "⚠️ Les prévisions de demain ne sont pas encore publiées par la préfecture.";
    }

    // 3. Envoi officiel sur WhatsApp (Meta API)
    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: CANAL_ID,
                type: "text",
                text: { body: msg }
            },
            {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log("Message envoyé avec succès !");
    } catch (err) {
        console.error("Erreur API Meta :", err.response?.data || err.message);
    }
}

executerAlerteIncendie();