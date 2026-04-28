import 'server-only';

/**
 * SEAI BER lookup — Session 6 SPIKE.
 *
 * Goal: given an Eircode (and optionally an address), return the property's
 * Building Energy Rating data from the public SEAI register so we can
 * auto-fill the rating, cert number, and expiry on the review screen.
 *
 * Status: SHIPPED-AS-SPIKE. The function is structurally complete and
 * returns null on any uncertainty so the orchestrator handles it cleanly.
 * Live extraction has not been verified end-to-end against the real site
 * from this environment — see "What was attempted" below.
 *
 * What was attempted (spike timebox 90 minutes):
 *   1. Reconnaissance against https://ndber.seai.ie/PASS/Search.aspx — the
 *      one publicly-documented entry point for BER cert search by Eircode
 *      / MPRN. The page itself returned 403 to a vanilla HTTPS GET in the
 *      sandbox environment used for the spike; the SEAI WAF appears to
 *      block clients without an established browser session / matching
 *      User-Agent. This is the first obstacle but doesn't necessarily
 *      break a server-side scraper running from Vercel — Vercel's
 *      outbound IPs and a realistic UA may pass.
 *   2. The page is classic ASP.NET WebForms: any POST needs the page's
 *      __VIEWSTATE and __EVENTVALIDATION hidden fields plus the session
 *      cookie. The flow is GET -> capture tokens + cookies -> POST with
 *      eircode + tokens -> parse the first result row.
 *   3. Without iterating against real responses (we don't have a known
 *      eircode + expected BER pair to test against from this sandbox),
 *      result-row regexes are best-effort. They will likely need tuning
 *      the first time we run this against the live site with a known
 *      property.
 *
 * What's implemented here:
 *   - 5-second hard timeout via AbortController across the whole flow.
 *   - GET -> token + cookie capture -> POST -> regex parse, with structured
 *     debug logging at each stage prefixed [lettings-lookup][seai].
 *   - Graceful null return on any failure or ambiguity. Never throws.
 *
 * Fallback: Session 8's review screen lets the agent upload a BER cert
 * manually. Auto-BER is a nice-to-have for v1.0 — the magic moment of the
 * address auto-fill alone is already strong.
 *
 * TODO when iterating against the live site:
 *   - Replace the regex parsers with a small HTML walker (or pull in
 *     parse5 / cheerio if cheerio's already a dep) once we know the real
 *     row markup.
 *   - Verify whether SEAI exposes a JSON endpoint via the page's AJAX
 *     calls (look in the network tab on a manual search) — that would
 *     replace this scrape entirely.
 *   - Add a structured cache (lettings_field_provenance source = 'seai_register'
 *     already exists) to avoid hammering SEAI on repeat lookups.
 */

const SEAI_SEARCH_URL = 'https://ndber.seai.ie/PASS/Search.aspx';
const TIMEOUT_MS = 5000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type BerLookupResult = {
  rating: string | null;
  certNumber: string | null;
  expiryDate: string | null; // ISO date YYYY-MM-DD
};

