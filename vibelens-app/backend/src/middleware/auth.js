const { initFirebase } = require('../config/firebase');

/**
 * Verifies the Firebase ID token sent in the Authorization header
 * (format: "Bearer <idToken>"). Attaches the decoded token to req.user.
 *
 * The client gets this idToken from Firebase Auth after Google/email sign-in
 * and must send it with every request to a protected route.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: 'Missing Authorization header. Expected: Bearer <firebase-id-token>' });
    }
    const idToken = match[1];
    const admin = initFirebase();
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded; // contains uid, email, etc.
    next();
  } catch (err) {
    console.error('[auth] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

module.exports = { requireAuth };
