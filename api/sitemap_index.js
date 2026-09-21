export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate');
  return res.redirect(301, '/sitemap.xml');
}
