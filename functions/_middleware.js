/*
 * Password gate for the private client preview (Cloudflare Pages).
 *
 * A root _middleware runs for EVERY request — pages, static assets, and the
 * /api/forms/* functions — so the whole portal sits behind one shared password.
 *
 * The password is read from the PREVIEW_PASSWORD env var (a Cloudflare Pages
 * secret) and is never committed to the repo. If it isn't set the gate fails
 * closed (503) rather than exposing the portal.
 *
 * Flow: unauthenticated request -> branded login page. The form POSTs to
 * /__unlock; on the correct password we set an HttpOnly cookie (sha-256 of the
 * password, so the plaintext never lives in the cookie) and redirect in.
 */

const COOKIE = 'tw_preview';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

async function tokenFor(pw) {
  const data = new TextEncoder().encode('twill-preview::' + pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loginPage(showError) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Twill — Private Preview</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#1C1F2E; color:#EDEDF0; padding:20px; }
  .card { width:360px; max-width:100%; background:#23273A; border:1px solid rgba(255,255,255,.08);
          border-radius:14px; padding:32px 28px; box-shadow:0 24px 70px rgba(0,0,0,.5); }
  .logo { width:38px; height:38px; border-radius:9px; background:#FFDE00; display:flex;
          align-items:center; justify-content:center; font-weight:800; color:#1C1F2E;
          margin-bottom:20px; font-size:20px; }
  h1 { font-size:17px; margin:0 0 5px; letter-spacing:-.01em; }
  p  { font-size:13px; color:#9A9DB0; margin:0 0 22px; line-height:1.55; }
  input { width:100%; padding:12px 14px; border-radius:9px; border:1px solid rgba(255,255,255,.14);
          background:#1C1F2E; color:#EDEDF0; font-size:14px; outline:none; transition:border-color .12s; }
  input:focus { border-color:#FFDE00; }
  button { width:100%; margin-top:13px; padding:12px; border:none; border-radius:9px; background:#FFDE00;
           color:#1C1F2E; font-weight:700; font-size:14px; cursor:pointer; transition:filter .12s; }
  button:hover { filter:brightness(1.06); }
  .err { color:#F2A0A0; font-size:12.5px; margin-top:13px; ${showError ? '' : 'display:none;'} }
  .ft  { margin-top:20px; font-size:11px; color:#6B6E82; text-align:center; letter-spacing:.02em; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/__unlock">
    <div class="logo">T</div>
    <h1>Twill Partner Portal</h1>
    <p>This is a private, confidential preview. Enter the access password to continue.</p>
    <input type="password" name="password" placeholder="Access password" autofocus autocomplete="current-password" required>
    <button type="submit">Unlock preview &rarr;</button>
    <div class="err">Incorrect password — please try again.</div>
    <div class="ft">Twill Payments &middot; Confidential</div>
  </form>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pw = env.PREVIEW_PASSWORD;

  // Fail closed: never expose the portal if no password is configured.
  if (!pw) {
    return new Response('Preview is not configured (missing PREVIEW_PASSWORD).', {
      status: 503,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    });
  }

  const token = await tokenFor(pw);

  // Unlock form submission
  if (request.method === 'POST' && url.pathname === '/__unlock') {
    const form = await request.formData();
    if ((form.get('password') || '') === pw) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/',
          'Set-Cookie': `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return loginPage(true);
  }

  // Already unlocked?
  const cookies = parseCookies(request.headers.get('Cookie'));
  if (cookies[COOKIE] === token) return next();

  // Gate everything else
  return loginPage(false);
}
