# VibeLens AI — Full Deployment Guide
_Backend → Firebase → Mobile build → Google Play → Apple App Store_

This guide assumes zero prior setup. Follow it top to bottom. Total time for a
first-time deploy is realistically **2–4 hours of setup work**, plus Google's
**12-tester / 14-day closed testing period** and Apple's **app review time**
(typically 24–48 hours, sometimes longer) before either app actually goes live.

---

## 0. What you're deploying

```
vibelens-app/
├── backend/        ← Node.js/Express API — holds your OpenAI key, talks to
│                      Firebase, talks to Stripe. Deploy this to a server.
├── frontend/        ← Capacitor project wrapping the web app (www/) into a
│                      native Android + iOS app for the stores.
└── docs/             this guide and related docs
```

The **backend must be deployed and publicly reachable over HTTPS before** you
build the mobile app, because the app's `app-config.js` needs your backend's
real URL baked in.

---

## 1. Firebase project setup (Auth + Firestore)

1. Go to https://console.firebase.google.com → **Add project** → name it
   (e.g. "vibelens-ai") → finish the wizard (Google Analytics is optional).
2. **Authentication**: left sidebar → Build → Authentication → Get started.
   - Enable **Google** sign-in provider (toggle on, save).
   - Enable **Email/Password** sign-in provider (toggle on, save).
