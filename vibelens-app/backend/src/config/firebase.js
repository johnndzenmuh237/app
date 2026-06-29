const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    if (raw && raw.trim().startsWith('{')) {
      // Option A: full service account JSON pasted into env var
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
      });
    } else {
      // Option B: Application Default Credentials (Cloud Run, App Engine, GCE, etc.)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    initialized = true;
    console.log('[firebase] Admin SDK initialized for project:', process.env.FIREBASE_PROJECT_ID);
  } catch (err) {
    console.error('[firebase] Failed to initialize Admin SDK:', err.message);
    throw err;
  }

  return admin;
}

module.exports = { initFirebase, admin };
