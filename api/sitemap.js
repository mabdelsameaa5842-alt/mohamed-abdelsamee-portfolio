export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=0, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const workerResp = await fetch(
      'https://open-seo.abdelsameaa.workers.dev/api/autonomous/sitemap',
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (workerResp.ok) {
      const xml = await workerResp.text();
      return res.status(200).send(xml);
    }
    return res.status(502).send('<!-- Error fetching live sitemap from worker -->');
  } catch (err) {
    console.error('Sitemap proxy error:', err);
    return res.status(500).send(`<!-- Sitemap error: ${err.message} -->`);
  }
}
