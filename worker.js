// Publish API for the editor. Holds the GitHub token so the browser never sees it.
//   POST /articles        {t,a,s}            -> {id, editKey}   (creates articles/<id>.json)
//   PUT  /articles/<id>   {t,a,s,editKey}    -> {id}            (only with the right edit key)
// Required: secret GH_TOKEN; vars GH_OWNER, GH_REPO, ALLOWED_ORIGIN; optional GH_BRANCH.

const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 chars -> byte & 31 is unbiased
const ID_RE = /^[a-z2-9]{6,12}$/;
const MAX_BODY = 1_500_000;   // bytes of request body
const MAX_TITLE = 1000, MAX_AUTHOR = 500;

const enc = new TextEncoder();
const json = (obj, status, headers) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...headers } });

function newId() { const b = crypto.getRandomValues(new Uint8Array(8)); let s = ''; for (const x of b) s += ALPHA[x & 31]; return s; }
function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(24)); let bin = '';
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');   // 32 chars, [A-Za-z0-9_-]
}
async function sha256hex(str) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function b64(str) { const bytes = enc.encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }

function ghUrl(env, id) {
  return `https://api.github.com/repos/${encodeURIComponent(env.GH_OWNER)}/${encodeURIComponent(env.GH_REPO)}/contents/articles/${id}.json`;
}
function ghHeaders(env, accept) {
  return { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: accept || 'application/vnd.github+json',
           'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'telegraph-publisher' };
}
const refQs = env => env.GH_BRANCH ? `?ref=${encodeURIComponent(env.GH_BRANCH)}` : '';

function put(env, id, content, sha) {
  const body = { message: `${sha ? 'Update' : 'Add'} article ${id}`, content };
  if (sha) body.sha = sha;
  if (env.GH_BRANCH) body.branch = env.GH_BRANCH;
  return fetch(ghUrl(env, id), { method: 'PUT', headers: { ...ghHeaders(env), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function validate(p) {
  if (!p || typeof p !== 'object') return 'Invalid body.';
  for (const k of ['t', 'a', 's']) if (typeof p[k] !== 'string') return 'Invalid article.';
  if (p.t.length > MAX_TITLE || p.a.length > MAX_AUTHOR) return 'Title or author is too long.';
  if (!p.t.trim() && !p.s.trim()) return 'Article is empty.';
  return null;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, 'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return json({ error: 'Origin not allowed.' }, 403, {});

    if (env.LIMITER) {   // optional Workers Rate Limiting binding (per Cloudflare location, a loose filter)
      const { success } = await env.LIMITER.limit({ key: req.headers.get('cf-connecting-ip') || 'unknown' });
      if (!success) return json({ error: 'Too many requests. Please wait a minute.' }, 429, cors);
    }

    const m = new URL(req.url).pathname.match(/^\/articles(?:\/([a-z2-9]{6,12}))?\/?$/);
    if (!m) return json({ error: 'Not found.' }, 404, cors);
    const id = m[1];
    if ((req.method === 'POST' && id) || (req.method === 'PUT' && !id) || (req.method !== 'POST' && req.method !== 'PUT'))
      return json({ error: 'Method not allowed.' }, 405, cors);

    const len = Number(req.headers.get('Content-Length') || 0);
    if (len > MAX_BODY) return json({ error: 'Article is too large (limit about 1.5 MB). Use smaller images.' }, 413, cors);
    const text = await req.text();
    if (enc.encode(text).length > MAX_BODY) return json({ error: 'Article is too large (limit about 1.5 MB). Use smaller images.' }, 413, cors);
    let p; try { p = JSON.parse(text); } catch { return json({ error: 'Invalid JSON.' }, 400, cors); }
    const bad = validate(p); if (bad) return json({ error: bad }, 400, cors);

    try {
      if (req.method === 'POST') {
        const editKey = newKey();
        const doc = { v: 1, t: p.t, a: p.a, s: p.s, k: await sha256hex(editKey), u: Date.now() };
        const content = b64(JSON.stringify(doc));
        for (let i = 0; i < 5; i++) {
          const nid = newId();
          const res = await put(env, nid, content, null);
          if (res.ok) return json({ id: nid, editKey }, 201, cors);
          if (res.status === 422) continue;                       // id already exists -> try another
          if (res.status === 409) { await new Promise(r => setTimeout(r, 150 * (i + 1))); continue; }  // concurrent commit
          console.error('GitHub create failed', res.status);
          return json({ error: 'Could not save the article. Please try again.' }, 502, cors);
        }
        return json({ error: 'Server is busy. Please try again.' }, 503, cors);
      }

      // PUT: update with edit key
      if (typeof p.editKey !== 'string' || p.editKey.length < 20 || p.editKey.length > 64)
        return json({ error: 'Missing edit key.' }, 403, cors);
      const keyHash = await sha256hex(p.editKey);
      for (let i = 0; i < 3; i++) {
        const meta = await fetch(ghUrl(env, id) + refQs(env), { headers: ghHeaders(env) });
        if (meta.status === 404) return json({ error: 'Article not found.' }, 404, cors);
        if (!meta.ok) { console.error('GitHub meta failed', meta.status); return json({ error: 'Could not read the article.' }, 502, cors); }
        const sha = (await meta.json()).sha;
        const rawRes = await fetch(ghUrl(env, id) + refQs(env), { headers: ghHeaders(env, 'application/vnd.github.raw+json') });
        if (!rawRes.ok) return json({ error: 'Could not read the article.' }, 502, cors);
        const old = JSON.parse(await rawRes.text());
        if (!safeEqual(old.k || '', keyHash)) return json({ error: 'Wrong edit key.' }, 403, cors);
        const doc = { v: 1, t: p.t, a: p.a, s: p.s, k: old.k, u: Date.now() };
        const res = await put(env, id, b64(JSON.stringify(doc)), sha);
        if (res.ok) return json({ id }, 200, cors);
        if (res.status === 409 || res.status === 422) { await new Promise(r => setTimeout(r, 150 * (i + 1))); continue; }
        console.error('GitHub update failed', res.status);
        return json({ error: 'Could not save the article. Please try again.' }, 502, cors);
      }
      return json({ error: 'The article changed while saving. Please try again.' }, 409, cors);
    } catch (e) {
      console.error('Unhandled', e && e.message);
      return json({ error: 'Server error. Please try again.' }, 500, cors);
    }
  }
};
