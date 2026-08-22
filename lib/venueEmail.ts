/**
 * lib/venueEmail.ts — transactional email to VENUE OWNERS (not players).
 *
 * Deliberately separate from lib/email.ts:
 *   • different audience (a business, not a player) and different footer —
 *     no player unsubscribe link, because these are transactional messages
 *     about a paid subscription;
 *   • different FROM address, so venue billing mail is never confused with
 *     the matchday blasts;
 *   • localised — a bar in Milan gets Italian, not English.
 *
 * COLD OUTREACH DOES NOT GO THROUGH HERE. Resend's terms prohibit it and
 * this is the same account that sends the product's transactional mail.
 * Prospecting goes out through the dedicated cold-email platform — see
 * lib/outreach.ts.
 */

import { getResend } from "./email";
import { SITE } from "./stripe";

export const VENUE_FROM =
  process.env.VENUE_FROM_EMAIL || "SuperBrain Venues <venues@superbrain.social>";

type Lang = "en" | "de" | "es" | "fr" | "it";
const lang = (l: string): Lang =>
  (["en", "de", "es", "fr", "it"].includes(l) ? l : "en") as Lang;

interface WelcomeInput {
  to: string;
  venueName: string;
  ownerName?: string | null;
  language: string;
  leagueName: string;
  competitionName: string;
  joinUrl: string;
  qrUrl: string;
  posterUrl: string;
}

// ── Copy, per language ────────────────────────────────────────
const COPY: Record<Lang, (i: WelcomeInput) => {
  subject: string; hi: string; lead: string; live: string;
  step1: string; step2: string; step3: string;
  cta: string; poster: string; trial: string; sign: string;
}> = {
  en: (i) => ({
    subject: `${i.venueName} — your league is live`,
    hi: i.ownerName ? `Hi ${i.ownerName},` : "Hi,",
    lead: `${i.leagueName} is live. Your regulars can join it tonight.`,
    live: "Everything below is already set up — there is nothing to configure.",
    step1: "Print the table poster and put one on every table.",
    step2: "Customers scan the QR code and they are in your league in 20 seconds.",
    step3: `They predict every ${i.competitionName} match and the table updates live on your screens.`,
    cta: "Open your league",
    poster: "Download the table poster",
    trial: "Your 7-day trial has started. We will email you before it converts — cancel any time from the link in your receipt.",
    sign: "Any question at all, just reply to this email.",
  }),
  es: (i) => ({
    subject: `${i.venueName} — tu liga ya está activa`,
    hi: i.ownerName ? `Hola ${i.ownerName}:` : "Hola:",
    lead: `${i.leagueName} ya está activa. Tus clientes pueden unirse esta misma noche.`,
    live: "Todo está configurado. No tienes que hacer nada más.",
    step1: "Imprime el cartel y coloca uno en cada mesa.",
    step2: "Tus clientes escanean el código QR y entran en tu liga en 20 segundos.",
    step3: `Pronostican cada partido de ${i.competitionName} y la clasificación se actualiza en directo en tus pantallas.`,
    cta: "Abrir mi liga",
    poster: "Descargar el cartel de mesa",
    trial: "Tu prueba de 7 días ha comenzado. Te avisaremos por email antes de que se convierta en suscripción; puedes cancelar cuando quieras desde el enlace de tu recibo.",
    sign: "Cualquier duda, responde a este email.",
  }),
  it: (i) => ({
    subject: `${i.venueName} — il tuo campionato è attivo`,
    hi: i.ownerName ? `Ciao ${i.ownerName},` : "Ciao,",
    lead: `${i.leagueName} è attivo. I tuoi clienti possono iscriversi già stasera.`,
    live: "È già tutto configurato: non devi impostare nulla.",
    step1: "Stampa la locandina e mettine una su ogni tavolo.",
    step2: "I clienti inquadrano il QR code ed entrano nel tuo campionato in 20 secondi.",
    step3: `Pronosticano ogni partita di ${i.competitionName} e la classifica si aggiorna in diretta sui tuoi schermi.`,
    cta: "Apri il tuo campionato",
    poster: "Scarica la locandina da tavolo",
    trial: "La tua prova di 7 giorni è iniziata. Ti avviseremo via email prima del rinnovo; puoi annullare quando vuoi dal link nella ricevuta.",
    sign: "Per qualsiasi domanda, rispondi a questa email.",
  }),
  fr: (i) => ({
    subject: `${i.venueName} — votre ligue est en ligne`,
    hi: i.ownerName ? `Bonjour ${i.ownerName},` : "Bonjour,",
    lead: `${i.leagueName} est en ligne. Vos habitués peuvent la rejoindre dès ce soir.`,
    live: "Tout est déjà configuré, vous n'avez rien à paramétrer.",
    step1: "Imprimez l'affichette et posez-en une sur chaque table.",
    step2: "Vos clients scannent le QR code et rejoignent votre ligue en 20 secondes.",
    step3: `Ils pronostiquent chaque match de ${i.competitionName} et le classement se met à jour en direct sur vos écrans.`,
    cta: "Ouvrir ma ligue",
    poster: "Télécharger l'affichette de table",
    trial: "Votre essai de 7 jours a commencé. Nous vous préviendrons par email avant le prélèvement — annulation à tout moment depuis le lien de votre reçu.",
    sign: "La moindre question, répondez simplement à cet email.",
  }),
  de: (i) => ({
    subject: `${i.venueName} — Ihre Liga ist online`,
    hi: i.ownerName ? `Hallo ${i.ownerName},` : "Hallo,",
    lead: `${i.leagueName} ist online. Ihre Stammgäste können noch heute Abend mitspielen.`,
    live: "Alles ist bereits eingerichtet — Sie müssen nichts konfigurieren.",
    step1: "Drucken Sie den Tischaufsteller und stellen Sie ihn auf jeden Tisch.",
    step2: "Ihre Gäste scannen den QR-Code und sind in 20 Sekunden in Ihrer Liga.",
    step3: `Sie tippen jedes ${i.competitionName}-Spiel und die Tabelle aktualisiert sich live auf Ihren Bildschirmen.`,
    cta: "Zur Liga",
    poster: "Tischaufsteller herunterladen",
    trial: "Ihre 7-tägige Testphase hat begonnen. Wir informieren Sie per E-Mail vor der Umwandlung — jederzeit kündbar über den Link in Ihrer Rechnung.",
    sign: "Bei Fragen antworten Sie einfach auf diese E-Mail.",
  }),
};

