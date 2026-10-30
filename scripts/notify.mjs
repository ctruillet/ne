// Alertes par e-mail quand le niveau de demain d'un camp devient restrictif.
//
// Variables d'environnement :
//   SMTP_HOST, SMTP_USER, SMTP_PASS : serveur d'envoi et identifiants
//                       (sans eux, aucune alerte n'est envoyée)
//   SMTP_PORT         : port TLS (défaut 465)
//   MAIL_TO           : destinataires, séparés par des virgules (copie cachée)
//   MAIL_FROM         : expéditeur affiché (défaut : SMTP_USER)
//   ALERT_MIN_COLOR   : niveau de couleur à partir duquel alerter (défaut 3 = déconseillé)
//   SITE_URL          : adresse du site, pour les liens de l'e-mail
//   MAIL_DRY_RUN=1    : affiche l'e-mail au lieu de l'envoyer (tests)
import { envoyerEmail } from './smtp.mjs';

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
                    ancienLabel: reglesDept?.[c.ancien]?.label,
                    avant: couleur(reglesDept, c.ancien),
                    apres: couleur(reglesDept, c.nouveau)
                };
            })
            .filter(l => l.config && doitAlerter(l.avant, l.apres))
            // Révision sans effet visible (ex. 13 : niveaux 3 et 4 tous deux « Interdit »)
            .filter(l => !(l.revision && l.ancienLabel === l.config.label && l.avant === l.apres));
        if (lignes.length === 0) continue;

        const pire = lignes.reduce((a, b) => (b.apres > a.apres ? b : a));
        const nomCamp = camp.titre.replace(/^\W+/u, '').trim();
        const restrictif = pire.apres >= ALERT_MIN_COLOR;

        alertes.push({
            date,
            niveau: pire.apres,
            titre: restrictif
                ? `${nomCamp} : accès ${pire.config.label.toLowerCase()} demain`
                : `${nomCamp} : accès de nouveau ${pire.config.label.toLowerCase()} demain`,
            details: lignes.map(l => {
                const evolution = !l.ancienLabel || l.ancienLabel === l.config.label ? ''
                    : l.revision ? ` (prévision révisée, avant : ${l.ancienLabel})` : ` (aujourd'hui : ${l.ancienLabel})`;
                return `• ${l.zone.label} : ${l.config.label}${evolution}\n  ${l.config.detail}`;
            }),
            lien: `${SITE_URL}/camp.html?camp=${encodeURIComponent(camp.id)}`
        });
    }
    return alertes;
}

// Regroupe toutes les alertes dans un seul e-mail
export function construireEmail(alertes) {
    const icone = (niveau) => (niveau >= 4 ? '🔥' : niveau >= ALERT_MIN_COLOR ? '⚠️' : '✅');
    const pire = alertes.reduce((a, b) => (b.niveau > a.niveau ? b : a));
    const subject = alertes.length === 1
        ? `${icone(pire.niveau)} ${pire.titre}`
        : `${icone(pire.niveau)} ${alertes.length} camps concernés demain : ${alertes.map(a => a.titre.split(' : ')[0]).join(', ')}`;

    const text = [
        `Prévision pour ${formatDate(pire.date)} :`,
        '',
        ...alertes.map(a => `${icone(a.niveau)} ${a.titre}\n${a.details.join('\n')}\nVoir l'historique : ${a.lien}\n`),
        '—',
        `Tous les camps : ${SITE_URL}/`,
        'Carte officielle : https://www.risque-prevention-incendie.fr'
    ].join('\n');

    return { subject, text };
}

// Envoie les alertes. Une erreur d'envoi est signalée mais ne fait jamais
// échouer la mise à jour de l'historique.
export async function envoyerAlertes(alertes) {
    if (alertes.length === 0) return;
    const { subject, text } = construireEmail(alertes);

    if (process.env.MAIL_DRY_RUN === '1') {
        console.log(`📧 [test] ${subject}\n${text}`);
        return;
    }

    const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
    const to = (process.env.MAIL_TO || '').split(',').map(a => a.trim()).filter(Boolean);
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || to.length === 0) {
        console.log(`🔕 Alerte non envoyée (configuration e-mail incomplète) : ${subject}`);
        return;
    }

    try {
        await envoyerEmail({
            host: SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 465),
            user: SMTP_USER,
            pass: SMTP_PASS,
            from: process.env.MAIL_FROM || SMTP_USER,
            to,
            subject,
            text
        });
        console.log(`📧 Alerte envoyée à ${to.length} destinataire(s) : ${subject}`);
    } catch (e) {
        console.log(`⚠️ Échec de l'envoi de l'alerte « ${subject} » (${e.message}).`);
    }
}
