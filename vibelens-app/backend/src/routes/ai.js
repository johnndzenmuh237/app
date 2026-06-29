const express = require('express');
const multer = require('multer');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const credits = require('../services/credits');
const openai = require('../services/openai');

// Images held in memory only long enough to forward to OpenAI — never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB, matches the upload-zone copy in the UI
});

const COST = {
  enhance: parseInt(process.env.CREDIT_COST_ENHANCE || '2', 10),
  outfit: parseInt(process.env.CREDIT_COST_OUTFIT || '5', 10),
  background: parseInt(process.env.CREDIT_COST_BACKGROUND || '3', 10),
  beauty: parseInt(process.env.CREDIT_COST_BEAUTY || '3', 10),
  poster: parseInt(process.env.CREDIT_COST_POSTER || '4', 10),
  photoshoot: parseInt(process.env.CREDIT_COST_PHOTOSHOOT || '10', 10),
  photoquote: parseInt(process.env.CREDIT_COST_PHOTOQUOTE || '2', 10),
  quoteDownload: parseInt(process.env.CREDIT_COST_QUOTE_DOWNLOAD || '1', 10)
};

function imageResultPayload(result) {
  // Normalizes OpenAI's {type, value} into a data URL or pass-through URL for the client.
  if (result.type === 'base64') return { image: `data:image/png;base64,${result.value}` };
  return { image: result.value };
}

async function chargeOrFree(uid, isFreeEligible, cost, label, consumeFree) {
  if (isFreeEligible) {
    const gotFree = await consumeFree(uid);
    if (gotFree) return { charged: false };
  }
  await credits.deductCredits(uid, cost, label);
  return { charged: true, cost };
}