// ── Shell ─────────────────────────────────────────────────────
function shell(inner: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f5f0;font-family:Georgia,serif;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;">
  <div style="background:#0B0B0D;border-radius:12px 12px 0 0;padding:20px 24px;text-align:center;">
    <p style="margin:0;font-size:11px;letter-spacing:3px;color:#E8C15A;font-family:sans-serif;text-transform:uppercase;">SuperBrain</p>
    <p style="margin:4px 0 0;font-size:11px;color:#7a8f82;font-family:sans-serif;">For venues</p>
  </div>
  <div style="background:#fff;padding:28px 24px;border:1px solid #e6e0d6;border-top:none;border-radius:0 0 12px 12px;">
    ${inner}
  </div>
  <p style="font-size:11px;color:#9a9284;text-align:center;font-family:sans-serif;margin-top:18px;">
    SuperBrain · <a href="${SITE}" style="color:#E8C15A;">superbrain.social</a>
  </p>
</div></body></html>`;
}

/** The one email a venue gets the moment their league goes live. */
export async function sendVenueWelcome(input: WelcomeInput) {
  const c = COPY[lang(input.language)](input);

  const html = shell(`
    <p style="font-size:16px;color:#0B0B0D;margin:0 0 14px;">${c.hi}</p>
    <p style="font-size:17px;color:#0B0B0D;margin:0 0 8px;font-weight:bold;">${c.lead}</p>
    <p style="font-size:14px;color:#5a6b5f;margin:0 0 22px;">${c.live}</p>

    <div style="text-align:center;margin:0 0 22px;">
      <img src="${input.qrUrl}" width="160" height="160" alt="QR"
           style="border:8px solid #f4f1ea;border-radius:12px;display:block;margin:0 auto;">
    </div>

    <ol style="font-size:14px;color:#0B0B0D;line-height:1.7;padding-left:20px;margin:0 0 24px;">
      <li>${c.step1}</li>
      <li>${c.step2}</li>
      <li>${c.step3}</li>
    </ol>

    <div style="text-align:center;margin:0 0 12px;">
      <a href="${input.joinUrl}" style="display:inline-block;background:#E8C15A;color:#2A2205;
         text-decoration:none;padding:14px 28px;border-radius:8px;font-family:sans-serif;
         font-weight:bold;font-size:15px;">${c.cta}</a>
    </div>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${input.posterUrl}" style="color:#E8C15A;font-size:13px;font-family:sans-serif;">${c.poster} →</a>
    </div>

    <p style="font-size:12px;color:#7a8f82;border-top:1px solid #e6e0d6;padding-top:16px;margin:0 0 8px;">${c.trial}</p>
    <p style="font-size:13px;color:#5a6b5f;margin:0;">${c.sign}</p>
  `);

  return getResend().emails.send({
    from: VENUE_FROM,
    to: input.to,
    subject: c.subject,
    html,
    replyTo: process.env.VENUE_REPLY_TO || undefined,
  });
}

/**
 * Sent the moment checkout completes, when the venue still has setup to do:
 * pick competitions, add branding, download the Launch Pack. The CTA resumes
 * the exact wizard via the checkout session id.
 */
export async function sendVenueSetup(opts: {
  to: string; venueName: string; ownerName?: string | null; language: string; setupUrl: string;
}) {
  const L = lang(opts.language);
  const t = {
    en: { s: `${opts.venueName} — finish your 2-minute setup`, hi: "Hi ", lead: "Your SuperBrain Venue trial has started.", body: "Finish setting up to pick your competitions, add your logo and colours, and download your branded Launch Pack — posters, table tents, a TV leaderboard and social graphics, all ready to print and post.", cta: "Finish setup & get my Launch Pack", trial: "Your 7-day trial has started — cancel any time in the first 7 days and you pay nothing.", sign: "Any question at all, just reply to this email." },
    es: { s: `${opts.venueName} — termina tu configuración de 2 minutos`, hi: "Hola ", lead: "Tu prueba de SuperBrain para locales ha comenzado.", body: "Termina la configuración para elegir tus competiciones, añadir tu logo y colores y descargar tu Launch Pack con tu marca: carteles, displays de mesa, una clasificación para TV y gráficos para redes, listos para imprimir y publicar.", cta: "Terminar configuración y obtener mi Launch Pack", trial: "Tu prueba de 7 días ha comenzado: cancela en los primeros 7 días y no pagas nada.", sign: "Cualquier duda, responde a este email." },
    it: { s: `${opts.venueName} — completa la configurazione di 2 minuti`, hi: "Ciao ", lead: "La tua prova SuperBrain per locali è iniziata.", body: "Completa la configurazione per scegliere le competizioni, aggiungere logo e colori e scaricare il tuo Launch Pack brandizzato: locandine, display da tavolo, una classifica per la TV e grafiche social, pronti da stampare e pubblicare.", cta: "Completa la configurazione e ottieni il Launch Pack", trial: "La tua prova di 7 giorni è iniziata: annulla entro 7 giorni e non paghi nulla.", sign: "Per qualsiasi domanda, rispondi a questa email." },
    fr: { s: `${opts.venueName} — terminez votre configuration de 2 minutes`, hi: "Bonjour ", lead: "Votre essai SuperBrain pour établissements a commencé.", body: "Terminez la configuration pour choisir vos compétitions, ajouter votre logo et vos couleurs, et télécharger votre Launch Pack à votre marque : affiches, chevalets de table, un classement pour la TV et des visuels pour les réseaux, prêts à imprimer et à publier.", cta: "Terminer la configuration et obtenir mon Launch Pack", trial: "Votre essai de 7 jours a commencé — annulez dans les 7 jours et vous ne payez rien.", sign: "La moindre question, répondez simplement à cet email." },
    de: { s: `${opts.venueName} — Einrichtung in 2 Minuten abschließen`, hi: "Hallo ", lead: "Ihre SuperBrain-Testphase für Lokale hat begonnen.", body: "Schließen Sie die Einrichtung ab, um Ihre Wettbewerbe zu wählen, Logo und Farben hinzuzufügen und Ihr gebrandetes Launch Pack herunterzuladen: Poster, Tischaufsteller, eine TV-Tabelle und Social-Grafiken – fertig zum Drucken und Posten.", cta: "Einrichtung abschließen & Launch Pack holen", trial: "Ihre 7-tägige Testphase hat begonnen – innerhalb von 7 Tagen kündbar, dann zahlen Sie nichts.", sign: "Bei Fragen antworten Sie einfach auf diese E-Mail." },
  }[L];

  return getResend().emails.send({
    from: VENUE_FROM,
    to: opts.to,
    subject: t.s,
    html: shell(`
      <p style="font-size:16px;color:#0B0B0D;margin:0 0 14px;">${opts.ownerName ? `${t.hi}${opts.ownerName},` : `${t.hi.trim()},`}</p>
      <p style="font-size:17px;color:#0B0B0D;margin:0 0 8px;font-weight:bold;">${t.lead}</p>
      <p style="font-size:14px;color:#5a6b5f;line-height:1.6;margin:0 0 22px;">${t.body}</p>
      <div style="text-align:center;margin:0 0 22px;">
        <a href="${opts.setupUrl}" style="display:inline-block;background:#E8C15A;color:#2A2205;
           text-decoration:none;padding:14px 28px;border-radius:8px;font-family:sans-serif;
           font-weight:bold;font-size:15px;">${t.cta}</a>
      </div>
      <p style="font-size:12px;color:#7a8f82;border-top:1px solid #e6e0d6;padding-top:16px;margin:0 0 8px;">${t.trial}</p>
      <p style="font-size:13px;color:#5a6b5f;margin:0;">${t.sign}</p>
    `),
    replyTo: process.env.VENUE_REPLY_TO || undefined,
  });
}

/** Payment failed — sent before the league is suspended (Workflow 3). */
export async function sendPaymentFailed(opts: {
  to: string; venueName: string; language: string; updateUrl: string; daysLeft: number;
}) {
  const L = lang(opts.language);
  const t = {
    en: { s: `${opts.venueName} — payment failed`, b: `We could not take this month's payment. Your league stays live for ${opts.daysLeft} more days, then it pauses until the card is updated.`, c: "Update payment method" },
    es: { s: `${opts.venueName} — pago rechazado`, b: `No hemos podido cobrar la cuota de este mes. Tu liga sigue activa ${opts.daysLeft} días más y luego se pausará hasta que actualices la tarjeta.`, c: "Actualizar método de pago" },
    it: { s: `${opts.venueName} — pagamento non riuscito`, b: `Non siamo riusciti a incassare il pagamento di questo mese. Il tuo campionato resta attivo ancora ${opts.daysLeft} giorni, poi verrà sospeso finché non aggiorni la carta.`, c: "Aggiorna metodo di pagamento" },
    fr: { s: `${opts.venueName} — paiement refusé`, b: `Nous n'avons pas pu prélever le paiement de ce mois. Votre ligue reste active encore ${opts.daysLeft} jours, puis sera suspendue jusqu'à la mise à jour de la carte.`, c: "Mettre à jour le paiement" },
    de: { s: `${opts.venueName} — Zahlung fehlgeschlagen`, b: `Die Zahlung für diesen Monat konnte nicht eingezogen werden. Ihre Liga bleibt noch ${opts.daysLeft} Tage aktiv und wird dann pausiert, bis die Karte aktualisiert ist.`, c: "Zahlungsmethode aktualisieren" },
  }[L];

  return getResend().emails.send({
    from: VENUE_FROM,
    to: opts.to,
    subject: t.s,
    html: shell(`
      <p style="font-size:15px;color:#0B0B0D;line-height:1.6;margin:0 0 22px;">${t.b}</p>
      <div style="text-align:center;">
        <a href="${opts.updateUrl}" style="display:inline-block;background:#E8C15A;color:#2A2205;
           text-decoration:none;padding:14px 28px;border-radius:8px;font-family:sans-serif;
           font-weight:bold;font-size:15px;">${t.c}</a>
      </div>`),
    replyTo: process.env.VENUE_REPLY_TO || undefined,
  });
}

