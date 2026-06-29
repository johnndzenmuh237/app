const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const credits = require('../services/credits');

let stripe = null;
function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured.');
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// Keep plan definitions server-side so prices/credit amounts can't be tampered with client-side.
const PLANS = {
  starter: { credits: 50, usd: 1000, label: 'Starter — 50 credits' },     // amounts in cents
  creator: { credits: 150, usd: 2500, label: 'Creator — 150 credits' },
  pro: { credits: 400, usd: 6000, label: 'Pro Studio — 400 credits' }
};

/**
 * POST /api/payments/create-checkout-session
 * body: { plan: 'starter' | 'creator' | 'pro' }
 * Returns a Stripe Checkout URL the client opens (in-app browser or system browser).
 */
router.post('/create-checkout-session', requireAuth, express.json(), async (req, res) => {
  try {
    const { plan } = req.body;
    const def = PLANS[plan];
    if (!def) return res.status(400).json({ error: 'Unknown plan.' });

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: def.label },
          unit_amount: def.usd
        },
        quantity: 1
      }],
      metadata: { uid: req.user.uid, plan, creditsToAdd: String(def.credits) },
      success_url: process.env.STRIPE_SUCCESS_URL || 'https://yourdomain.com/payment-success',
      cancel_url: process.env.STRIPE_CANCEL_URL || 'https://yourdomain.com/payment-cancelled'
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[payments/create-checkout-session]', err);
    res.status(500).json({ error: err.message || 'Could not start checkout.' });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe calls this directly (not the app). Must be mounted with the RAW body
 * parser — see server.js — so the signature can be verified.
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[payments/webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    const creditsToAdd = parseInt(session.metadata?.creditsToAdd || '0', 10);
    const plan = session.metadata?.plan || 'unknown';
    if (uid && creditsToAdd > 0) {
      try {
        await credits.addCredits(uid, creditsToAdd, `💳 Purchased ${creditsToAdd} credits (${plan})`);
        console.log(`[payments/webhook] Credited ${creditsToAdd} to ${uid} for plan ${plan}`);
      } catch (err) {
        console.error('[payments/webhook] Failed to add credits:', err);
      }
    }
  }

  res.json({ received: true });
});

module.exports = router;
