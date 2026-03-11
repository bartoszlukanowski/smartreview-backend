// api/checkout.js
// Tworzy sesję płatności Stripe i przekierowuje użytkownika

import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { email, plan } = req.body;

  // Plany cenowe – ustaw swoje price ID ze Stripe Dashboard
  const PRICE_IDS = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,  // np. 9 PLN/mc
    yearly:  process.env.STRIPE_PRICE_YEARLY,   // np. 69 PLN/rok
  };

  const priceId = PRICE_IDS[plan] || PRICE_IDS.monthly;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'blik', 'p24'],
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/cancel`,
      metadata: { plan }
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: 'Błąd płatności: ' + err.message });
  }
}
