import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Pages renvoyées par Airbnb quand il ne sert pas l'annonce
// (redirection de langue/pays, blocage, captcha...). Depuis août 2026 l'edge
// function recevait « Redirection vers www.airbnb.fr » et l'enregistrait
// comme nom du logement.
const NOT_A_LISTING_TITLE = /^(redirection vers|redirecting to|weiterleitung|redirigiendo|access denied|attention required|just a moment|airbnb\s*[:|-]|airbnb$)/i;

function isNotAListingName(name: string | null): boolean {
  if (!name) return true;
  return NOT_A_LISTING_TITLE.test(name.trim());
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
}

function metaContent(html: string, prop: string): string | null {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i");
  const re2 = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, "i");
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]).trim() || null : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── RATE LIMITING ──
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { data: count } = await supabase.rpc('increment_rate_limit', {
    p_key: `scrape_airbnb:${ip}`,
    p_window_seconds: 3600
  });
  if ((count || 0) > 10) { // max 10 imports/heure par IP
    return jsonResponse({ error: 'Trop de requêtes — réessayez dans 1h' }, 429);
  }

  try {
    const { url } = await req.json();

    // ── VALIDATION URL stricte ──
    if (!url || typeof url !== 'string') {
      return jsonResponse({ error: "URL manquante" }, 400);
    }

    // Accepter uniquement airbnb.com/rooms/ID (pas de SSRF)
    const airbnbRegex = /^https:\/\/www\.airbnb\.[a-z.]+\/rooms\/\d+(\?.*)?$/;
    if (!airbnbRegex.test(url)) {
      return jsonResponse({ error: "URL Airbnb invalide" }, 400);
    }

    // Normaliser — supprimer les paramètres
    const cleanUrl = 'https://www.airbnb.com/rooms/' + url.match(/\/rooms\/(\d+)/)?.[1];

    const res = await fetch(cleanUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      }
    });

    if (!res.ok) {
      return jsonResponse({ error: `Airbnb a retourné ${res.status}`, code: "airbnb_unreadable" }, 502);
    }

    const html = await res.text();

    const data: any = {
      name: null, location: null, city: null, type: null,
      guests: null, bedrooms: null, beds: null, bathrooms: null,
      checkin_time: null, checkout_time: null, description: null,
      amenities: [], rules: [], rating: null, reviews_count: null,
      host_name: null, host_avatar: null, cover_emoji: "🏠", airbnb_url: cleanUrl,
    };

    // ── JSON-LD ──
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const json = JSON.parse(block.replace(/<script type="application\/ld\+json">/, '').replace(/<\/script>/, ''));
          if (json.name) data.name = json.name;
          if (json.description) data.description = json.description.substring(0, 500);
          if (json.address) {
            if (json.address.addressLocality) data.city = json.address.addressLocality;
            if (json.address.addressRegion) {
              data.location = [json.address.addressLocality, json.address.addressRegion, json.address.addressCountry].filter(Boolean).join(", ");
            }
          }
          if (json.aggregateRating) {
            data.rating = json.aggregateRating.ratingValue;
            data.reviews_count = json.aggregateRating.reviewCount;
          }
        } catch(e) {}
      }
    }

    // ── NEXT_DATA ──
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const props = nextData?.props?.pageProps;
        const listing = props?.listing ||
                        props?.reduxData?.homePDP?.listingInfo?.listing ||
                        findNested(nextData, 'listing') ||
                        findNested(nextData, 'pdpListingDetail');

        if (listing) {
          if (listing.name && !data.name) data.name = listing.name;
          if (listing.city) data.city = listing.city;
          if (listing.publicAddress) data.location = listing.publicAddress;
          if (listing.personCapacity) data.guests = listing.personCapacity;
          if (listing.bedroomLabel) data.bedrooms = listing.bedroomLabel;
          if (listing.bedLabel) data.beds = listing.bedLabel;
          if (listing.bathroomLabel) data.bathrooms = listing.bathroomLabel;
          if (listing.roomType) data.type = listing.roomType;
          if (listing.hostName) data.host_name = listing.hostName;
          if (listing.primaryHost?.name) data.host_name = listing.primaryHost.name;
          if (listing.sectionedDescription?.summary) {
            data.description = listing.sectionedDescription.summary.substring(0, 500);
          }
        }

        const checkInTime = findValueByKey(nextData, 'checkInTime') || findValueByKey(nextData, 'checkin_time');
        const checkOutTime = findValueByKey(nextData, 'checkOutTime') || findValueByKey(nextData, 'checkout_time');
        if (checkInTime) data.checkin_time = formatTime(checkInTime);
        if (checkOutTime) data.checkout_time = formatTime(checkOutTime);

        const amenities = findAllValuesByKey(nextData, 'amenities');
        if (amenities.length > 0) {
          const amenityNames: string[] = [];
          for (const group of amenities) {
            if (Array.isArray(group)) {
              for (const item of group) {
                if (item?.name && !item.name.includes('Indisponible')) amenityNames.push(item.name);
                if (item?.title && !item.title.includes('unavailable')) amenityNames.push(item.title);
              }
            }
          }
          data.amenities = [...new Set(amenityNames)].slice(0, 20);
        }

        const houseRules = findValueByKey(nextData, 'houseRules') || findValueByKey(nextData, 'guestRequirements');
        if (houseRules) {
          if (Array.isArray(houseRules)) {
            data.rules = houseRules.map((r: any) => r.title || r.name || r).filter((r: any) => typeof r === 'string').slice(0, 10);
          } else if (typeof houseRules === 'string') {
            data.rules = [houseRules];
          }
        }
      } catch(e: any) {
        console.error("NEXT_DATA parse error:", e.message);
      }
    }

    // ── Balises Open Graph (présentes sur la vraie page d'annonce) ──
    if (!data.name) {
      const ogTitle = metaContent(html, "og:title");
      if (ogTitle) data.name = ogTitle.replace(/\s*[-|·]\s*Airbnb.*$/i, '').trim();
    }
    if (!data.description) {
      const ogDesc = metaContent(html, "og:description");
      if (ogDesc) data.description = ogDesc.substring(0, 500);
    }

    // ── Fallbacks ──
    if (!data.name) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
      if (titleMatch) data.name = decodeEntities(titleMatch[1]).replace(' - Airbnb', '').replace(' | Airbnb', '').trim();
    }

    // ── Page qui n'est pas l'annonce (redirection, blocage...) ──
    // Avant ce correctif, on renvoyait success:true avec le titre de la page
    // de redirection, et l'app l'enregistrait comme nom du logement.
    if (isNotAListingName(data.name)) {
      console.warn("scrape-airbnb: page non exploitable", { url: cleanUrl, title: data.name, status: res.status, finalUrl: res.url });
      return jsonResponse({
        success: false,
        code: "airbnb_unreadable",
        error: "Airbnb n'a pas renvoyé l'annonce. Complétez les informations manuellement.",
      }, 502);
    }

    if (!data.host_name) {
      const hostPatterns = [
        /"hostName":"([^"]+)"/, /"user":\{"id":[^}]+"firstName":"([^"]+)"/,
        /Logement proposé par ([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?)/,
        /Hosted by ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
      ];
      for (const pattern of hostPatterns) {
        const m = html.match(pattern);
        if (m?.[1] && m[1].length > 1 && m[1].length < 60) { data.host_name = m[1].trim(); break; }
      }
    }

    // ── Emoji & type ──
    const nameAndDesc = (data.name + ' ' + (data.description || '')).toLowerCase();
    if (nameAndDesc.includes('riad')) { data.cover_emoji = '🏰'; data.type = data.type || 'Riad'; }
    else if (nameAndDesc.includes('villa')) { data.cover_emoji = '🏡'; data.type = data.type || 'Villa'; }
    else if (nameAndDesc.includes('studio')) { data.cover_emoji = '🏢'; data.type = data.type || 'Studio'; }
    else if (nameAndDesc.includes('maison') || nameAndDesc.includes('house')) { data.cover_emoji = '🏠'; data.type = data.type || 'Maison'; }
    else if (nameAndDesc.includes('appartement') || nameAndDesc.includes('apartment')) { data.cover_emoji = '🏢'; data.type = data.type || 'Appartement'; }
    else if (nameAndDesc.includes('chambre') || nameAndDesc.includes('room')) { data.cover_emoji = '🛏️'; data.type = data.type || 'Chambre'; }

    if (!data.location && data.city) data.location = data.city;
    if (data.rules.length === 0 && data.amenities.length > 0) {
      const ruleKeywords = ['animaux', 'fête', 'fumeur', 'enfants', 'pets', 'party', 'smoking', 'children'];
      data.rules = data.amenities.filter((a: string) => ruleKeywords.some(k => a.toLowerCase().includes(k)));
    }

    return jsonResponse({ success: true, data });

  } catch (error: any) {
    console.error("scrape-airbnb error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});

function findNested(obj: any, key: string, depth = 0): any {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  if (obj[key]) return obj[key];
  for (const k of Object.keys(obj)) {
    const result = findNested(obj[k], key, depth + 1);
    if (result) return result;
  }
  return null;
}

function findValueByKey(obj: any, key: string, depth = 0): any {
  if (depth > 8 || !obj || typeof obj !== 'object') return null;
  if (key in obj && obj[key] !== null) return obj[key];
  for (const k of Object.keys(obj)) {
    const result = findValueByKey(obj[k], key, depth + 1);
    if (result !== null) return result;
  }
  return null;
}

function findAllValuesByKey(obj: any, key: string, depth = 0, results: any[] = []): any[] {
  if (depth > 6 || !obj || typeof obj !== 'object') return results;
  if (key in obj && Array.isArray(obj[key]) && obj[key].length > 0) results.push(obj[key]);
  for (const k of Object.keys(obj)) findAllValuesByKey(obj[k], key, depth + 1, results);
  return results;
}

function formatTime(time: any): string | null {
  if (!time) return null;
  if (typeof time === 'string') {
    const match = time.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (match) {
      let h = parseInt(match[1]);
      const m = match[2] || '00';
      if (match[3]?.toUpperCase() === 'PM' && h < 12) h += 12;
      if (match[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
  }
  return null;
}
