// api/webhook.js
// Stripe wysyła tu zdarzenia – aktywacja licencji po płatności

import Stripe from 'stripe';
import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function generateLicenseKey() {
  // Format: SR-XXXX-XXXX-XXXX-XXXX
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SR-${part()}-${part()}-${part()}-${part()}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const kv = await getKV();

  // ── Obsługiwane zdarzenia Stripe ─────────────────────
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      const subscriptionId = session.subscription;

      // Wygeneruj klucz licencji
      const licenseKey = generateLicenseKey();
      const validUntil = new Date();
      validUntil.setMonth(validUntil.getMonth() + 1); // 1 miesiąc

      const licenseData = {
        email,
        plan: session.metadata?.plan || 'monthly',
        subscriptionId,
        licenseKey,
        validUntil: validUntil.toISOString(),
        createdAt: new Date().toISOString(),
        usageCount: 0
      };

      // Zapisz licencję w KV
      await kv.set(`license:${licenseKey}`, JSON.stringify(licenseData));
      // Też zapisz mapowanie email → licenseKey
      await kv.set(`email:${email}`, licenseKey);

      // Wyślij email z kluczem licencji
      await sendLicenseEmail(email, licenseKey);

      console.log(`✅ Nowa licencja: ${licenseKey} dla ${email}`);
      break;
    }

    case 'invoice.payment_succeeded': {
      // Odnowienie subskrypcji – przedłuż ważność
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;

      // Znajdź licencję po subscription ID
      const licenseKey = await kv.get(`sub:${subscriptionId}`);
      if (licenseKey) {
        const data = await kv.get(`license:${licenseKey}`);
        if (data) {
          const license = typeof data === 'string' ? JSON.parse(data) : data;
          const newValidUntil = new Date();
          newValidUntil.setMonth(newValidUntil.getMonth() + 1);
          license.validUntil = newValidUntil.toISOString();
          await kv.set(`license:${licenseKey}`, JSON.stringify(license));
          console.log(`🔄 Odnowiono licencję: ${licenseKey}`);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Anulowanie subskrypcji
      const subscription = event.data.object;
      const licenseKey = await kv.get(`sub:${subscription.id}`);
      if (licenseKey) {
        const data = await kv.get(`license:${licenseKey}`);
        if (data) {
          const license = typeof data === 'string' ? JSON.parse(data) : data;
          license.validUntil = new Date().toISOString(); // wygaś natychmiast
          license.cancelled = true;
          await kv.set(`license:${licenseKey}`, JSON.stringify(license));
          console.log(`❌ Anulowano licencję: ${licenseKey}`);
        }
      }
      break;
    }
  }

  return res.status(200).json({ received: true });
}

// ── EMAIL ────────────────────────────────────────────────
async function sendLicenseEmail(email, licenseKey) {
  // Używamy Resend (darmowe 3000 emaili/mc) – załóż konto na resend.com
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn('Brak RESEND_API_KEY – email nie wysłany');
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'SmartReview <noreply@smartreview.app>',
      to: email,
      subject: '🎉 Twój klucz licencji SmartReview',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #7c6aff;">SmartReview</h1>
          <p>Dziękujemy za zakup! Twój klucz licencji:</p>
          <div style="background: #f0eeff; border: 2px solid #7c6aff; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <code style="font-size: 22px; font-weight: bold; color: #7c6aff; letter-spacing: 2px;">${licenseKey}</code>
          </div>
          <p><strong>Jak aktywować:</strong></p>
          <ol>
            <li>Zainstaluj rozszerzenie SmartReview w Chrome</li>
            <li>Kliknij ikonkę rozszerzenia</li>
            <li>Wklej klucz licencji i kliknij "Aktywuj"</li>
          </ol>
          <p style="color: #888; font-size: 13px;">Subskrypcja odnawia się automatycznie co miesiąc. Możesz anulować w dowolnym momencie.</p>
        </div>
      `
    })
  });
}

// ── KV HELPER ────────────────────────────────────────────
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
    },
    async set(key, value) {
      await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });
    }
  };
}
