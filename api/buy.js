// api/buy.js – prosta strona sprzedażowa z przyciskiem zakupu
export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Utwórz sesję Stripe
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card', 'p24'],
        line_items: [{ price: process.env.STRIPE_PRICE_MONTHLY, quantity: 1 }],
        success_url: `${process.env.APP_URL}/api/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/api/buy`,
      });
      return res.redirect(303, session.url);
    } catch (err) {
      return res.status(500).send('Błąd: ' + err.message);
    }
  }

  // GET – pokaż stronę sprzedażową
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartReview – AI analizuje produkty za Ciebie</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0c0c0f; color: #f0eeff; min-height: 100vh; }

    .hero { padding: 80px 20px 60px; text-align: center; max-width: 680px; margin: 0 auto; }
    .logo { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #7c6aff, #ff6a9c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 40px; }
    h1 { font-size: clamp(32px, 6vw, 52px); font-weight: 800; line-height: 1.15; margin-bottom: 20px; }
    h1 span { background: linear-gradient(135deg, #7c6aff, #ff6a9c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { font-size: 18px; color: #a09cba; line-height: 1.6; margin-bottom: 48px; }

    .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; max-width: 680px; margin: 0 auto 60px; padding: 0 20px; }
    .feature { background: #16161c; border: 1px solid #2a2a38; border-radius: 14px; padding: 20px; text-align: left; }
    .feature-icon { font-size: 28px; margin-bottom: 10px; }
    .feature-title { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
    .feature-desc { font-size: 13px; color: #6b6880; line-height: 1.5; }

    .pricing { max-width: 400px; margin: 0 auto 80px; padding: 0 20px; }
    .price-card { background: #16161c; border: 2px solid #7c6aff; border-radius: 20px; padding: 36px; text-align: center; }
    .price-label { font-size: 12px; color: #7c6aff; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 16px; }
    .price { font-size: 56px; font-weight: 800; margin-bottom: 4px; }
    .price-period { font-size: 16px; color: #6b6880; margin-bottom: 28px; }
    .price-features { list-style: none; margin-bottom: 32px; text-align: left; }
    .price-features li { padding: 8px 0; border-bottom: 1px solid #2a2a38; font-size: 14px; color: #c0bdd8; display: flex; align-items: center; gap: 10px; }
    .price-features li::before { content: '✓'; color: #3effa0; font-weight: 700; flex-shrink: 0; }

    .btn { display: block; width: 100%; padding: 16px; background: linear-gradient(135deg, #7c6aff, #9b6aff); border: none; border-radius: 12px; color: white; font-size: 17px; font-weight: 700; cursor: pointer; text-decoration: none; transition: opacity 0.2s, transform 0.1s; }
    .btn:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }

    .guarantee { text-align: center; color: #6b6880; font-size: 13px; margin-top: 16px; }

    .shops { text-align: center; padding: 0 20px 60px; }
    .shops-title { font-size: 13px; color: #6b6880; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    .shop-tags { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
    .tag { padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }
    .tag-amazon { background: rgba(255,153,0,0.15); color: #ffa733; }
    .tag-allegro { background: rgba(255,87,34,0.15); color: #ff6b3d; }
    .tag-ceneo { background: rgba(33,150,243,0.15); color: #64b5f6; }

    footer { text-align: center; padding: 40px 20px; color: #6b6880; font-size: 13px; border-top: 1px solid #2a2a38; }
  </style>
</head>
<body>

  <div class="hero">
    <div class="logo">SmartReview</div>
    <h1>Czy ten produkt <span>warto kupić?</span></h1>
    <p class="subtitle">AI analizuje opinie z wielu źródeł – sklep, Reddit, fora – i daje ci jasną odpowiedź w kilka sekund.</p>
  </div>

  <div class="features">
    <div class="feature">
      <div class="feature-icon">🤖</div>
      <div class="feature-title">Analiza AI</div>
      <div class="feature-desc">Claude AI czyta setki opinii i wyciąga to co ważne</div>
    </div>
    <div class="feature">
      <div class="feature-icon">📊</div>
      <div class="feature-title">Wiele źródeł</div>
      <div class="feature-desc">Opinie ze sklepu + wątki Reddit + fora</div>
    </div>
    <div class="feature">
      <div class="feature-icon">⚡</div>
      <div class="feature-title">Błyskawicznie</div>
      <div class="feature-desc">Wynik w kilka sekund, bez opuszczania strony</div>
    </div>
    <div class="feature">
      <div class="feature-icon">✅</div>
      <div class="feature-title">Jasna ocena</div>
      <div class="feature-desc">Plusy, minusy i ocena 0-100 – zero lania wody</div>
    </div>
  </div>

  <div class="shops">
    <div class="shops-title">Działa na</div>
    <div class="shop-tags">
      <span class="tag tag-amazon">Amazon</span>
      <span class="tag tag-allegro">Allegro</span>
      <span class="tag tag-ceneo">Ceneo</span>
    </div>
  </div>

  <div class="pricing">
    <div class="price-card">
      <div class="price-label">Subskrypcja miesięczna</div>
      <div class="price">9 <span style="font-size:24px;color:#6b6880">PLN</span></div>
      <div class="price-period">/ miesiąc · anuluj kiedy chcesz</div>
      <ul class="price-features">
        <li>Nielimitowane analizy produktów</li>
        <li>Amazon, Allegro, Ceneo</li>
        <li>Opinie ze sklepu + Reddit</li>
        <li>Plusy, minusy, ocena AI</li>
        <li>Aktualizacje bezpłatne</li>
      </ul>
      <form method="POST" action="/api/buy">
        <button type="submit" class="btn">Kup teraz – 9 PLN/mc →</button>
      </form>
      <div class="guarantee">🔒 Bezpieczna płatność przez Stripe · Anuluj w dowolnym momencie</div>
    </div>
  </div>

  <footer>
    © 2026 SmartReview · <a href="mailto:kontakt@smartreview.app" style="color:#7c6aff;text-decoration:none">Kontakt</a>
  </footer>

</body>
</html>`);
}
