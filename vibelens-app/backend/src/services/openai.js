const fetch = require('node-fetch');
const FormData = require('form-data');

const OPENAI_BASE = 'https://api.openai.com/v1';

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not configured on the server.');
  return key;
}

/**
 * Text generation via Chat Completions — used for quote text and prompt text.
 */
async function chatComplete(promptText, maxTokens = 120) {
  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: promptText }]
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI chat error: ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Generate a brand-new image from a text prompt only (no input photo).
 */
async function generateImage(promptText, size = '1024x1024') {
  const resp = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`
    },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: promptText, size })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI image error: ${resp.status}`);
  }
  const data = await resp.json();
  return extractImage(data);
}

/**
 * Edit/transform an uploaded photo using a prompt. This is the workhorse call
 * for Enhance, Outfit, Background, Beauty, Poster, and Photo Shoot poses.
 *
 * `fileBuffer` is the raw image bytes (from multer memory storage),
 * `mimeType` and `filename` describe it for the multipart upload to OpenAI.
 */
async function editImage(fileBuffer, filename, mimeType, promptText, size = '1024x1024') {
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('image', fileBuffer, { filename, contentType: mimeType });
  form.append('prompt', promptText);
  form.append('size', size);

  const resp = await fetch(`${OPENAI_BASE}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...form.getHeaders()
    },
    body: form
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI image edit error: ${resp.status}`);
  }
  const data = await resp.json();
  return extractImage(data);
}

function extractImage(data) {
  const item = data.data?.[0];
  if (!item) throw new Error('OpenAI returned no image data.');
  if (item.b64_json) return { type: 'base64', value: item.b64_json };
  if (item.url) return { type: 'url', value: item.url };
  throw new Error('Unrecognized OpenAI image response shape.');
}

module.exports = { chatComplete, generateImage, editImage };
