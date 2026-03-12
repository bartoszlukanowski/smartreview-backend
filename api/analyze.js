import { createClient } from 'redis';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { licenseKey, productInfo, shopReviews, redditPosts } = req.body;

  if (!licenseKey) return res.status(401).json({ error: 'Brak klucza licencji' });

  // Sprawdź licencję
  const client = createClient({ url: process.env.KV_REDIS_URL });
  try {
    await client.connect();
    const data = await client.get('license:' + licenseKey);

    if (!data) {
      await client.disconnect();
      return res.status(403).json({ error: 'Nieznany klucz licencji. Kup subskrypcję.' });
    }

    const license = JSON.parse(data);
    if (license.validUntil && new Date(license.validUntil) < new Date()) {
      await client.disconnect();
      return res.status(403).json({ error: 'Subskrypcja wygasła. Odnów na smartreview.app' });
    }

    // Zwiększ licznik użycia
    license.usageCount = (license.usageCount || 0) + 1;
    await client.set('license:' + licenseKey, JSON.stringify(license));
    await client.disconnect();

  } catch (err) {
    await client.disconnect().catch(() => {});
    // Fail open – nie blokuj jeśli KV niedostępne
  }

  // Buduj prompt
  const shopText = shopReviews?.length > 0
    ? `\n\nOPINIE ZE SKLEPU (${shopReviews.length}):\n` +
      shopReviews.map((r, i) => `${i+1}. ${r.rating ? '['+r.rating+'] ' : ''}${r.body}`).join('\n')
    : '\n\n(Brak opinii ze strony)';

  const redditText = redditPosts?.length > 0
    ? `\n\nREDDIT (${redditPosts.length}):\n` +
      redditPosts.map((p, i) => `${i+1}. [r/${p.subreddit}] ${p.title}${p.text ? ': '+p.text : ''}`).join('\n')
    : '';

  const sourceSummary = `${shopReviews?.length || 0} opinii ze sklepu + ${redditPosts?.length || 0} wątków Reddit`;

  const prompt = `Jesteś ekspertem oceniającym produkty konsumenckie.

PRODUKT: "${productInfo.name}"
SKLEP: ${productInfo.shop}
${productInfo.price ? 'CENA: '+productInfo.price : ''}
${productInfo.rating ? 'OCENA: '+productInfo.rating : ''}
${shopText}
${redditText}

Odpowiedz TYLKO w formacie JSON (bez backticks):
{"score":75,"summary":"2-3 zdania po polsku.","pros":["plus 1","plus 2","plus 3"],"cons":["minus 1","minus 2","minus 3"],"sourceSummary":"${sourceSummary}"}`;

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

    if (!response.ok) throw new Error('Claude API error: ' + response.status);

    const data = await response.json();
    const raw = data.content[0].text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);

    return res.status(200).json({ ok: true, result });

  } catch (err) {
    return res.status(500).json({ error: 'Błąd analizy: ' + err.message });
  }
}
