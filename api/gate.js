const fs = require('fs');
const path = require('path');

function isAuthenticated(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/twill_demo=([^;]+)/);
  if (!match) return false;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    return decoded.includes(process.env.COOKIE_SECRET);
  } catch {
    return false;
  }
}

module.exports = (req, res) => {
  if (!isAuthenticated(req)) {
    res.writeHead(302, { Location: '/login' });
    res.end();
    return;
  }

  const filePath = path.join(process.cwd(), 'index.html');
  const content = fs.readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(content);
};
