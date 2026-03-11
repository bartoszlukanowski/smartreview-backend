// api/activate.js
// Rozszerzenie sprawdza tu czy klucz licencji jest ważny

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { licenseKey } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ ok: false, error: 'Brak klucza licencji' });
  }

  try {
    const kv = await getKV();
    const data = await kv.get(`license:${licenseKey}`);

    if (!data) {
      return res.status(404).json({ ok: false, error: 'Nieznany klucz licencji' });
    }

    const license = typeof data === 'string' ? JSON.parse(data) : data;

    if (license.validUntil && new Date(license.validUntil) < new Date()) {
      return res.status(403).json({ ok: false, error: 'Subskrypcja wygasła' });
    }

    return res.status(200).json({
      ok: true,
      plan: license.plan,
      validUntil: license.validUntil,
      email: license.email
    });

  } catch (err) {
    console.error('Activate error:', err);
    return res.status(500).json({ ok: false, error: 'Błąd serwera' });
  }
}

async function getKV() {
  const KV_REST_API_URL = process.env.KV_REST_API_URL;
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
  return {
    async get(key) {
      const resp = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });
      const json = await resp.json();
      return json.result;
    }
  };
}
