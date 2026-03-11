// api/analyze.js
// Główny endpoint – sprawdza licencję i wywołuje Claude API

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { licenseKey, productInfo, shopReviews, redditPosts } = req.body;

  // ── 1. Sprawdź licencję ──────────────────────────────
  if (!licenseKey) {
    return res.status(401).json({ error: 'Brak klucza licencji. Kup subskrypcję na smartreview.app' });
  }

  const licenseValid = await checkLicense(licenseKey);
  if (!licenseValid.ok) {
    return res.status(403).json({ error: licenseValid.reason });
  }

  // ── 2. Buduj prompt ──────────────────────────────────
  const shopText = shopReviews?.length > 0
    ? `\n\nOPINIE ZE SKLEPU (${shopReviews.length}):\n` +
      shopReviews.map((r, i) => `${i+1}. ${r.rating ? '['+r.rating+'] ' : ''}${r.body}`).join('\n')
    : '\n\n(Brak opinii ze strony – oceń na podstawie wiedzy ogólnej)';

  const redditText = redditPosts?.length > 0
    ? `\n\nREDDIT (${redditPosts.length}):\n` +
      redditPosts.map((p, i) => `${i+1}. [r/${p.subreddit}] ${p.title}${p.text ? ': '+p.text : ''}`).join('\n')
    : '';

  const sourceSummary = `${shopReviews?.length || 0} opinii ze sklepu + ${redditPosts?.length || 0} wątków Reddit`;

  const prompt = `Jesteś ekspertem oceniającym produkty konsumenckie.

PRODUKT: "${productInfo.name}"
SKLEP: ${productInfo.shop}
${productInfo.price ? 'CENA: ' + productInfo.price : ''}
${productInfo.rating ? 'OCENA W SKLEPIE: ' + productInfo.rating : ''}
${shopText}
${redditText}

Oceń produkt. Odpowiedz TYLKO w formacie JSON (bez backticks):
{"score":75,"summary":"2-3 zdania po polsku.","pros":["plus 1","plus 2","plus 3"],"cons":["minus 1","minus 2","minus 3"],"sourceSummary":"${sourceSummary}"}`;

  // ── 3. Wywołaj Claude API ────────────────────────────
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error('Claude API error: ' + response.status);
    }

    const data = await response.json();
    const raw = data.content[0].text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);

    // Zapisz użycie (opcjonalne – do statystyk)
    await incrementUsage(licenseKey);

    return res.status(200).json({ ok: true, result });

  } catch (err) {
    console.error('Analysis error:', err);
    return res.status(500).json({ error: 'Błąd analizy: ' + err.message });
  }
}

// ── SPRAWDZANIE LICENCJI ─────────────────────────────────
async function checkLicense(licenseKey) {
  // Używamy Vercel KV (Redis) do przechowywania aktywnych licencji
  // Format klucza w KV: license:{key} = { email, plan, validUntil, usageCount }

  try {
    const kv = await getKV();
    const data = await kv.get(`license:${licenseKey}`);

    if (!data) {
      return { ok: false, reason: 'Nieznany klucz licencji. Kup subskrypcję na smartreview.app' };
    }

    const license = typeof data === 'string' ? JSON.parse(data) : data;

    // Sprawdź datę ważności
    if (license.validUntil && new Date(license.validUntil) < new Date()) {
      return { ok: false, reason: 'Subskrypcja wygasła. Odnów na smartreview.app' };
    }

    // Sprawdź limit użycia (opcjonalnie dla free tier)
    if (license.plan === 'free' && license.usageCount >= 10) {
      return { ok: false, reason: 'Wykorzystano darmowy limit (10 analiz). Kup subskrypcję na smartreview.app' };
    }

    return { ok: true, license };

  } catch (err) {
    console.error('License check error:', err);
    // W razie błędu KV – pozwól na analizę (fail open) żeby nie blokować płacących
    return { ok: true };
  }
}

async function incrementUsage(licenseKey) {
  try {
    const kv = await getKV();
    const data = await kv.get(`license:${licenseKey}`);
    if (data) {
      const license = typeof data === 'string' ? JSON.parse(data) : data;
      license.usageCount = (license.usageCount || 0) + 1;
      license.lastUsed = new Date().toISOString();
      await kv.set(`license:${licenseKey}`, JSON.stringify(license));
    }
  } catch (e) {
    // nie blokuj jeśli się nie uda
  }
}

// ── KV HELPER ────────────────────────────────────────────
async function getKV() {
  // Vercel KV przez REST API (nie wymaga dodatkowych paczek)
  const KV_REST_API_URL = process.env.KV_REST_API_URL;
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

  return {
    async get(key) {
      const resp = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });
      const json = await resp.json();
      return json.result;
    },
    async set(key, value, opts = {}) {
      const body = opts.ex
        ? JSON.stringify(['SET', key, value, 'EX', opts.ex])
        : JSON.stringify(['SET', key, value]);
      await fetch(`${KV_REST_API_URL}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body
      });
    }
  };
}
