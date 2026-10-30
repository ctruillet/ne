// Client SMTP minimal (TLS direct, port 465), sans dépendance externe.
// Suffit pour Gmail, Outlook, OVH, etc. avec un mot de passe d'application.
import tls from 'node:tls';

const b64 = (texte) => Buffer.from(texte, 'utf8').toString('base64');

// Encode un en-tête non ASCII (RFC 2047)
const enTete = (texte) => (/^[\x20-\x7e]*$/.test(texte) ? texte : `=?UTF-8?B?${b64(texte)}?=`);

// Corps en base64 découpé en lignes de 76 caractères (pas de souci d'accents ni de « . » seul)
const corpsBase64 = (texte) => b64(texte).match(/.{1,76}/g).join('\r\n');

function construireMessage({ from, to, subject, text }) {
    return [
        `From: ${from}`,
        `To: ${to.length === 1 ? to[0] : 'undisclosed-recipients:;'}`,
        `Subject: ${enTete(subject)}`,
        `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        corpsBase64(text)
    ].join('\r\n');
}

// Envoie un e-mail. Les destinataires multiples sont en copie cachée.
export function envoyerEmail({ host, port = 465, user, pass, from, to, subject, text, timeoutMs = 20000 }) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({ host, port, servername: host });
        socket.setEncoding('utf8');
        socket.setTimeout(timeoutMs, () => socket.destroy(new Error('délai dépassé')));

        // Étapes : chaque commande attend un code de réponse donné
        const etapes = [
            { attendu: 220 },
            { cmd: 'EHLO localhost', attendu: 250 },
            { cmd: `AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}`, attendu: 235, masque: 'AUTH PLAIN ***' },
            { cmd: `MAIL FROM:<${from.match(/<(.+)>/)?.[1] ?? from}>`, attendu: 250 },
            ...to.map(adresse => ({ cmd: `RCPT TO:<${adresse}>`, attendu: 250 })),
            { cmd: 'DATA', attendu: 354 },
            { cmd: `${construireMessage({ from, to, subject, text })}\r\n.`, attendu: 250, masque: '(message)' },
            { cmd: 'QUIT', attendu: 221 }
        ];

        let tampon = '';
        let etape = 0;
        socket.on('data', (morceau) => {
            tampon += morceau;
            // Une réponse est complète quand sa dernière ligne est « 123 texte » (sans tiret)
            const lignes = tampon.split('\r\n').filter(Boolean);
            const derniere = lignes.at(-1);
            if (!tampon.endsWith('\r\n') || !/^\d{3} /.test(derniere ?? '')) return;
            tampon = '';

            const code = Number(derniere.slice(0, 3));
            const courante = etapes[etape];
            if (code !== courante.attendu) {
                socket.destroy();
                reject(new Error(`réponse ${derniere} à « ${courante.masque ?? courante.cmd ?? 'connexion'} »`));
                return;
            }
            etape++;
            if (etape === etapes.length) {
                socket.end();
                resolve();
                return;
            }
            socket.write(`${etapes[etape].cmd}\r\n`);
        });
        socket.on('error', reject);
    });
}
