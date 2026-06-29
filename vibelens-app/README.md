# VibeLens AI — Full App Project

AI photo studio app: enhance, change outfits, swap backgrounds, generate
quote posters, retouch beauty, and run full AI photo shoots — powered by
OpenAI, with a Node/Express backend and Firebase for auth + credits, wrapped
in Capacitor for Android (Google Play) and iOS (App Store).

## Project structure

```
vibelens-app/
├── backend/              Node.js + Express API
│   ├── src/
│   │   ├── server.js              entry point
│   │   ├── config/firebase.js     Firebase Admin SDK init
│   │   ├── middleware/auth.js     verifies Firebase ID tokens
│   │   ├── routes/
│   │   │   ├── user.js            bootstrap / profile / history
│   │   │   ├── ai.js              enhance/outfit/background/beauty/poster/shoot/quotes
│   │   │   └── payments.js        Stripe checkout + webhook
│   │   └── services/
│   │       ├── openai.js          all OpenAI calls (the ONLY place the key is used)
│   │       └── credits.js         Firestore credit balance, atomic transactions
│   ├── firestore.rules            security rules (client can read, never write)
│   ├── .env.example               copy to .env and fill in real values
│   ├── Dockerfile
│   └── package.json
│
├── frontend/             Capacitor mobile wrapper
│   ├── www/                       the actual web app (HTML/CSS/JS)
│   │   ├── index.html             main app UI + logic
│   │   ├── app-config.js          backend URL + Firebase web config (edit before building)
│   │   └── api-client.js          talks to YOUR backend, never to OpenAI directly
│   ├── resources/                 put icon.png / splash.png here
│   ├── capacitor.config.js
│   └── package.json
│
└── docs/
    └── DEPLOYMENT_GUIDE.md        START HERE — full setup, build, and store submission walkthrough
```

## Quick start (local development)

**1. Backend:**
```bash
cd backend
cp .env.example .env     # fill in OPENAI_API_KEY + Firebase service account
npm install
npm run dev               # runs on http://localhost:8080
```

**2. Frontend (test in a regular browser first, before wrapping natively):**
```bash
cd frontend/www
# edit app-config.js: set BACKEND_URL to http://localhost:8080
#                     and fill in your Firebase web config
npx serve .                # or any static file server
```

Open the served URL, sign up, and try a feature — it should call your local
backend, which calls OpenAI and Firebase for real.

**3. Once that works end-to-end, follow `docs/DEPLOYMENT_GUIDE.md`** to deploy
the backend to a real host, then wrap the frontend with Capacitor and submit
to Google Play and the Apple App Store.

## Why this architecture

The original single-file version of this app called OpenAI directly from the
browser using a key typed into a Settings page. That's fine for a personal
demo, but shipping it publicly would expose your API key to anyone who opens
their browser's developer tools — they could extract it and run up your bill.

This version fixes that: the OpenAI key lives only in the backend's `.env`
file on your server. The app calls your backend; your backend calls OpenAI.
Credits are tracked in Firestore and can only be changed by the backend
(enforced by `firestore.rules`), so a modified or decompiled copy of the app
can't grant itself free credits either.
