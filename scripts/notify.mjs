// Alertes ntfy (https://ntfy.sh) quand le niveau de demain d'un camp est restrictif.
//
// Variables d'environnement :
//   NTFY_TOPIC        : nom du sujet ntfy (sans lui, aucune alerte n'est envoyée)
//   NTFY_SERVER       : serveur ntfy (défaut https://ntfy.sh)
//   NTFY_TOKEN        : jeton d'accès, si le sujet est protégé (optionnel)
//   ALERT_MIN_COLOR   : niveau de couleur à partir duquel alerter (défaut 3 = déconseillé)
//   SITE_URL          : adresse du site, pour le lien de l'alerte
//   NTFY_DRY_RUN=1    : affiche les alertes au lieu de les envoyer (tests)

const NTFY_SERVER = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
const ALERT_MIN_COLOR = Number(process.env.ALERT_MIN_COLOR || 3);
const SITE_URL = (process.env.SITE_URL || 'https://ctruillet.github.io/ne').replace(/\/$/, '');

function formatDate(isoDate) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
        .format(new Date(`${isoDate}T12:00:00Z`));
}

const couleur = (regles, status) => Number(regles?.[status]?.color ?? 0);

// Une zone mérite une alerte si son niveau devient restrictif,
// ou s'il redevient permissif après avoir été restrictif (bonne nouvelle).
function doitAlerter(ancienneCouleur, nouvelleCouleur) {
    if (nouvelleCouleur >= ALERT_MIN_COLOR) return true;
    return ancienneCouleur >= ALERT_MIN_COLOR && nouvelleCouleur > 0;
}

// Construit une alerte par camp concerné.
// changements : [{ zone, ancien, nouveau, revision }] pour la date donnée.
//   revision = true  : « ancien » est la valeur déjà publiée pour cette date
//   revision = false : première publication, « ancien » est le niveau de la veille
export function construireAlertes({ date, changements, camps, regles }) {
    const alertes = [];
    for (const camp of camps) {
        const lignes = changements
            .filter(c => camp.zones.some(z => z.cle === c.zone.cle))
            .map(c => {
                const reglesDept = regles[c.zone.dept];
                return {
                    ...c,
                    config: reglesDept?.[c.nouveau],
                    avant: couleur(reglesDept, c.ancien),
                    apres: couleur(reglesDept, c.nouveau)
                };
            })
            .filter(l => l.config && doitAlerter(l.avant, l.apres))
            // Révision sans effet visible (ex. 13 : niveaux 3 et 4 tous deux « Interdit »)
            .filter(l => !(l.revision && regles[l.zone.dept]?.[l.ancien]?.label === l.config.label && l.avant === l.apres));
        if (lignes.length === 0) continue;

        const pire = lignes.reduce((a, b) => (b.apres > a.apres ? b : a));
        const nomCamp = camp.titre.replace(/^\W+/u, '').trim();
        const restrictif = pire.apres >= ALERT_MIN_COLOR;

        alertes.push({
            title: restrictif
                ? `${nomCamp} : accès ${pire.config.label.toLowerCase()} demain`
                : `${nomCamp} : accès de nouveau ${pire.config.label.toLowerCase()} demain`,
            message: [
                `Prévision pour ${formatDate(date)} :`,
                ...lignes.map(l => {
                    const ancienLabel = regles[l.zone.dept]?.[l.ancien]?.label;
                    const evolution = !ancienLabel || ancienLabel === l.config.label ? ''
                        : l.revision ? ` (prévision révisée, avant : ${ancienLabel})` : ` (aujourd'hui : ${ancienLabel})`;
                    return `• ${l.zone.label} : ${l.config.label}${evolution}\n  ${l.config.detail}`;
                })
            ].join('\n'),
            priority: pire.apres >= 4 ? 4 : 3,
            tags: [pire.apres >= 4 ? 'fire' : pire.apres >= ALERT_MIN_COLOR ? 'warning' : 'white_check_mark'],
            click: `${SITE_URL}/camp.html?camp=${encodeURIComponent(camp.id)}`
        });
    }
    return alertes;
}

// Envoie les alertes. Une erreur d'envoi est signalée mais ne fait jamais
// échouer la mise à jour de l'historique.
export async function envoyerAlertes(alertes) {
    const topic = process.env.NTFY_TOPIC;
    if (alertes.length === 0) return;
    if (process.env.NTFY_DRY_RUN === '1') {
        for (const a of alertes) console.log(`🔔 [test] ${a.title}\n${a.message}\n→ ${a.click}`);
        return;
    }
    if (!topic) {
        console.log(`🔕 ${alertes.length} alerte(s) non envoyée(s) : NTFY_TOPIC n'est pas défini.`);
        return;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;

    for (const alerte of alertes) {
        try {
            const res = await fetch(NTFY_SERVER, {
                method: 'POST',
                headers,
                body: JSON.stringify({ topic, ...alerte })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            console.log(`🔔 Alerte envoyée : ${alerte.title}`);
        } catch (e) {
            console.log(`⚠️ Échec de l'envoi de l'alerte « ${alerte.title} » (${e.message}).`);
        }
    }
}
