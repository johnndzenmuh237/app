// ============================================================
// VibeLens AI — Backend API Client
// Every AI / credit / payment call goes through OUR backend now.
// No API keys live in this file or anywhere in the app bundle.
// ============================================================
(function () {
  const BASE = (window.VIBELENS_CONFIG && window.VIBELENS_CONFIG.BACKEND_URL) || '';

  async function getIdToken() {
    if (!window.firebase || !firebase.auth().currentUser) {
      throw new Error('Not signed in.');
    }
    return firebase.auth().currentUser.getIdToken();
  }

  async function authedFetch(path, options = {}) {
    const token = await getIdToken();
    const headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + token });
    const resp = await fetch(BASE + path, { ...options, headers });
    if (!resp.ok) {
      let msg = 'Request failed (' + resp.status + ')';
      try { const j = await resp.json(); if (j.error) msg = j.error; } catch (_) {}
      const err = new Error(msg);
      err.status = resp.status;
      throw err;
    }
    return resp.json();
  }

  async function authedUpload(path, file, fields = {}) {
    const token = await getIdToken();
    const fd = new FormData();
    fd.append('image', file);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    const resp = await fetch(BASE + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: fd
    });
    if (!resp.ok) {
      let msg = 'Request failed (' + resp.status + ')';
      try { const j = await resp.json(); if (j.error) msg = j.error; } catch (_) {}
      const err = new Error(msg);
      err.status = resp.status;
      throw err;
    }
    return resp.json();
  }

  window.VibeLensAPI = {
    // ---- user / credits ----
    bootstrap: () => authedFetch('/api/user/bootstrap', { method: 'POST' }),
    me: () => authedFetch('/api/user/me'),
    history: () => authedFetch('/api/user/history'),

    // ---- AI generation (each uploads the image + a prompt, returns { image }) ----
    enhance: (file, prompt) => authedUpload('/api/ai/enhance', file, { prompt }),
    outfit: (file, prompt) => authedUpload('/api/ai/outfit', file, { prompt }),
    background: (file, prompt) => authedUpload('/api/ai/background', file, { prompt }),
    beauty: (file, prompt) => authedUpload('/api/ai/beauty', file, { prompt }),
    poster: (file, prompt) => authedUpload('/api/ai/poster', file, { prompt }),
    photoQuote: (file, prompt) => authedUpload('/api/ai/photo-quote', file, { prompt }),

    photoshootStart: () => authedFetch('/api/ai/photoshoot-start', { method: 'POST' }),
    photoshootPose: (file, prompt) => authedUpload('/api/ai/photoshoot-pose', file, { prompt }),

    quoteText: (category) => authedFetch('/api/ai/quote-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    }),
    quoteDownload: (posterName) => authedFetch('/api/ai/quote-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posterName })
    }),

    // ---- payments ----
    createCheckoutSession: (plan) => authedFetch('/api/payments/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    })
  };
})();
