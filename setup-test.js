// api/setup-test.js
// Tymczasowy endpoint do dodania testowej licencji
// USUŃ GO przed produkcją!

export default async function handler(req, res) {
  const KV_REST_API_URL = process.env.KV_REST_API_URL;
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;

  const licenseKey = 'SR-TEST-1234-ABCD-5678';
  const licenseData = JSON.stringify({
    email: 'test@test.com',
    plan: 'monthly',
    validUntil: '2027-01-01T00:00:00.000Z',
    usageCount: 0
  });

  try {
    const response = await fetch(
      `${KV_REST_API_URL}/set/${encodeURIComponent('license:' + licenseKey)}/${encodeURIComponent(licenseData)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      }
    );

    const result = await response.json();
    console.log('KV result:', result);

    return res.status(200).json({
      ok: true,
      message: 'Testowa licencja dodana!',
      licenseKey,
      kvResult: result
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
