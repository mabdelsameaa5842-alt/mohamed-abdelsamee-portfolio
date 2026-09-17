import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow POST from automation engine to succeed smoothly
  if (req.method === 'POST') {
    return res.status(200).json({
      success: true,
      message: 'Article payload acknowledged by Edge Bridge',
      slug: req.body?.slug || req.body?.article_slug || null,
    });
  }

  let baseArticles = [];
  try {
    const jsonPath = path.join(process.cwd(), 'api', 'default_articles.json');
    if (fs.existsSync(jsonPath)) {
      baseArticles = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading default_articles.json:', e);
  }

  const { slug } = req.query || {};
  const cleanSlug = slug ? String(slug).replace(/\/index\.html$/i, '').replace(/index\.html$/i, '').replace(/\/$/, '') : null;

  // If specific slug is requested:
  if (cleanSlug) {
    const localMatch = baseArticles.find(a => a.slug === cleanSlug);
    if (localMatch && localMatch.content && localMatch.content.length > 200) {
      return res.status(200).json(localMatch);
    }

    // Query OpenSEO Edge Worker for live dynamic content
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const workerResp = await fetch(
        `https://open-seo.abdelsameaa.workers.dev/api/public/autonomous-articles?slug=${encodeURIComponent(cleanSlug)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (workerResp.ok) {
        const liveArticle = await workerResp.json();
        if (liveArticle && liveArticle.slug) {
          return res.status(200).json(liveArticle);
        }
      }
    } catch (err) {
      console.warn('[API Articles] Worker query failed:', err.message);
    }

    // If localMatch existed with at least metadata, return it
    if (localMatch) {
      return res.status(200).json(localMatch);
    }

    return res.status(404).json({ error: 'Article not found' });
  }

  // For full articles list: merge baseArticles + live autonomous articles
  let mergedArticles = [...baseArticles];
  const existingSlugs = new Set(baseArticles.map(a => a.slug));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const workerResp = await fetch(
      'https://open-seo.abdelsameaa.workers.dev/api/public/autonomous-articles',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (workerResp.ok) {
      const autoArticles = await workerResp.json();
      if (Array.isArray(autoArticles)) {
        for (const autoArt of autoArticles) {
          if (autoArt.slug && !existingSlugs.has(autoArt.slug)) {
            mergedArticles.unshift(autoArt); // Add latest autonomous articles at the top
            existingSlugs.add(autoArt.slug);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[API Articles] List fetch from worker failed, serving local base:', err.message);
  }

  return res.status(200).json(mergedArticles);
}
