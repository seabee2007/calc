require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 3000;

// Pull your Supabase project origin from your env
// e.g. VITE_SUPABASE_URL=https://abcd1234.supabase.co
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('❌  Please set VITE_SUPABASE_URL in your .env');
  process.exit(1);
}
const SUPABASE_ORIGIN = new URL(SUPABASE_URL).origin;

// Configure Helmet to serve CSP as an HTTP header
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],    // remove 'unsafe-inline' in prod
      styleSrc:   ["'self'", "'unsafe-inline'"],    // remove 'unsafe-inline' in prod
      imgSrc:     ["'self'", "data:", "https://images.pexels.com"],
      connectSrc: [
        "'self'",
        SUPABASE_ORIGIN,
        // Supabase Functions are same origin so covered
        "https://api.weatherapi.com",
        "https://nominatim.openstreetmap.org"
      ],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"]
    }
  })
);

// Serve everything from your build output
const root = path.join(__dirname, 'dist');
app.use(express.static(root));

// All other routes → index.html (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅  CSP server running at http://localhost:${port}`);
});