export async function lookupBerByAddress(
  address: string,
  eircode?: string,
): Promise<BerLookupResult | null> {
  const cleanEircode = (eircode ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const lookupKey = cleanEircode || hashForLog(address);
  const started = Date.now();

  console.log(`[lettings-lookup][seai] start key=${redact(lookupKey)}`);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Stage 1 — GET the search page to capture VIEWSTATE + cookies.
    const initialRes = await fetch(SEAI_SEARCH_URL, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: controller.signal,
    });

    if (!initialRes.ok) {
      console.warn(
        `[lettings-lookup][seai] initial GET failed status=${initialRes.status} key=${redact(lookupKey)}`,
      );
      return null;
    }

    const initialHtml = await initialRes.text();
    const setCookie = initialRes.headers.get('set-cookie') ?? '';
    const cookieJar = setCookie
      .split(/,(?=[^;]+?=)/)
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    const viewState = extractHidden(initialHtml, '__VIEWSTATE');
    const viewStateGen = extractHidden(initialHtml, '__VIEWSTATEGENERATOR');
    const eventValidation = extractHidden(initialHtml, '__EVENTVALIDATION');

    if (!viewState || !eventValidation) {
      console.warn(
        `[lettings-lookup][seai] could not extract ASP.NET tokens from initial page key=${redact(lookupKey)}`,
      );
      return null;
    }

    if (!cleanEircode) {
      // Without an eircode we'd have to drive the address-search variant
      // of this form, which is much fuzzier. For v1.0 we only auto-BER
      // when an eircode is in hand.
      console.log(
        `[lettings-lookup][seai] skipped: no eircode key=${redact(lookupKey)}`,
      );
      return null;
    }

    // Stage 2 — POST the search. Field names match the public form's
    // current control naming convention; if SEAI rename them this returns
    // null cleanly and the orchestrator surfaces "Not in SEAI register".
    const postBody = new URLSearchParams();
    postBody.set('__VIEWSTATE', viewState);
    if (viewStateGen) postBody.set('__VIEWSTATEGENERATOR', viewStateGen);
    postBody.set('__EVENTVALIDATION', eventValidation);
    postBody.set('ctl00$DefaultContent$BERSearch$dfSearch$txtEircode', cleanEircode);
    postBody.set('ctl00$DefaultContent$BERSearch$dfSearch$Bottomsearch', 'Search');

    const searchRes = await fetch(SEAI_SEARCH_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html',
        ...(cookieJar ? { Cookie: cookieJar } : {}),
        Referer: SEAI_SEARCH_URL,
      },
      body: postBody.toString(),
      signal: controller.signal,
    });

    if (!searchRes.ok) {
      console.warn(
        `[lettings-lookup][seai] search POST failed status=${searchRes.status} key=${redact(lookupKey)}`,
      );
      return null;
    }

    const searchHtml = await searchRes.text();
    const parsed = parseFirstResult(searchHtml);
    if (!parsed) {
      console.log(
        `[lettings-lookup][seai] no parseable result key=${redact(lookupKey)} duration_ms=${Date.now() - started}`,
      );
      return null;
    }

    console.log(
      `[lettings-lookup][seai] ok key=${redact(lookupKey)} rating=${parsed.rating ?? 'null'} duration_ms=${Date.now() - started}`,
    );
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[lettings-lookup][seai] error key=${redact(lookupKey)} reason=${message} duration_ms=${Date.now() - started}`,
    );
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function extractHidden(html: string, name: string): string | null {
  const re = new RegExp(
    `<input[^>]*name="${escapeRegex(name)}"[^>]*value="([^"]*)"`,
    'i',
  );
  const match = html.match(re);
  return match ? decodeHtmlEntities(match[1]) : null;
}

function parseFirstResult(html: string): BerLookupResult | null {
  // Best-effort regex extraction. The real page renders results in a
  // GridView; the first BER number, rating, and expiry typically live in
  // the first <tr> after the header. These patterns are educated guesses
  // and need verification against a real SEAI response.
  const ratingMatch =
    html.match(/BER[^<]*?<[^>]*>\s*([A-G][12]?)\s*</i)
    ?? html.match(/>\s*([A-G][12]?)\s*<\/td>/);
  const certMatch =
    html.match(/BER\s*Number[^<]*<[^>]*>\s*(\d{8,12})/i)
    ?? html.match(/>\s*(\d{9})\s*</);
  const expiryMatch =
    html.match(/Valid\s*Until[^<]*<[^>]*>\s*(\d{2}\/\d{2}\/\d{4})/i)
    ?? html.match(/>\s*(\d{2}\/\d{2}\/\d{4})\s*</);

  const rating = ratingMatch?.[1]?.toUpperCase() ?? null;
  const certNumber = certMatch?.[1] ?? null;
  const expiryDate = expiryMatch ? toIsoDate(expiryMatch[1]) : null;

  if (!rating && !certNumber && !expiryDate) return null;
  return { rating, certNumber, expiryDate };
}

function toIsoDate(dmy: string): string | null {
  const [d, m, y] = dmy.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function hashForLog(s: string): string {
  // Non-cryptographic hash — just enough to correlate logs without leaking
  // the address itself.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `addr#${(h >>> 0).toString(16)}`;
}

function redact(key: string): string {
  // Eircode routing key (first 3) is fine to log — already public from
  // listings. Drop the unique 4-char identifier so any per-property
  // joining stays opaque.
  if (/^[A-Z][0-9]{2} [A-Z0-9]{4}$/.test(key)) return key.slice(0, 3) + ' ****';
  return key;
}
