# Cold outreach sequences — paste into Instantly

Four campaigns, one per mailable country. **Germany and Austria have no campaign
and must not get one** — `campaignFor()` in `lib/instantly.ts` returns `null` for
DE/AT because UWG §7 requires prior consent for B2B cold email there. German
venues stay in the CRM for phone and LinkedIn.

## Merge variables

These are exactly what `pushLead()` sends. Anything else renders blank.

| Variable | Example | Notes |
|---|---|---|
| `{{companyName}}` | `The Offside` | The venue name |
| `{{firstName}}` | `Dave` | Often empty — never open a sentence with it |
| `{{city}}` | `Manchester` | Can be empty |
| `{{city_phrase}}` | `in Manchester` | Empty string when city is unknown, so the sentence still reads |
| `{{competition}}` | `Premier League` | Their country's league |
| `{{league_name}}` | `The Offside Premier League Cup` | Pre-built league name |
| `{{signup_url}}` | `…/venues/start?v=<id>` | **Carries the CRM row id — never replace with a bare link or attribution breaks** |
| `{{demo_url}}` | `…/venues` | The live demo |

Use `{{city_phrase}}`, not `{{city}}`, in prose. A venue with no city renders
"a bar in " with the raw variable and looks like exactly what it is.

## Settings for every campaign

- **Plain text only.** No images, no HTML signature, no tracking pixel on step 1.
- **Open tracking off on step 1.** A pixel on a first touch to a cold domain
  measurably hurts deliverability, and open rate is the least useful number here
  anyway. Turn it on from step 2.
- **Link tracking on** — reply and click are what the CRM funnel actually uses.
- Daily cap per mailbox: **30**, ramping. `OUTREACH_DAILY_CAP` caps the push side.
- Stop on reply: **yes**.
- Send window: 08:00–17:00 local, weekdays.

---

## 🇬🇧 English — `INSTANTLY_CAMPAIGN_GB`

### Step 1 — day 0

**Subject:** `{{competition}} at {{companyName}}`

```
Hi,

Do your regulars talk about the football at the bar? Most sports pubs
{{city_phrase}} have a crowd that would happily argue about scorelines all
week — they just have nowhere to do it between matches.

We set up a prediction league in your name. Yours would be called
{{league_name}}. Customers scan a QR code on the table, predict that
weekend's {{competition}} matches, and the table updates live on your
screens. They come back to see where they finished.

You can see a real one here: {{demo_url}}

Worth a look?

Dylan
SuperBrain
```

### Step 2 — day 3

**Subject:** `Re: {{competition}} at {{companyName}}`

```
Hi,

Following up on the prediction league for {{companyName}}.

The part most owners care about: you can see how many of your regulars
played each week, and whether that number holds up. It is the only way I
know to measure whether a promotion actually brought people back.

Free for 7 days, and it takes about two minutes to set up:
{{signup_url}}

Dylan
```

### Step 3 — day 8

**Subject:** `Closing the loop`

```
Hi,

Last one from me — I won't keep filling your inbox.

If a prediction league for {{companyName}} is ever of interest, everything
is here: {{signup_url}}

Either way, good luck this season.

Dylan
```

---

## 🇪🇸 Spanish — `INSTANTLY_CAMPAIGN_ES`

### Step 1 — day 0

**Subject:** `{{competition}} en {{companyName}}`

```
Hola,

¿Tus clientes habituales hablan de fútbol en la barra? La mayoría de los
bares {{city_phrase}} tienen un grupo que discutiría de resultados toda la
semana, pero no tienen dónde hacerlo entre partido y partido.

Creamos una liga de pronósticos con el nombre de tu local. La tuya se
llamaría {{league_name}}. Tus clientes escanean un código QR en la mesa,
pronostican los partidos de {{competition}} del fin de semana y la
clasificación se actualiza en directo en tus pantallas. Vuelven para ver
cómo han quedado.

Puedes ver una de verdad aquí: {{demo_url}}

¿Le echas un vistazo?

Dylan
SuperBrain
```

### Step 2 — day 3

**Subject:** `Re: {{competition}} en {{companyName}}`

```
Hola,

Te escribo por la liga de pronósticos para {{companyName}}.

Lo que más interesa a los dueños: ves cuántos de tus clientes han jugado
cada semana y si esa cifra se mantiene. Es la única forma que conozco de
medir si una promoción realmente ha hecho volver a la gente.

Gratis 7 días y se configura en dos minutos:
{{signup_url}}

Dylan
```

