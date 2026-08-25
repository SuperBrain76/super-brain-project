"use client";

/**
 * /venues/start?v=<venue-id> — where every cold email lands.
 *
 * The `v` parameter is the CRM row id carried through from the outreach merge
 * variable, so a venue that converts keeps ONE row from prospect to customer
 * and the funnel attribution survives. Without it the page still works — it
 * just collects the venue's details from scratch.
 *
 * Everything is prefilled from get_venue_prefill(): their name, city, and the
 * league for their country. A bar owner reading this on a phone behind the bar
 * should be able to reach Stripe in three taps.
 *
 * Deliberately no invented numbers. There is no "join 400 venues already
 * playing" line, because that would not be true.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { leadTrackOnce } from "@/lib/leadTrack";

type Lang = "en" | "es" | "fr" | "it" | "de";

interface Prefill {
  found: boolean; venue_name: string; city: string | null; country: string;
  language: string; website: string | null; competition_slug: string;
  already_live: boolean; venue_slug: string | null;
}

/** Every competition is included — a marketing promise, not a picker. Proper
 *  nouns stay the same across languages; the headings below are localised. */
const INCLUDED = [
  "Premier League", "Champions League", "La Liga", "Bundesliga",
  "Serie A", "Ligue 1", "SHL", "NHL", "Premiership Rugby",
];