/**
 * The 7-day trial is 3 days from ending.
 *
 * Two completely different emails behind one event. With a card on file this
 * is a courtesy — say what will happen so the charge is never a surprise.
 * Without one it IS the conversion ask, and it has to be explicit that the
 * league stops, because since the card-less trial shipped nothing else asks
 * for payment before Stripe cancels the subscription.
 *
 * Sent from the app rather than n8n. The webhook has always called
 * notifyN8n() for this, but N8N_VENUE_WEBHOOK_URL was never set in
 * production, so notifyN8n() returned early and no trial email has ever been
 * sent. Resend is already wired and already sends the rest of the venue
 * transactional mail, so this removes a hop instead of adding one.
 */
export async function sendTrialEnding(opts: {
  to: string; venueName: string; language: string;
  billingUrl: string; daysLeft: number; hasPaymentMethod: boolean;
}) {
  const L = lang(opts.language);
  const d = opts.daysLeft;
  const v = opts.venueName;

  const withCard = {
    en: { s: `${v} — your trial ends in ${d} days`, b: `Your free trial ends in ${d} days and your subscription starts automatically, so nothing breaks and your league keeps running. If it is not for you, cancel before then and you pay nothing.`, c: "Manage subscription" },
    es: { s: `${v} — tu prueba termina en ${d} días`, b: `Tu prueba gratuita termina en ${d} días y la suscripción empieza automáticamente, así que tu liga sigue funcionando sin interrupciones. Si no es para ti, cancela antes y no pagas nada.`, c: "Gestionar suscripción" },
    it: { s: `${v} — la prova finisce tra ${d} giorni`, b: `La tua prova gratuita finisce tra ${d} giorni e l'abbonamento parte automaticamente, così il campionato continua senza interruzioni. Se non fa per te, disdici prima e non paghi nulla.`, c: "Gestisci abbonamento" },
    fr: { s: `${v} — votre essai se termine dans ${d} jours`, b: `Votre essai gratuit se termine dans ${d} jours et l'abonnement démarre automatiquement, votre ligue continue donc sans interruption. Si cela ne vous convient pas, annulez avant et vous ne payez rien.`, c: "Gérer l'abonnement" },
    de: { s: `${v} — Ihre Testphase endet in ${d} Tagen`, b: `Ihre kostenlose Testphase endet in ${d} Tagen und das Abo startet automatisch, Ihre Liga läuft also ohne Unterbrechung weiter. Wenn es nichts für Sie ist, kündigen Sie vorher und zahlen nichts.`, c: "Abo verwalten" },
  }[L];

  const noCard = {
    en: { s: `${v} — your league stops in ${d} days`, b: `Your free trial ends in ${d} days. There is no payment method on the account, so unless one is added your league will stop and your regulars will lose their table. Adding a card takes a minute and keeps everything exactly as it is.`, c: "Keep my league running" },
    es: { s: `${v} — tu liga se detiene en ${d} días`, b: `Tu prueba gratuita termina en ${d} días. No hay ningún método de pago en la cuenta, así que si no añades uno tu liga se detendrá y tus clientes perderán su clasificación. Añadir una tarjeta lleva un minuto y todo sigue igual.`, c: "Mantener mi liga activa" },
    it: { s: `${v} — il tuo campionato si ferma tra ${d} giorni`, b: `La tua prova gratuita finisce tra ${d} giorni. Non c'è alcun metodo di pagamento sull'account, quindi se non ne aggiungi uno il campionato si fermerà e i tuoi clienti perderanno la classifica. Aggiungere una carta richiede un minuto e tutto resta com'è.`, c: "Mantieni attivo il campionato" },
    fr: { s: `${v} — votre ligue s'arrête dans ${d} jours`, b: `Votre essai gratuit se termine dans ${d} jours. Aucun moyen de paiement n'est enregistré, donc sans ajout votre ligue s'arrêtera et vos habitués perdront leur classement. Ajouter une carte prend une minute et tout reste en place.`, c: "Garder ma ligue active" },
    de: { s: `${v} — Ihre Liga stoppt in ${d} Tagen`, b: `Ihre kostenlose Testphase endet in ${d} Tagen. Es ist keine Zahlungsmethode hinterlegt, ohne eine wird Ihre Liga gestoppt und Ihre Stammgäste verlieren ihre Tabelle. Eine Karte hinzuzufügen dauert eine Minute und alles bleibt wie es ist.`, c: "Liga aktiv halten" },
  }[L];

  const t = opts.hasPaymentMethod ? withCard : noCard;

  return getResend().emails.send({
    from: VENUE_FROM,
    to: opts.to,
    subject: t.s,
    html: shell(`
      <p style="font-size:15px;color:#0B0B0D;line-height:1.6;margin:0 0 22px;">${t.b}</p>
      <div style="text-align:center;">
        <a href="${opts.billingUrl}" style="display:inline-block;background:#E8C15A;color:#2A2205;
           text-decoration:none;padding:14px 28px;border-radius:8px;font-family:sans-serif;
           font-weight:bold;font-size:15px;">${t.c}</a>
      </div>`),
    replyTo: process.env.VENUE_REPLY_TO || undefined,
  });
}

