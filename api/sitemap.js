import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400');

  // 1. Fetch live dynamic sitemap from OpenSEO Edge Worker (1,240+ URLs with accurate lastmod)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const workerResp = await fetch('https://open-seo.abdelsameaa.workers.dev/api/autonomous/sitemap', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (workerResp.ok) {
      const xml = await workerResp.text();
      if (xml && xml.includes('<urlset') && xml.includes('</urlset>')) {
        return res.status(200).send(xml);
      }
    }
  } catch (err) {
    console.warn('[API Sitemap] Worker fetch failed, using local fallback:', err.message);
  }

  // 2. High-speed local fallback generation from default_articles.json
  const siteUrl = 'https://mohamed-abdelsamee-portfolio.vercel.app';
  const nowIso = new Date().toISOString().split('T')[0];

  let articles = [];
  try {
    const jsonPath = path.join(process.cwd(), 'api', 'default_articles.json');
    if (fs.existsSync(jsonPath)) {
      articles = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
  } catch (e) {
    console.error('[API Sitemap] Error reading default_articles.json:', e);
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/blog</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;

  for (const art of articles) {
    if (!art.slug) continue;
    const cleanSlug = String(art.slug).replace(/^\/?blog\//, '').replace(/\/$/, '');
    xml += `  <url>
    <loc>${siteUrl}/blog/${cleanSlug}</loc>
    <lastmod>${art.publishedAt ? String(art.publishedAt).split('T')[0] : nowIso}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
`;
  }

  xml += '</urlset>\n';
  return res.status(200).send(xml);
}
