# SmartReview Backend

Backend dla rozszerzenia SmartReview. Hostowany na Vercel (bezpłatnie).

## Deploy w 10 minut

### 1. Vercel
```
npm install -g vercel
vercel login
vercel deploy
```

### 2. Vercel KV (baza danych)
- Wejdź na vercel.com → projekt → Storage → Create KV Database
- Skopiuj KV_REST_API_URL i KV_REST_API_TOKEN do zmiennych środowiskowych

### 3. Stripe
- Załóż konto na stripe.com
- Utwórz produkt: "SmartReview Monthly" za 9 PLN
- Skopiuj Price ID (price_xxx) → STRIPE_PRICE_MONTHLY
- Dodaj webhook: https://twoj-projekt.vercel.app/api/webhook
  - Zdarzenia: checkout.session.completed, invoice.payment_succeeded, customer.subscription.deleted
- Skopiuj Webhook Secret → STRIPE_WEBHOOK_SECRET

### 4. Resend (emaile)
- Załóż konto na resend.com (darmowe 3000/mc)
- Skopiuj API Key → RESEND_API_KEY

### 5. Zmienne środowiskowe w Vercel
Wejdź na vercel.com → projekt → Settings → Environment Variables
i dodaj wszystkie zmienne z .env.example

## Endpoints

- POST /api/analyze    – analiza produktu (wymaga licenceKey)
- POST /api/activate   – weryfikacja klucza licencji
- POST /api/checkout   – tworzenie sesji płatności Stripe
- POST /api/webhook    – webhook Stripe (aktywacja licencji)
- GET  /api/success    – strona po płatności