/**
 * The subscription ended and the league is now suspended.
 *
 * Previously this moment sent nothing at all — the league simply stopped and
 * the venue found out from a customer. It is also the single best win-back
 * trigger there is: the league still exists, the members are still in it, and
 * one click brings it all back. Said plainly, without guilt.
 */
export async function sendLeaguePaused(opts: {
  to: string; venueName: string; language: string; billingUrl: string;
}) {
  const L = lang(opts.language);
  const v = opts.venueName;
  const t = {
    en: { s: `${v} — your league is paused`, b: `Your subscription has ended, so the league at ${v} is paused. Nothing is deleted: your table, your members and their predictions are all still there. Restart whenever you like and it picks up exactly where it left off.`, c: "Restart my league" },
    es: { s: `${v} — tu liga está en pausa`, b: `Tu suscripción ha terminado, así que la liga de ${v} está en pausa. No se ha borrado nada: tu clasificación, tus miembros y sus pronósticos siguen ahí. Reactívala cuando quieras y continuará donde lo dejaste.`, c: "Reactivar mi liga" },
    it: { s: `${v} — il tuo campionato è in pausa`, b: `Il tuo abbonamento è terminato, quindi il campionato di ${v} è in pausa. Non è stato cancellato nulla: la classifica, i membri e i loro pronostici sono ancora lì. Riattivalo quando vuoi e riprenderà esattamente da dove era rimasto.`, c: "Riattiva il campionato" },
    fr: { s: `${v} — votre ligue est en pause`, b: `Votre abonnement a pris fin, la ligue de ${v} est donc en pause. Rien n'est supprimé : votre classement, vos membres et leurs pronostics sont toujours là. Relancez quand vous voulez et tout reprend exactement où vous en étiez.`, c: "Relancer ma ligue" },
    de: { s: `${v} — Ihre Liga pausiert`, b: `Ihr Abo ist beendet, daher pausiert die Liga im ${v}. Es wurde nichts gelöscht: Tabelle, Mitglieder und deren Tipps sind weiterhin vorhanden. Starten Sie jederzeit neu, es geht genau dort weiter, wo Sie aufgehört haben.`, c: "Liga neu starten" },
  }[L];

  return getResend().emails.send({
    from: VENUE_FROM,
    to: opts.to,
    subject: t.s,
    html: shell(`
      <p style="font-size:15px;color:#0B0B0D;line-height:1.6;margin:0 0 22px;">${t.b}</p>
      <div style="text-align:center;">
        <a href="${opts.billingUrl}" style="display:inline-block;background:#E8C15A;color:#2A2205;
           text-decoration:none;padding:14px 28px;border-radius:8px;font-family:sans-serif;
           font-weight:bold;font-size:15px;">${t.c}</a>
      </div>`),
    replyTo: process.env.VENUE_REPLY_TO || undefined,
  });
}
