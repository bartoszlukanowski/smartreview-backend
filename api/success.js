// api/success.js – strona po udanej płatności (przekierowanie)
export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Dziękujemy! – SmartReview</title>
  <style>
    body { font-family: sans-serif; background: #0c0c0f; color: #f0eeff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #16161c; border: 1px solid #2a2a38; border-radius: 20px; padding: 48px; text-align: center; max-width: 480px; }
    h1 { color: #3effa0; font-size: 48px; margin: 0 0 16px; }
    h2 { font-size: 24px; margin: 0 0 12px; }
    p { color: #a09cba; line-height: 1.6; }
    .note { background: #1e1e27; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div h1>🎉</div>
    <h2>Płatność udana!</h2>
    <p>Klucz licencji został wysłany na Twój adres email. Sprawdź skrzynkę (również folder spam).</p>
    <div class="note">
      <strong>Następny krok:</strong><br>
      Wklej klucz licencji w rozszerzeniu SmartReview i zacznij analizować produkty!
    </div>
  </div>
</body>
</html>`);
}