// ----------------------------------------------------------------
// POST /api/ai/enhance  (multipart: image, fields: mode, style)
// First enhance per user is free; subsequent ones cost CREDIT_COST_ENHANCE.
// ----------------------------------------------------------------
router.post('/enhance', requireAuth, upload.single('image'), async (req, res) => {
  const uid = req.user.uid;
  let billing;
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

    billing = await chargeOrFree(uid, true, COST.enhance, '🖼 Photo Enhancement', credits.tryConsumeFreeEnhance);

    const result = await openai.editImage(req.file.buffer, req.file.originalname, req.file.mimetype, prompt);
    res.json({ ...imageResultPayload(result), billing });
  } catch (err) {
    console.error('[ai/enhance]', err);
    if (billing?.charged) await credits.refundCredits(uid, COST.enhance, 'Refund — enhance failed').catch(() => {});
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    res.status(500).json({ error: err.message || 'Enhancement failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/outfit  (multipart: image, fields: prompt)
// ----------------------------------------------------------------
router.post('/outfit', requireAuth, upload.single('image'), async (req, res) => {
  const uid = req.user.uid;
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

    await credits.deductCredits(uid, COST.outfit, '👔 Outfit Change');
    const result = await openai.editImage(req.file.buffer, req.file.originalname, req.file.mimetype, prompt);
    res.json(imageResultPayload(result));
  } catch (err) {
    console.error('[ai/outfit]', err);
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    await credits.refundCredits(uid, COST.outfit, 'Refund — outfit failed').catch(() => {});
    res.status(500).json({ error: err.message || 'Outfit change failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/background  (multipart: image, fields: prompt)
// ----------------------------------------------------------------
router.post('/background', requireAuth, upload.single('image'), async (req, res) => {
  const uid = req.user.uid;
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

    await credits.deductCredits(uid, COST.background, '🌅 Background Swap');
    const result = await openai.editImage(req.file.buffer, req.file.originalname, req.file.mimetype, prompt);
    res.json(imageResultPayload(result));
  } catch (err) {
    console.error('[ai/background]', err);
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    await credits.refundCredits(uid, COST.background, 'Refund — background failed').catch(() => {});
    res.status(500).json({ error: err.message || 'Background swap failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/beauty  (multipart: image, fields: prompt)
// ----------------------------------------------------------------
router.post('/beauty', requireAuth, upload.single('image'), async (req, res) => {
  const uid = req.user.uid;
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

    await credits.deductCredits(uid, COST.beauty, '💆 Beauty Enhancement');
    const result = await openai.editImage(req.file.buffer, req.file.originalname, req.file.mimetype, prompt);
    res.json(imageResultPayload(result));
  } catch (err) {
    console.error('[ai/beauty]', err);
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    await credits.refundCredits(uid, COST.beauty, 'Refund — beauty failed').catch(() => {});
    res.status(500).json({ error: err.message || 'Beauty enhancement failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/poster  (multipart: image, fields: prompt)
// ----------------------------------------------------------------
router.post('/poster', requireAuth, upload.single('image'), async (req, res) => {
  const uid = req.user.uid;
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

    await credits.deductCredits(uid, COST.poster, '🎨 Poster Generator');
    const result = await openai.editImage(req.file.buffer, req.file.originalname, req.file.mimetype, prompt);
    res.json(imageResultPayload(result));
  } catch (err) {
    console.error('[ai/poster]', err);
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    await credits.refundCredits(uid, COST.poster, 'Refund — poster failed').catch(() => {});
    res.status(500).json({ error: err.message || 'Poster generation failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/photo-quote  (multipart: image, fields: prompt)
// ----------------------------------------------------------------
router.post('/photo-quote', requireAuth, upload.single('image'), async (req, res) => {
  const uid = req.user.uid;
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });

    await credits.deductCredits(uid, COST.photoquote, '📝 Photo + Quote');
    const result = await openai.editImage(req.file.buffer, req.file.originalname, req.file.mimetype, prompt);
    res.json(imageResultPayload(result));
  } catch (err) {
    console.error('[ai/photo-quote]', err);
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    await credits.refundCredits(uid, COST.photoquote, 'Refund — photo quote failed').catch(() => {});
    res.status(500).json({ error: err.message || 'Photo + quote generation failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/photoshoot-pose  (multipart: image, fields: prompt, poseName)
// Called once per pose by the client (the UI loops this for the poses it wants).
// Credits for the whole 20-pose shoot are deducted via /photoshoot-start below.
// ----------------------------------------------------------------
router.post('/photoshoot-start', requireAuth, async (req, res) => {
  const uid = req.user.uid;
  try {
    await credits.deductCredits(uid, COST.photoshoot, '📸 AI Photo Shoot (20 poses)');
    res.json({ ok: true, charged: COST.photoshoot });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    console.error('[ai/photoshoot-start]', err);
    res.status(500).json({ error: 'Could not start photo shoot.' });
  }
});

router.post('/photoshoot-pose', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt.' });
    const result = await openai.editImage(req.file.buffer, req.file.originalname, req.file.mimetype, prompt);
    res.json(imageResultPayload(result));
  } catch (err) {
    console.error('[ai/photoshoot-pose]', err);
    // Individual pose failures are not refunded automatically — the shoot-level
    // charge already happened. The client should show that pose slot as failed
    // and let the user retry it (re-call this route) without an extra charge.
    res.status(500).json({ error: err.message || 'Pose generation failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/quote-text  (JSON: { category })
// Free — no credit deduction. Used for the "generate a fresh quote" feature.
// ----------------------------------------------------------------
router.post('/quote-text', requireAuth, express.json(), async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) return res.status(400).json({ error: 'Missing category.' });
    const text = await openai.chatComplete(
      `Generate ONE powerful original quote about "${category}". Return ONLY the quote text, no quote marks, no author, no explanation. Max 2 sentences. Be punchy and cinematic.`,
      80
    );
    res.json({ quote: text });
  } catch (err) {
    console.error('[ai/quote-text]', err);
    res.status(500).json({ error: err.message || 'Quote generation failed.' });
  }
});

// ----------------------------------------------------------------
// POST /api/ai/quote-download  (JSON: { posterName })
// Costs CREDIT_COST_QUOTE_DOWNLOAD. No OpenAI call needed — this just gates
// the download credit; the poster image itself was already generated/displayed.
// ----------------------------------------------------------------
router.post('/quote-download', requireAuth, express.json(), async (req, res) => {
  const uid = req.user.uid;
  try {
    const { posterName } = req.body;
    await credits.deductCredits(uid, COST.quoteDownload, '📥 Quote poster download — ' + (posterName || ''));
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_CREDITS') return res.status(402).json({ error: 'Not enough credits.' });
    console.error('[ai/quote-download]', err);
    res.status(500).json({ error: 'Download charge failed.' });
  }
});

module.exports = router;