const COPY: Record<Lang, {
  kicker: string; h1: (v: string) => string; sub: string;
  b1: string; b2: string; b3: string;
  includedTitle: string; futureNote: string;
  venue: string; yourName: string; email: string; phone: string;
  monthly: string; annual: string; annualNote: string;
  cta: string; trial: string; busy: string;
  liveTitle: string; liveBody: string; liveCta: string;
  required: string; failed: string;
}> = {
  en: {
    kicker: "For sports bars",
    h1: (v) => `Give ${v} its own prediction league`,
    sub: "Your regulars predict every match on their phones. The table updates live on your screens. They come back to see where they finished.",
    b1: "Your name, your colours, your league",
    b2: "A table poster with a QR code — customers join in 20 seconds",
    b3: "You see who is playing, and whether they keep coming back",
    includedTitle: "One subscription — every competition included",
    futureNote: "Future competitions included automatically",
    venue: "Venue name", yourName: "Your name",
    email: "Email", phone: "Phone (optional)",
    monthly: "€99 / month", annual: "€990 / year", annualNote: "two months free",
    cta: "Start 7-day free trial", trial: "No card needed. Your league goes live today. Add payment only if you want to keep it after 7 days.",
    busy: "Taking you to checkout…",
    liveTitle: "You're already set up", liveBody: "This venue already has a live league.",
    liveCta: "Open your league",
    required: "Please fill in the venue name and your email.",
    failed: "Could not start checkout. Please try again or reply to our email.",
  },
  es: {
    kicker: "Para bares deportivos",
    h1: (v) => `Dale a ${v} su propia liga de pronósticos`,
    sub: "Tus clientes pronostican cada partido desde el móvil. La clasificación se actualiza en directo en tus pantallas. Vuelven para ver cómo han quedado.",
    b1: "Tu nombre, tus colores, tu liga",
    b2: "Un cartel de mesa con código QR: se unen en 20 segundos",
    b3: "Ves quién juega y si siguen volviendo",
    includedTitle: "Una suscripción: todas las competiciones incluidas",
    futureNote: "Competiciones futuras incluidas automáticamente",
    venue: "Nombre del local", yourName: "Tu nombre",
    email: "Email", phone: "Teléfono (opcional)",
    monthly: "99 € / mes", annual: "990 € / año", annualNote: "dos meses gratis",
    cta: "Empezar prueba de 7 días", trial: "Sin tarjeta. Tu liga se activa hoy. Añade el pago solo si quieres continuar tras 7 días.",
    busy: "Te llevamos al pago…",
    liveTitle: "Ya lo tienes activo", liveBody: "Este local ya tiene una liga en marcha.",
    liveCta: "Abrir mi liga",
    required: "Introduce el nombre del local y tu email.",
    failed: "No se ha podido iniciar el pago. Inténtalo de nuevo o responde a nuestro email.",
  },
  fr: {
    kicker: "Pour les bars sportifs",
    h1: (v) => `Offrez à ${v} sa propre ligue de pronostics`,
    sub: "Vos habitués pronostiquent chaque match depuis leur téléphone. Le classement se met à jour en direct sur vos écrans. Ils reviennent voir où ils ont fini.",
    b1: "Votre nom, vos couleurs, votre ligue",
    b2: "Une affichette de table avec QR code : ils rejoignent en 20 secondes",
    b3: "Vous voyez qui joue, et s'ils reviennent",
    includedTitle: "Un seul abonnement : toutes les compétitions incluses",
    futureNote: "Compétitions futures incluses automatiquement",
    venue: "Nom de l'établissement", yourName: "Votre nom",
    email: "Email", phone: "Téléphone (facultatif)",
    monthly: "99 € / mois", annual: "990 € / an", annualNote: "deux mois offerts",
    cta: "Démarrer l'essai de 7 jours", trial: "Sans carte. Votre ligue est active aujourd'hui. Ajoutez le paiement seulement pour continuer après 7 jours.",
    busy: "Redirection vers le paiement…",
    liveTitle: "C'est déjà en place", liveBody: "Cet établissement a déjà une ligue active.",
    liveCta: "Ouvrir ma ligue",
    required: "Indiquez le nom de l'établissement et votre email.",
    failed: "Impossible de démarrer le paiement. Réessayez ou répondez à notre email.",
  },
  it: {
    kicker: "Per gli sport bar",
    h1: (v) => `Dai a ${v} il suo campionato di pronostici`,
    sub: "I tuoi clienti pronosticano ogni partita dal telefono. La classifica si aggiorna in diretta sui tuoi schermi. Tornano per vedere come sono andati.",
    b1: "Il tuo nome, i tuoi colori, il tuo campionato",
    b2: "Una locandina da tavolo con QR code: entrano in 20 secondi",
    b3: "Vedi chi gioca e se continuano a tornare",
    includedTitle: "Un unico abbonamento: tutte le competizioni incluse",
    futureNote: "Competizioni future incluse automaticamente",
    venue: "Nome del locale", yourName: "Il tuo nome",
    email: "Email", phone: "Telefono (facoltativo)",
    monthly: "99 € / mese", annual: "990 € / anno", annualNote: "due mesi gratis",
    cta: "Inizia la prova di 7 giorni", trial: "Nessuna carta. La tua lega parte oggi. Aggiungi il pagamento solo per continuare dopo 7 giorni.",
    busy: "Ti portiamo al pagamento…",
    liveTitle: "È già attivo", liveBody: "Questo locale ha già un campionato attivo.",
    liveCta: "Apri il campionato",
    required: "Inserisci il nome del locale e la tua email.",
    failed: "Impossibile avviare il pagamento. Riprova o rispondi alla nostra email.",
  },
  de: {
    kicker: "Für Sportbars",
    h1: (v) => `Geben Sie ${v} eine eigene Tippliga`,
    sub: "Ihre Stammgäste tippen jedes Spiel am Handy. Die Tabelle aktualisiert sich live auf Ihren Bildschirmen. Sie kommen wieder, um zu sehen, wo sie gelandet sind.",
    b1: "Ihr Name, Ihre Farben, Ihre Liga",
    b2: "Ein Tischaufsteller mit QR-Code — Gäste sind in 20 Sekunden dabei",
    b3: "Sie sehen, wer mitspielt und ob sie wiederkommen",
    includedTitle: "Ein Abo – alle Wettbewerbe inklusive",
    futureNote: "Zukünftige Wettbewerbe automatisch inklusive",
    venue: "Name des Lokals", yourName: "Ihr Name",
    email: "E-Mail", phone: "Telefon (optional)",
    monthly: "99 € / Monat", annual: "990 € / Jahr", annualNote: "zwei Monate gratis",
    cta: "7 Tage kostenlos testen", trial: "Keine Karte nötig. Ihre Liga startet heute. Zahlung nur, wenn Sie nach 7 Tagen weitermachen möchten.",
    busy: "Weiter zur Kasse…",
    liveTitle: "Schon eingerichtet", liveBody: "Dieses Lokal hat bereits eine aktive Liga.",
    liveCta: "Zur Liga",
    required: "Bitte Name des Lokals und E-Mail angeben.",
    failed: "Zahlung konnte nicht gestartet werden. Bitte erneut versuchen oder auf unsere E-Mail antworten.",
  },
};

