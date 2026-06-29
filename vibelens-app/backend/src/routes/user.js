const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const credits = require('../services/credits');

/**
 * POST /api/user/bootstrap
 * Called once right after the client signs in with Firebase Auth.
 * Creates the Firestore user doc (with free signup credits) if it doesn't exist yet.
 */
router.post('/bootstrap', requireAuth, async (req, res) => {
  try {
    const { uid, email, name } = req.user;
    await credits.ensureUserDoc(uid, { email, name });
    const user = await credits.getUser(uid);
    res.json({ user });
  } catch (err) {
    console.error('[user/bootstrap]', err);
    res.status(500).json({ error: 'Failed to initialize user.' });
  }
});

/**
 * GET /api/user/me
 * Returns the current credit balance and profile.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await credits.getUser(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found. Call /bootstrap first.' });
    res.json({ user });
  } catch (err) {
    console.error('[user/me]', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

/**
 * GET /api/user/history
 * Returns the most recent credit history entries.
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const items = await credits.getHistory(req.user.uid, 50);
    res.json({ history: items });
  } catch (err) {
    console.error('[user/history]', err);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

module.exports = router;
