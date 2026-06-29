const { initFirebase } = require('../config/firebase');

const SIGNUP_FREE_CREDITS = parseInt(process.env.SIGNUP_FREE_CREDITS || '20', 10);

function db() {
  return initFirebase().firestore();
}

/**
 * Ensures a Firestore user doc exists for this uid. Called on first authenticated
 * request after sign-up. Idempotent — safe to call every time.
 */
async function ensureUserDoc(uid, profile = {}) {
  const ref = db().collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      email: profile.email || null,
      displayName: profile.name || profile.displayName || null,
      credits: SIGNUP_FREE_CREDITS,
      freeEnhanceUsed: false,
      paid: false,
      createdAt: new Date().toISOString()
    });
    await db().collection('users').doc(uid).collection('history').add({
      action: '🎁 Welcome bonus — signup credits',
      amount: SIGNUP_FREE_CREDITS,
      type: 'cr',
      time: new Date().toISOString()
    });
  }
  return ref;
}

async function getUser(uid) {
  const snap = await db().collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return { uid, ...snap.data() };
}

/**
 * Atomically deducts `amount` credits if the user has enough.
 * Throws if insufficient — callers should catch and return 402-style response.
 */
async function deductCredits(uid, amount, label) {
  const ref = db().collection('users').doc(uid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('User not found');
    const current = snap.data().credits || 0;
    if (current < amount) {
      const err = new Error('INSUFFICIENT_CREDITS');
      err.code = 'INSUFFICIENT_CREDITS';
      throw err;
    }
    tx.update(ref, { credits: current - amount });
  });
  await ref.collection('history').add({
    action: label,
    amount: -amount,
    type: 'dr',
    time: new Date().toISOString()
  });
}

async function addCredits(uid, amount, label) {
  const ref = db().collection('users').doc(uid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('User not found');
    const current = snap.data().credits || 0;
    tx.update(ref, { credits: current + amount, paid: true });
  });
  await ref.collection('history').add({
    action: label,
    amount: amount,
    type: 'cr',
    time: new Date().toISOString()
  });
}

/**
 * Refunds credits after a failed AI call (e.g. OpenAI error). Same as addCredits
 * but logged distinctly and does not flip the `paid` flag.
 */
async function refundCredits(uid, amount, label) {
  const ref = db().collection('users').doc(uid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('User not found');
    const current = snap.data().credits || 0;
    tx.update(ref, { credits: current + amount });
  });
  await ref.collection('history').add({
    action: '↩️ ' + label,
    amount: amount,
    type: 'cr',
    time: new Date().toISOString()
  });
}

/**
 * One-time free enhancement flag, checked + consumed atomically so a user
 * can't get two free edits via a race condition.
 */
async function tryConsumeFreeEnhance(uid) {
  const ref = db().collection('users').doc(uid);
  let consumed = false;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('User not found');
    if (!snap.data().freeEnhanceUsed) {
      tx.update(ref, { freeEnhanceUsed: true });
      consumed = true;
    }
  });
  return consumed; // true = this call gets the free edit, false = must pay
}

async function getHistory(uid, limit = 50) {
  const snap = await db().collection('users').doc(uid).collection('history')
    .orderBy('time', 'desc').limit(limit).get();
  return snap.docs.map(d => d.data());
}

module.exports = {
  ensureUserDoc,
  getUser,
  deductCredits,
  addCredits,
  refundCredits,
  tryConsumeFreeEnhance,
  getHistory
};
