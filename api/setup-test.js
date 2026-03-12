// TYMCZASOWY – usuń przed produkcją!
import { createClient } from 'redis';

export default async function handler(req, res) {
  const client = createClient({ url: process.env.KV_REDIS_URL });
  try {
    await client.connect();
    await client.set('license:SR-TEST-1234-ABCD-5678', JSON.stringify({
      email: 'test@test.com',
      plan: 'monthly',
      validUntil: '2027-01-01T00:00:00.000Z',
      usageCount: 0
    }));
    await client.disconnect();
    return res.status(200).json({ ok: true, message: 'Licencja testowa dodana!', licenseKey: 'SR-TEST-1234-ABCD-5678' });
  } catch (err) {
    await client.disconnect().catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
}
