import { createClient } from 'redis';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { licenseKey } = req.body;
  if (!licenseKey) return res.status(400).json({ ok: false, error: 'Brak klucza licencji' });

  const client = createClient({ url: process.env.KV_REDIS_URL });
  try {
    await client.connect();
    const data = await client.get('license:' + licenseKey);
    await client.disconnect();

    if (!data) return res.status(404).json({ ok: false, error: 'Nieznany klucz licencji' });

    const license = JSON.parse(data);
    if (license.validUntil && new Date(license.validUntil) < new Date()) {
      return res.status(403).json({ ok: false, error: 'Subskrypcja wygasła' });
    }

    return res.status(200).json({ ok: true, plan: license.plan, validUntil: license.validUntil });

  } catch (err) {
    await client.disconnect().catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}