3. **Firestore**: left sidebar → Build → Firestore Database → Create database.
   - Start in **production mode** (we provide real security rules below, so
     you don't need test mode).
   - Pick a region close to your users.
4. **Deploy the included security rules** (these stop anyone from editing
   their own credit balance directly from the app):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # point it at backend/firestore.rules when asked
   firebase deploy --only firestore:rules
   ```
   Or simply paste the contents of `backend/firestore.rules` into
   **Firestore → Rules tab → Publish** in the console — same effect.
5. **Get your Web App config** (for the mobile app's Firebase SDK):
   - Project settings (gear icon) → General → "Your apps" → Add app → Web (`</>`).
   - Register it (nickname can be anything, e.g. "VibeLens Web").
   - Copy the `firebaseConfig` object shown — you'll paste this into
     `frontend/www/app-config.js` in step 4.
6. **Get your Service Account key** (for the backend's Admin SDK):
   - Project settings → Service accounts tab → **Generate new private key**.
   - This downloads a JSON file. **Never commit this file to git.**
   - You'll paste its contents into the backend's `.env` in step 2.

---

## 2. Deploy the backend

The backend is a standard Node/Express app — deploy it anywhere that runs
Node 18+. Three good low-effort options: **Render**, **Railway**, or
**Google Cloud Run**. Cloud Run is shown below since it pairs naturally with
Firebase (same Google Cloud project), but any host works.

### 2.1 Configure environment variables

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in:
- `OPENAI_API_KEY` — from https://platform.openai.com/api-keys. Your OpenAI
  account needs billing enabled for image generation (`gpt-image-1`) to work.
- `FIREBASE_SERVICE_ACCOUNT_JSON` — paste the **entire contents** of the
  service-account JSON file from step 1.6, on one line.
- `FIREBASE_PROJECT_ID` — your Firebase project's ID (visible in Project
  Settings → General).
- `ALLOWED_ORIGINS` — for now you can leave this loose during testing; once
  you have a production web domain or are exclusively using the mobile app,
  tighten it (native apps generally send no `Origin` header, so they aren't
  blocked by this list regardless).
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — see step 3 below; you can
  leave these blank until you're ready to accept real payments — every
  feature except the Top Up button works without them.

### 2.2 Deploy — Option A: Google Cloud Run (recommended pairing with Firebase)

```bash
# from the backend/ folder
gcloud auth login
gcloud config set project YOUR_FIREBASE_PROJECT_ID
gcloud run deploy vibelens-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "$(grep -v '^#' .env | xargs | sed 's/ /,/g')"
```

Cloud Run gives you a URL like `https://vibelens-backend-xxxxx.a.run.app` —
**save this**, you need it in step 4.

> Tip: for secrets like `OPENAI_API_KEY`, prefer Cloud Run's **Secret Manager**
> integration over plain env vars once you're in production — `gcloud run
> deploy --set-secrets OPENAI_API_KEY=openai-key:latest` after creating the
> secret with `gcloud secrets create`.

### 2.3 Deploy — Option B: Render.com (simplest, no CLI required)

1. Push the `backend/` folder to a GitHub repo.
2. https://render.com → New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `node src/server.js`.
4. Add all the variables from `.env` under the "Environment" tab.
5. Deploy. Render gives you a URL like `https://vibelens-backend.onrender.com`.

### 2.4 Deploy — Option C: Docker, anywhere

```bash
cd backend
docker build -t vibelens-backend .
docker run -p 8080:8080 --env-file .env vibelens-backend
```
Push the image to any container host (Fly.io, AWS ECS, DigitalOcean App
Platform, your own VPS behind nginx + Let's Encrypt, etc.).

### 2.5 Verify it's alive

```bash
curl https://YOUR-BACKEND-URL/health
# expect: {"ok":true,"service":"vibelens-backend","time":"..."}
```

---

## 3. Stripe setup (optional — needed only for real credit purchases)

1. https://dashboard.stripe.com → get your **Secret key** → put it in the
   backend's `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → Add endpoint → URL:
   `https://YOUR-BACKEND-URL/api/payments/webhook` → select event
   `checkout.session.completed` → save, then copy the **Signing secret**
   into `STRIPE_WEBHOOK_SECRET`.
3. Set `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` in `.env` to pages the user
   lands on after paying (can be simple static pages on any domain you own,
   or deep links back into the app — see Capacitor's App URL Scheme docs if
   you want `vibelens://payment-success` style deep links).
4. Redeploy the backend after changing `.env` so the new values take effect.

Until you do this, the "Top Up" button will show an error — every other
feature (sign-up, free credits, all AI tools) works fine without Stripe.

---

## 4. Configure and build the mobile app (Capacitor)

### 4.1 Point the app at your backend + Firebase

Edit `frontend/www/app-config.js`:

```js
window.VIBELENS_CONFIG = {
  BACKEND_URL: "https://YOUR-BACKEND-URL",      // from step 2
  FIREBASE_CONFIG: {
    apiKey: "...",            // from step 1.5
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
};
```

### 4.2 Install tooling and initialize native projects

```bash
cd frontend
npm install
npx cap add android
npx cap add ios       # macOS only — iOS builds require Xcode on a Mac
npx cap sync
```

This generates the `android/` and `ios/` folders (gitignored — they're
regenerated from `www/` + config, not hand-edited as source of truth).

### 4.3 Generate icons & splash screens

Put your `icon.png` (1024×1024) and `splash.png` (2732×2732) into
`frontend/resources/` (see `resources/README.md`), then:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate
npx cap sync
```

### 4.4 Required native permissions

The app uploads photos, so both platforms need camera/photo permissions
declared. Capacitor's file input already triggers the system photo picker on
both platforms, but you should still declare intent strings:

**Android** — `android/app/src/main/AndroidManifest.xml`, inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```
(As of Android 13+/API 33+, prefer the system Photo Picker — Capacitor's
default file input already does this, so you do NOT need broad storage
permissions; Google now penalizes apps that request more than necessary.)

**iOS** — `ios/App/App/Info.plist`, add:
```xml
<key>NSCameraUsageDescription</key>
<string>VibeLens AI needs camera access so you can take a photo to transform.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>VibeLens AI needs photo library access so you can upload a picture to transform.</string>
```

### 4.5 Google Sign-In native config (important — web OAuth alone won't work in-app)

Firebase's `signInWithPopup` (used in `index.html`) works in a mobile
WebView but for a smoother native Google Sign-In experience and to avoid
Play Store / App Store review friction around in-app browsers, install the
official Capacitor Firebase Authentication plugin instead:

```bash
npm install @capacitor-firebase/authentication
npx cap sync
```

Follow https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/authentication
to add the Android `google-services.json` (download from Firebase Console →
Project Settings → your Android app) and iOS `GoogleService-Info.plist`
(same path, your iOS app), and register the matching OAuth client IDs in
Firebase Authentication → Sign-in method → Google → add your app's SHA-1
(Android) / bundle ID (iOS). This is the most fiddly part of the whole setup —
budget extra time here specifically for Google Sign-In on native.

If you'd rather ship faster first and add native Google Sign-In later, you
can launch with **email/password sign-in only** (already fully wired) and
re-enable the Google button once the native plugin is configured.

---

## 5. Android — build & publish to Google Play

### 5.1 One-time account setup
1. https://play.google.com/console/signup → pay the **one-time $25 fee** →
   complete identity verification (can take a few hours to a few days).
2. Enable **2-step verification** on the Google account used — Play Console
   now requires it for all users.

### 5.2 Build a signed release (Android App Bundle — required format)

```bash
cd frontend
npx cap sync android
cd android
```

Generate an upload key (one-time, keep this file and its password safe
forever — losing it complicates future updates):
```bash
keytool -genkeypair -v -keystore vibelens-release.keystore \
  -alias vibelens -keyalg RSA -keysize 2048 -validity 10000
```

In `android/app/build.gradle`, set up the signing config to reference that
keystore (Android Studio's Build → Generate Signed Bundle/APK wizard does
this for you interactively if you'd rather not hand-edit Gradle).

Then build the release **AAB** (Android App Bundle — Google requires this
format, plain APKs are no longer accepted for new apps):
```bash
./gradlew bundleRelease
# output: android/app/build/outputs/bundle/release/app-release.aab
```

### 5.3 Target API level

As of June 2026, new submissions must target at least **API 35 (Android 15)**
today, rising to **API 36 (Android 16) starting August 31, 2026**. Capacitor 6
defaults to a recent `compileSdkVersion`/`targetSdkVersion` already — open
`android/variables.gradle` and confirm `targetSdkVersion` is set to `35` or
higher (`36` if you're building close to or after the August 2026 cutover).

### 5.4 Create the store listing

In Play Console → your app → Grow → Store presence → Main store listing, you need:
- App name, short description (≤80 chars), full description (≤4000 chars)
- App icon (512×512 PNG)
- Feature graphic (1024×500 PNG/JPG)
- At least 2 phone screenshots (16:9 or 9:16, JPG/PNG, min 320px side)
- Privacy policy URL (**mandatory** — see §7 below; an app collecting photos,
  email, and processing them via a third-party AI API absolutely needs one)
- Data safety form (Policy → App content → Data safety) — declare that you
  collect: email (for account), photos (user-uploaded, processed via OpenAI),
  and that data is sent to a third party (OpenAI) for processing.
- Content rating questionnaire (Policy → App content → Content ratings)
- Target audience & ads declaration

### 5.5 Closed testing (mandatory for most new personal accounts)

Personal Play Console accounts created after November 13, 2023 must run a
**closed test with at least 12 testers opted in for 14 continuous days**
before production access unlocks. To do this:
1. Release → Testing → Closed testing → create a track → upload your AAB.
2. Add at least 12 tester emails (a Google Group or email list works) and
   share the opt-in link with them.
3. Wait out the 14 continuous days with testers actually having opted in.
4. Once the requirement is met, Play Console unlocks the **Production**
   release track's questionnaire and final review.

(Organization accounts and accounts created before Nov 13, 2023 are exempt
from this specific requirement, but everything else above still applies.)

### 5.6 Submit to production

Release → Production → Create release → upload the same (or a newer) AAB →
fill in release notes → Review release → Start rollout. Google's review
typically takes a few hours to a few days for the first submission.

---

## 6. iOS — build & publish to the App Store

### 6.1 One-time account setup
1. https://developer.apple.com/programs/enroll/ → pay the **$99/year** Apple
   Developer Program fee → wait for approval (usually same-day to 48 hours).
2. You need a Mac with **Xcode 26 or later** — as of April 28, 2026, Apple
   requires all App Store Connect uploads to be built with Xcode 26+ and an
   iOS 26 SDK or later (this only affects your *build toolchain*; your
   `Deployment Target` can still be an older iOS version like 16 or 17 so
   the app still installs on users' older devices).

### 6.2 Build the iOS project

```bash
cd frontend
npx cap sync ios
npx cap open ios
```
This opens Xcode. There:
1. Select your Team under Signing & Capabilities (requires the paid account
   from 6.1).
2. Set a unique Bundle Identifier (e.g. `com.yourcompany.vibelens`) — must
   match what you register in App Store Connect in 6.3.
3. Confirm `Deployment Target` (e.g. iOS 16.0) and that the project is being
   built against the iOS 26 SDK (Xcode 26 does this by default).
4. Product → Archive → once archived, Organizer opens → **Validate App**
   first (catches most rejection-causing issues before you waste a review
   cycle) → then **Distribute App** → App Store Connect → Upload.

### 6.3 Create the App Store Connect listing

https://appstoreconnect.apple.com → My Apps → + → New App:
- Platform: iOS. Name, primary language, Bundle ID (must match Xcode),
  SKU (any internal string).
- App Information: category, content rights, age rating questionnaire
  (Apple updated their age-rating system in 2026 — answer the new
  questions; due by Jan 31 2026 for existing apps, immediately relevant
  for new ones).
- Pricing and Availability: Free (credits are sold as in-app purchases or
  via your own Stripe checkout — see note below).
- App Privacy: fill in the **Privacy Nutrition Label** — declare data
  types collected (Email Address, Photos/Videos, User Content) and that
  they're linked to the user's identity and used for App Functionality.
  Since photos are sent to OpenAI, also disclose **Third-Party Data Sharing**.
- Screenshots: required for at least one device size per supported device
  family (6.5" / 6.9" iPhone at minimum). App previews (video) optional.
- Build: select the build you uploaded from Xcode in 6.2 (can take 15–60
  minutes after upload to finish processing and appear here).

> **Important Apple policy note on payments:** Apple requires apps that sell
> digital goods/credits consumed inside the app to use **Apple's In-App
> Purchase (IAP)** system, not an external payment flow like the Stripe
> Checkout this project ships with by default — using Stripe directly for
> credits *inside* the iOS app is likely to get the build rejected under
> App Store Review Guideline 3.1.1. Before submitting to Apple, either:
> (a) implement StoreKit-based IAP for credit packs on iOS specifically
> (the Android/web versions can keep Stripe), or (b) keep credits free/ad
> supported on iOS and sell top-ups only via your website outside the app.
> This guide's code ships Stripe everywhere as the simpler cross-platform
> default — budget extra time for StoreKit if you want iOS purchases.

### 6.4 TestFlight (recommended before public submission)

App Store Connect → TestFlight tab → add your uploaded build → invite
internal/external testers → get real device feedback before hitting Submit
for Review. Not strictly mandatory like Google's closed-testing rule, but
strongly recommended — it catches the same class of bugs.

### 6.5 Submit for review

App Store Connect → your app version → Submit for Review. Answer the
Export Compliance / Advertising Identifier / Content Rights questions
truthfully (this app uses standard HTTPS encryption only, so "No" is
typically correct for the encryption export question — confirm against
your actual implementation). Apple's review is usually 24–48 hours but can
take longer on first submission or if flagged for manual review.

---

## 7. Privacy Policy & legal pages (required by both stores)

Because this app collects email addresses, accepts user-uploaded photos,
and sends those photos to a third party (OpenAI) for processing, **you must
publish a real, hosted Privacy Policy** before either store will approve
the app. At minimum it must disclose:
- What data you collect (email, photos, usage/credit history)
- That uploaded photos are sent to OpenAI for AI processing, and link to
  OpenAI's own data usage policy
- How users can request account/data deletion
- Your contact information

Host it as a simple static page (a one-page site on Render/Vercel/GitHub
Pages is enough) and put that URL into both the Play Console listing and
App Store Connect's App Privacy section. This is **not optional** — apps
without one are rejected outright by both stores.

---

## 8. Post-launch operational notes

- **Cost control**: the backend's `express-rate-limit` config in
  `server.js` caps AI calls per IP per 15 minutes — tune `max` in
  `aiLimiter` to match your budget once you see real usage volume.
- **Monitoring**: watch your OpenAI usage dashboard and Firebase usage
  dashboard for the first few weeks after launch — image generation costs
  scale directly with daily active users.
- **Updating the app**: changes to `frontend/www/*` require `npx cap sync`
  + a new build + a new store submission (both stores re-review every
  update, though usually faster than the first one). Backend changes can
  deploy independently and instantly — most feature changes (new prompts,
  new credit costs) only require a backend redeploy, no app store update.