const INK = "#12100E", AMBER = "#F5B301", CREAM = "#FBF5E9", MUTED = "#B7AC97";
const LINE = "rgba(255,255,255,0.12)";

function VenueStartPageInner() {
  const params  = useSearchParams();
  const venueId = params.get("v");
  const comp    = params.get("comp");   // complimentary-access secret (validated server-side)
  const isComp  = !!comp;

  const [pre, setPre]   = useState<Prefill | null>(null);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const [form, setForm] = useState({
    venueName: "", ownerName: "", email: "", phone: "", country: "GB", language: "en",
  });

  // Funnel: landing on the signup page is a click-through (the email's
  // signup_url points straight here). signup_started fires on first interaction.
  useEffect(() => { leadTrackOnce("landing_viewed"); }, []);

  useEffect(() => {
    if (!venueId) return;
    supabase.rpc("get_venue_prefill", { p_id: venueId }).then(({ data }) => {
      const p = data as Prefill | null;
      if (!p?.found) return;
      setPre(p);
      setForm((f) => ({
        ...f,
        venueName: p.venue_name,
        country: p.country,
        language: p.language,
      }));
    });
  }, [venueId]);

  const t = useMemo(() => COPY[(form.language as Lang)] ?? COPY.en, [form.language]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.venueName.trim() || !form.email.trim()) { setErr(t.required); return; }
    setErr(""); setBusy(true);

    try {
      const res = await fetch("/api/venues/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venueId, plan, comp,
          venueName: form.venueName,
          ownerName: form.ownerName,
          email: form.email,
          phone: form.phone,
          country: form.country,
          language: form.language,
          city: pre?.city ?? null,
          website: pre?.website ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "no url");
      window.location.href = json.url;          // → Stripe Checkout
    } catch {
      setBusy(false);
      setErr(t.failed);
    }
  }

  // Already a customer — sell nothing, just get them to their league.
  if (pre?.already_live) {
    return (
      <Shell>
        <h1 className="text-3xl font-black mb-3">{t.liveTitle}</h1>
        <p className="mb-7" style={{ color: MUTED }}>{t.liveBody}</p>
        {pre.venue_slug && (
          <a href={`/v/${pre.venue_slug}`} className="inline-block font-black px-6 py-3 rounded-full"
             style={{ background: AMBER, color: INK }}>{t.liveCta} →</a>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-[11px] uppercase tracking-[0.3em] mb-3" style={{ color: AMBER }}>{t.kicker}</p>
      <h1 className="text-3xl sm:text-5xl font-black leading-[1.02] mb-4">
        {t.h1(form.venueName || (pre?.venue_name ?? "your venue"))}
      </h1>
      <p className="text-base mb-8 max-w-xl" style={{ color: MUTED }}>{t.sub}</p>

      <ul className="mb-8 flex flex-col gap-2.5">
        {[t.b1, t.b2, t.b3].map((b) => (
          <li key={b} className="flex gap-3 items-start text-sm">
            <span style={{ color: AMBER }}>✓</span>
            <span style={{ color: CREAM }}>{b}</span>
          </li>
        ))}
      </ul>

      {/* Everything included — one subscription, every competition */}
      <div className="mb-10 rounded-2xl p-5" style={{ background: "rgba(245,179,1,0.06)", border: `1px solid ${LINE}` }}>
        <p className="text-[13px] font-black mb-3" style={{ color: CREAM }}>{t.includedTitle}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {INCLUDED.map((c) => (
            <div key={c} className="flex gap-2 items-center text-[13px]">
              <span style={{ color: AMBER }}>✓</span><span style={{ color: CREAM }}>{c}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] mt-3 flex gap-2 items-center" style={{ color: MUTED }}>
          <span style={{ color: AMBER }}>✓</span>{t.futureNote}
        </p>
      </div>

      {/* Plan — hidden for complimentary access (it's free) */}
      {isComp ? (
        <div className="mb-8 rounded-2xl p-5 flex items-center gap-3" style={{ background: "rgba(53,197,111,0.10)", border: "1px solid rgba(53,197,111,0.4)" }}>
          <span className="text-2xl">🎁</span>
          <div>
            <div className="text-sm font-black" style={{ color: "#7DE8A8" }}>Complimentary access</div>
            <div className="text-[13px]" style={{ color: CREAM }}>Free for as long as you like — no card, no charge.</div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 mb-8 flex-wrap">
          <PlanCard active={plan === "monthly"} onClick={() => setPlan("monthly")} label={t.monthly} />
          <PlanCard active={plan === "annual"}  onClick={() => setPlan("annual")}  label={t.annual} note={t.annualNote} />
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4 max-w-md">
        <Field label={t.venue} value={form.venueName}
               onChange={(v) => { leadTrackOnce("signup_started"); setForm({ ...form, venueName: v }); }} required />

        <Field label={t.yourName} value={form.ownerName} onChange={(v) => setForm({ ...form, ownerName: v })} />
        <Field label={t.email} type="email" value={form.email}
               onChange={(v) => setForm({ ...form, email: v })} required />
        <Field label={t.phone} type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />

        {err && <p className="text-sm" style={{ color: "#FF6A6A" }}>{err}</p>}

        <button type="submit" disabled={busy}
                className="mt-2 font-black px-6 py-4 rounded-full text-base disabled:opacity-60"
                style={{ background: AMBER, color: INK }}>
          {busy ? t.busy : isComp ? "Activate free access →" : t.cta}
        </button>
        <p className="text-xs" style={{ color: MUTED }}>
          {isComp ? "No card required. Complimentary access — free for as long as you like." : t.trial}
        </p>
      </form>
    </Shell>
  );
}

// ── Pieces ────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: INK, color: CREAM, minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-5 py-14">{children}</div>
    </div>
  );
}

function PlanCard({ active, onClick, label, note }: {
  active: boolean; onClick: () => void; label: string; note?: string;
}) {
  return (
    <button type="button" onClick={onClick}
            className="px-5 py-3 rounded-xl text-left"
            style={{
              background: active ? "rgba(245,179,1,0.10)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? AMBER : LINE}`,
            }}>
      <div className="font-black text-lg" style={{ color: active ? AMBER : CREAM }}>{label}</div>
      {note && <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{note}</div>}
    </button>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: MUTED }}>{label}</span>
      <input type={type} value={value} required={required}
             onChange={(e) => onChange(e.target.value)}
             className="px-4 py-3 rounded-lg text-base"
             style={{ background: "rgba(255,255,255,0.05)", color: CREAM, border: `1px solid ${LINE}` }} />
    </label>
  );
}

/**
 * useSearchParams() forces client-side bailout, which Next 14 requires to sit
 * behind a Suspense boundary — without it the production build fails at
 * prerender rather than at runtime.
 */
export default function VenueStartPage() {
  return (
    <Suspense fallback={
      <div style={{ background: INK, color: MUTED, minHeight: "100vh" }}
           className="flex items-center justify-center">
        <p className="text-sm">Loading…</p>
      </div>
    }>
      <VenueStartPageInner />
    </Suspense>
  );
}
