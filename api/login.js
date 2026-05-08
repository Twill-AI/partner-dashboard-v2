export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    const params = new URLSearchParams(body);
    const password = params.get('password') || '';

    if (password === process.env.DEMO_PASSWORD) {
      const token = Buffer.from(process.env.DEMO_PASSWORD + ':' + process.env.COOKIE_SECRET).toString('base64');
      res.setHeader('Set-Cookie', `twill_demo=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`);
      res.redirect(302, '/');
    } else {
      res.redirect(302, '/login?error=1');
    }
  });
}