### Step 3 — day 8

**Subject:** `Lo dejo aquí`

```
Hola,

Este es el último correo, no quiero llenarte la bandeja.

Si en algún momento te interesa una liga de pronósticos para
{{companyName}}, está todo aquí: {{signup_url}}

En cualquier caso, mucha suerte esta temporada.

Dylan
```

---

## 🇫🇷 French — `INSTANTLY_CAMPAIGN_FR`

### Step 1 — day 0

**Subject:** `La {{competition}} au {{companyName}}`

```
Bonjour,

Est-ce que vos habitués parlent football au comptoir ? La plupart des bars
{{city_phrase}} ont un groupe prêt à débattre des scores toute la semaine,
mais sans endroit pour le faire entre deux matchs.

Nous créons une ligue de pronostics au nom de votre établissement. La vôtre
s'appellerait {{league_name}}. Vos clients scannent un QR code sur la table,
pronostiquent les matchs de {{competition}} du week-end, et le classement se
met à jour en direct sur vos écrans. Ils reviennent voir où ils ont fini.

Vous pouvez en voir une vraie ici : {{demo_url}}

Ça vous intéresse ?

Dylan
SuperBrain
```

### Step 2 — day 3

**Subject:** `Re: la {{competition}} au {{companyName}}`

```
Bonjour,

Je reviens vers vous au sujet de la ligue de pronostics pour
{{companyName}}.

Ce qui intéresse le plus les gérants : vous voyez combien d'habitués ont
joué chaque semaine, et si ce chiffre tient. C'est la seule façon que je
connaisse de mesurer si une animation a vraiment fait revenir du monde.

Gratuit 7 jours, deux minutes à mettre en place :
{{signup_url}}

Dylan
```

### Step 3 — day 8

**Subject:** `Je n'insiste pas`

```
Bonjour,

Dernier message de ma part, je ne vais pas encombrer votre boîte.

Si une ligue de pronostics pour {{companyName}} vous intéresse un jour,
tout est ici : {{signup_url}}

Bonne saison à vous.

Dylan
```

---

## 🇮🇹 Italian — `INSTANTLY_CAMPAIGN_IT`

### Step 1 — day 0

**Subject:** `La {{competition}} da {{companyName}}`

```
Buongiorno,

I vostri clienti abituali parlano di calcio al bancone? Quasi tutti i
locali {{city_phrase}} hanno un gruppo pronto a discutere di risultati per
tutta la settimana, ma non hanno dove farlo tra una partita e l'altra.

Creiamo un campionato di pronostici col nome del vostro locale. Il vostro si
chiamerebbe {{league_name}}. I clienti inquadrano un QR code sul tavolo,
pronosticano le partite di {{competition}} del weekend e la classifica si
aggiorna in diretta sui vostri schermi. Tornano per vedere come sono andati.

Qui potete vederne uno vero: {{demo_url}}

Vi interessa?

Dylan
SuperBrain
```

### Step 2 — day 3

**Subject:** `Re: la {{competition}} da {{companyName}}`

```
Buongiorno,

Torno sul campionato di pronostici per {{companyName}}.

La parte che interessa di più ai gestori: vedete quanti clienti hanno
giocato ogni settimana e se quel numero tiene. È l'unico modo che conosco
per capire se un'iniziativa ha davvero riportato gente dentro.

Gratis per 7 giorni, si attiva in due minuti:
{{signup_url}}

Dylan
```

### Step 3 — day 8

**Subject:** `Ultimo messaggio`

```
Buongiorno,

Questo è l'ultimo messaggio, non voglio intasarvi la casella.

Se un campionato di pronostici per {{companyName}} dovesse interessarvi,
trovate tutto qui: {{signup_url}}

In bocca al lupo per la stagione.

Dylan
```

---

## What is deliberately not in this copy

- **No invented numbers.** No "400 venues already signed up", no "+30% midweek
  covers". There is no data behind either, and a bar owner who checks will
  never reply again.
- **No urgency or scarcity.** Nothing expires, so saying it does is a lie that
  also reads as spam.
- **No attachments, no images.** Both hurt cold deliverability.
- **No first name in the opening line.** `{{firstName}}` is empty for most
  scraped venues, and "Hi ," is worse than "Hi,".
