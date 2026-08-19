/**
 * lib/prospecting.ts — Google Places sweep for sports venues.
 *
 * Uses the Places API (New): POST places:searchText, which returns up to 20
 * results per page and at most 3 pages (60) per query. So coverage comes from
 * MANY narrow queries — term × city — not from one broad one. The city lists
 * below are sized to reach ~50k venues across the four mailable countries.
 *
 * Germany and Austria are deliberately absent from OUTREACH_COUNTRIES: their
 * venues can still be scraped and worked by phone, but they are never pushed
 * to an email campaign (UWG §7 — see lib/instantly.ts).
 */

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.primaryType",
  "places.addressComponents",
  "nextPageToken",
].join(",");

/** Search terms in each country's own language — English misses local listings. */
export const SEARCH_TERMS: Record<string, string[]> = {
  GB: ["sports bar", "pub showing football", "football pub", "sports pub"],
  ES: ["bar deportivo", "bar para ver el fútbol", "cervecería con fútbol", "pub deportivo"],
  FR: ["bar sportif", "bar pour regarder le foot", "pub sportif", "brasserie sport"],
  IT: ["sport bar", "bar per vedere il calcio", "pub sportivo", "birreria con calcio"],
  DE: ["Sportbar", "Kneipe Fußball schauen", "Sportkneipe", "Public Viewing Kneipe"],
};

/** Cities per country, largest first — the sweep works down this list. */
export const CITIES: Record<string, string[]> = {
  GB: ["London", "Birmingham", "Manchester", "Leeds", "Liverpool", "Sheffield", "Bristol",
       "Newcastle upon Tyne", "Nottingham", "Leicester", "Southampton", "Portsmouth",
       "Brighton", "Glasgow", "Edinburgh", "Cardiff", "Belfast", "Coventry", "Hull",
       "Stoke-on-Trent", "Derby", "Wolverhampton", "Plymouth", "Reading", "Luton",
       "Middlesbrough", "Sunderland", "Norwich", "Swansea", "Milton Keynes"],
  ES: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia",
       "Palma", "Las Palmas", "Bilbao", "Alicante", "Córdoba", "Valladolid", "Vigo",
       "Gijón", "Granada", "A Coruña", "Vitoria-Gasteiz", "Elche", "Santa Cruz de Tenerife",
       "Pamplona", "Almería", "San Sebastián", "Santander", "Marbella"],
  FR: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier",
       "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims", "Saint-Étienne", "Toulon",
       "Le Havre", "Grenoble", "Dijon", "Angers", "Nîmes", "Villeurbanne", "Clermont-Ferrand",
       "Le Mans", "Aix-en-Provence", "Brest", "Tours"],
  IT: ["Roma", "Milano", "Napoli", "Torino", "Palermo", "Genova", "Bologna", "Firenze",
       "Bari", "Catania", "Venezia", "Verona", "Messina", "Padova", "Trieste", "Brescia",
       "Parma", "Taranto", "Prato", "Modena", "Reggio Calabria", "Reggio Emilia",
       "Perugia", "Ravenna", "Livorno"],
  DE: ["Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart",
       "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Hannover",
       "Nürnberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster"],
};

/** Countries whose venues may be emailed. DE is scraped but never emailed. */
export const OUTREACH_COUNTRIES = ["GB", "ES", "FR", "IT"];

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviews: number | null;
  types: string[];
  primaryType: string | null;
}

interface SearchPage { places: PlaceResult[]; nextPageToken: string | null }

/** One page of a text search. Returns the token to continue with, if any. */
export async function searchPlaces(
  query: string, languageCode: string, regionCode: string, pageToken?: string,
): Promise<SearchPage> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY missing");

  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode,
      regionCode,
      maxResultCount: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json: any = await res.json();

  return {
    nextPageToken: json.nextPageToken ?? null,
    places: (json.places ?? []).map((p: any): PlaceResult => ({
      placeId:     p.id,
      name:        p.displayName?.text ?? "Unknown",
      address:     p.formattedAddress ?? null,
      city:        cityFrom(p.addressComponents),
      website:     p.websiteUri ?? null,
      phone:       p.nationalPhoneNumber ?? null,
      rating:      typeof p.rating === "number" ? p.rating : null,
      reviews:     typeof p.userRatingCount === "number" ? p.userRatingCount : null,
      types:       p.types ?? [],
      primaryType: p.primaryType ?? null,
    })),
  };
}

/** Locality from Places address components, falling back to the admin area. */
function cityFrom(components: any[] | undefined): string | null {
  if (!components) return null;
  const byType = (t: string) =>
    components.find((c) => (c.types ?? []).includes(t))?.longText ?? null;
  return byType("locality") ?? byType("postal_town") ?? byType("administrative_area_level_2");
}

/**
 * Cheap pre-filter, run before any AI call.
 *
 * Places text search for "sports bar" happily returns hotels, gyms and shisha
 * lounges. Rejecting the obvious misses here means we only pay for enrichment
 * on plausible venues — at 50k prospects that difference is most of the bill.
 */
const REJECT_TYPES = new Set([
  "lodging", "hotel", "gym", "fitness_center", "stadium", "school", "hospital",
  "supermarket", "shopping_mall", "gas_station", "car_dealer", "bank",
  "sporting_goods_store", "clothing_store", "liquor_store", "convenience_store",
]);

const ACCEPT_TYPES = new Set([
  "bar", "pub", "restaurant", "night_club", "cafe", "meal_takeaway", "food",
]);

export function prefilter(p: PlaceResult): { keep: boolean; reason?: string } {
  if (p.types.some((t) => REJECT_TYPES.has(t))) return { keep: false, reason: "excluded place type" };
  if (!p.types.some((t) => ACCEPT_TYPES.has(t)))  return { keep: false, reason: "not a bar/pub/restaurant" };
  if ((p.reviews ?? 0) < 10)                       return { keep: false, reason: "under 10 reviews — likely closed or tiny" };
  return { keep: true };
}
