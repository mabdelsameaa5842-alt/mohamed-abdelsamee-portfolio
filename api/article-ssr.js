import fs from 'fs';
import path from 'path';

function renderMarkdown(raw) {
  if (!raw) return '';

  const lines = raw.split('\n');
  const out = [];
  let inList = false;
  let inTable = false;
  let tableRows = [];

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  const flushTable = () => {
    if (inTable) {
      if (tableRows.length > 0) {
        let html = '<div style="overflow-x:auto;margin:24px 0;"><table style="width:100%;border-collapse:collapse;text-align:right;font-size:14px;">';
        tableRows.forEach((row, idx) => {
          const cells = row.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
          if (idx === 0) {
            html += '<thead><tr style="background:rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.15);">';
            cells.forEach(c => html += `<th style="padding:10px 14px;color:#FFC400;font-weight:700;">${c}</th>`);
            html += '</tr></thead><tbody>';
          } else if (idx === 1 && row.includes('---')) {
            // separator row, ignore
          } else {
            html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.06);">';
            cells.forEach(c => html += `<td style="padding:10px 14px;color:#CBD5E1;">${c}</td>`);
            html += '</tr>';
          }
        });
        html += '</tbody></table></div>';
        out.push(html);
      }
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) {
      flushList();
      flushTable();
      continue;
    }

    // Markdown Table row
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      inTable = true;
      tableRows.push(line);
      continue;
    } else {
      flushTable();
    }

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      out.push(`<h3>${line.slice(4)}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      out.push(`<h2>${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      out.push(`<h1>${line.slice(2)}</h1>`);
      continue;
    }

    // Blockquote / Proof box
    if (line.startsWith('> ')) {
      flushList();
      const text = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      out.push(`<div class="proof-box">${text}</div>`);
      continue;
    }

    // Bullet List
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        out.push('<ul style="margin-bottom:24px;padding-right:24px;">');
        inList = true;
      }
      const item = line.slice(2)
        .replace(/\[\s*\]/g, '☐')
        .replace(/\[x\]/gi, '☑')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      out.push(`<li style="margin-bottom:8px;">${item}</li>`);
      continue;
    } else {
      flushList();
    }

    // Format inline bold, italic, links
    let formatted = line
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#FFC400;text-decoration:underline;">$1</a>');

    out.push(`<p style="margin-bottom:20px;line-height:1.9;">${formatted}</p>`);
  }

  flushList();
  flushTable();
  return out.join('\n');
}

function optimizeSeoTitle(rawTitle) {
  if (!rawTitle) return 'دليل النمو الرقمي والميديا باينج 2026 | م. محمد عبد السميع';
  const brandSuffix = ' | م. محمد عبد السميع';
  
  // Clean unwanted automated prefixes/suffixes
  let cleaned = rawTitle
    .replace(/^The Ultimate Guide to Guide To\s+/i, 'Guide to ')
    .replace(/^The Ultimate Guide to\s+/i, '')
    .replace(/\s+for Modern Businesses$/i, '')
    .replace(/\s+Comparison & Expert Evaluation \(2026\)$/i, '')
    .replace(/^Top Top\s+/i, 'Top ')
    .replace(/^Top Best\s+/i, 'Best ')
    .replace(/^Guide To Guide To\s+/i, 'Guide to ')
    .replace(/^Automated (?=.*Automation)/i, '')
    .replace(/:\s*Complete Strategic Guide & Implementation$/i, '')
    .trim();

  // If the title already includes the author/brand, do not append brand suffix
  if (cleaned.includes('محمد عبد السميع')) {
    return cleaned;
  }

  // Allow up to 68 characters for Arabic title to retain city/intent uniqueness
  const maxTotalLen = 68;
  const maxBaseLen = maxTotalLen - brandSuffix.length; // ~46 chars

  if (cleaned.length > maxBaseLen) {
    const trimmed = cleaned.slice(0, maxBaseLen);
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace > 24) {
      cleaned = trimmed.slice(0, lastSpace).trim();
    } else {
      cleaned = trimmed.trim();
    }
  }

  cleaned = cleaned.replace(/\s+(for|to|in|of|with|and|the|a|an|في|من|إلى|مع)$/i, '').trim();
  return `${cleaned}${brandSuffix}`;
}

const articleMemoryCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let defaultArticlesMap = null;
function getDefaultArticles() {
  if (!defaultArticlesMap) {
    defaultArticlesMap = new Map();
    try {
      const jsonPath = path.join(process.cwd(), 'api', 'default_articles.json');
      if (fs.existsSync(jsonPath)) {
        const baseArticles = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        for (const a of baseArticles) {
          if (a.slug) defaultArticlesMap.set(a.slug, a);
        }
      }
    } catch (e) {
      console.error('Error reading default_articles.json:', e);
    }
  }
  return defaultArticlesMap;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { slug } = req.query || {};
  let cleanSlug = slug ? String(slug).replace(/\/index\.html$/i, '').replace(/index\.html$/i, '').replace(/\/$/, '') : null;

  if (!cleanSlug) {
    const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
    if (urlParts.length > 1 && urlParts[0] === 'blog') {
      cleanSlug = urlParts[1];
    }
  }

  if (!cleanSlug) {
    return res.status(404).send('Not Found');
  }

  // Automatic 301 Permanent Redirect for legacy -v2 duplicate URLs to protect SEO & resolve duplicate-title warnings
  const articlesMap = getDefaultArticles();
  if (/^.*-v2$/i.test(cleanSlug) && !articlesMap.has(cleanSlug)) {
    const canonicalSlug = cleanSlug.replace(/-v2$/i, '');
    res.setHeader('Location', `/blog/${encodeURIComponent(canonicalSlug)}`);
    return res.status(301).end();
  }

  // 0. Check in-memory fast cache
  let article = null;
  const cached = articleMemoryCache.get(cleanSlug);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    article = cached.article;
  }

  // 1. Check local pre-loaded articles Map (< 0.01ms lookup)
  if (!article) {
    const found = articlesMap.get(cleanSlug);
    if (found && found.content && found.content.length > 200) {
      article = found;
    } else if (found) {
      article = { ...found };
    }
  }

  // 2. If article content is empty or short, fetch full live content from Cloudflare Worker
  if (!article || !article.content || article.content.length < 200) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const workerResp = await fetch(
        `https://open-seo.abdelsameaa.workers.dev/api/public/autonomous-articles?slug=${encodeURIComponent(cleanSlug)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (workerResp.ok) {
        const liveData = await workerResp.json();
        if (liveData && liveData.slug) {
          article = { ...article, ...liveData };
          if (article.content && article.content.length > 200) {
            articleMemoryCache.set(cleanSlug, { article, timestamp: Date.now() });
          }
        }
      }
    } catch (err) {
      console.warn('[SSR Engine] Worker fetch failed:', err.message);
    }
  }

  if (!article) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>المقال غير موجود | م. محمد عبد السميع</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>body{background:#050505;color:#F8FAFC;font-family:sans-serif;text-align:center;padding:80px 20px;}</style>
</head>
<body>
  <h1>404 - لم نتمكن من العثور على هذا المقال</h1>
  <p style="color:#94A3B8;">قد يكون الرابط تم نقله أو تحديثه في جدول الأتمتة.</p>
  <a href="/blog" style="color:#FFC400;font-weight:700;text-decoration:underline;">العودة لجميع المقالات</a>
</body>
</html>`);
  }

  const baseTitle = article.title || 'دليل ميديا باينج وسيو وتوسيع المتاجر';
  const title = baseTitle;
  const seoTitle = optimizeSeoTitle(baseTitle);
  const metaDesc = (article.metaDescription && article.metaDescription.trim().length > 30)
    ? article.metaDescription.trim()
    : (article.excerpt && article.excerpt.trim().length > 30)
      ? article.excerpt.trim()
      : `دليل استراتيجي متخصص في ${baseTitle} لرفع العائد الإعلاني وتصدر محركات البحث العضوي 2026 مع م. محمد عبد السميع.`;
  const canonicalUrl = `https://mohamed-abdelsamee-portfolio.vercel.app/blog/${cleanSlug}`;
  const category = article.category || 'سيو وميديا باينج متقدم';
  const readTime = article.readTime || '7 دقائق قراءة';
  const country = article.country || (cleanSlug.includes('saudi') || baseTitle.includes('سعودي') ? '🇸🇦 سوق السعودية' : (cleanSlug.includes('egypt') || baseTitle.includes('مصر') ? '🇪🇬 سوق مصر' : '🌍 مصر والخليج'));
  const rawBody = article.content || metaDesc;
  const renderedHtml = renderMarkdown(rawBody);
  const publishDate = article.publishedAt || article.published_at || '2026-09-16';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover" />
  <meta name="theme-color" content="#050505" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

  <title>${seoTitle}</title>
  <meta name="description" content="${metaDesc}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- OpenGraph Metadata -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="محمد عبد السميع - Senior Media Buyer & SEO" />
  <meta property="og:title" content="${seoTitle}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="https://mohamed-abdelsamee-portfolio.vercel.app/case_roas21.webp" />
  <meta property="og:locale" content="ar_AR" />

  <!-- Twitter Card Metadata -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${seoTitle}" />
  <meta name="twitter:description" content="${metaDesc}" />
  <meta name="twitter:image" content="https://mohamed-abdelsamee-portfolio.vercel.app/case_roas21.webp" />

  <!-- Schema.org JSON-LD Article -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title.replace(/"/g, '\\"')}",
    "description": "${metaDesc.replace(/"/g, '\\"')}",
    "image": "https://mohamed-abdelsamee-portfolio.vercel.app/case_roas21.webp",
    "datePublished": "${publishDate}T08:00:00.000Z",
    "dateModified": "${publishDate}T12:00:00.000Z",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${canonicalUrl}"
    },
    "author": {
      "@type": "Person",
      "name": "محمد عبد السميع",
      "jobTitle": "Senior Performance Media Buyer & Ads Specialist",
      "url": "https://mohamed-abdelsamee-portfolio.vercel.app",
      "sameAs": [
        "https://www.linkedin.com/in/mohamed-abdelsameea",
        "https://mostaql.com/u/Mohamed_A_Samee"
      ]
    },
    "publisher": {
      "@type": "Organization",
      "name": "محمد عبد السميع - خبير إعلانات الأداء والنمو",
      "url": "https://mohamed-abdelsamee-portfolio.vercel.app"
    }
  }
  </script>

  <link rel="stylesheet" crossorigin href="/assets/index-D3WYuent.css">
  <style>
    @font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 400 900;
      font-display: optional;
      src: url(/fonts/SLXVc1nY6HkvangtZmpQdkhzfH5lkSscQyyS4J0.woff2) format('woff2');
    }
    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background-color: #050505;
      color: #F8FAFC;
      margin: 0;
      padding: 0;
      padding-top: max(24px, calc(env(safe-area-inset-top) + 12px));
    }
    .article-content {
      line-height: 1.95;
      font-size: 16px;
      color: #CBD5E1;
    }
    .article-content h2 {
      color: #FFFFFF;
      font-size: 1.55rem;
      font-weight: 800;
      margin-top: 42px;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      line-height: 1.4;
    }
    .article-content h3 {
      color: #FFC400;
      font-size: 1.25rem;
      font-weight: 700;
      margin-top: 32px;
      margin-bottom: 14px;
      line-height: 1.4;
    }
    .article-content p {
      margin-bottom: 22px;
    }
    .article-content ul, .article-content ol {
      margin-bottom: 24px;
      padding-right: 24px;
    }
    .article-content li {
      margin-bottom: 10px;
    }
    .article-content strong {
      color: #FFFFFF;
      font-weight: 700;
    }
    .proof-box {
      background: rgba(255, 196, 0, 0.06);
      border: 1px solid rgba(255, 196, 0, 0.3);
      border-radius: 14px;
      padding: 18px 22px;
      margin: 28px 0;
      color: #F8FAFC;
      font-size: 14.5px;
      line-height: 1.8;
    }
    .proof-box a {
      color: #FFC400;
      font-weight: 800;
      text-decoration: underline;
    }
  </style>
</head>
<body class="selection:bg-[#FFC400] selection:text-black min-h-screen">
  <div style="max-width: 900px; margin: 0 auto; padding: 12px 20px 80px 20px;">
    
    <!-- Top Navigation -->
    <nav style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 16px;">
      <a href="/blog" style="display: inline-flex; align-items: center; gap: 8px; color: #94A3B8; text-decoration: none; font-size: 14px; font-weight: 700; transition: color 0.2s;" onmouseover="this.style.color='#FFC400'" onmouseout="this.style.color='#94A3B8'">
        <span style="font-size: 18px;">←</span>
        <span>العودة لجميع المقالات</span>
      </a>
      <div style="display: flex; align-items: center; gap: 10px;">
        <a href="/" style="color: #94A3B8; text-decoration: none; font-size: 13px; font-weight: 700;">الرئيسية</a>
        <span style="color: #475569;">•</span>
        <a href="/#case-studies" style="color: #FFC400; text-decoration: none; font-size: 13px; font-weight: 700;">نتائج الحملات (21x ROAS)</a>
      </div>
    </nav>

    <!-- Breadcrumb -->
    <div style="font-size: 12px; color: #64748B; margin-bottom: 20px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
      <a href="/" style="color: #94A3B8; text-decoration: none;">الرئيسية</a>
      <span>/</span>
      <a href="/blog" style="color: #94A3B8; text-decoration: none;">المدونة</a>
      <span>/</span>
      <span style="color: #CBD5E1; font-weight: 600;">${title}</span>
    </div>

    <!-- Article Header -->
    <header style="margin-bottom: 32px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">
        <span style="font-size: 11px; padding: 4px 12px; border-radius: 20px; background: rgba(255, 196, 0, 0.1); color: #FFC400; font-weight: 800; border: 1px solid rgba(255, 196, 0, 0.25);">
          ${category}
        </span>
        <span style="font-size: 12px; color: #94A3B8;">⏱️ ${readTime}</span>
        <span style="font-size: 12px; color: #64748B;">${country}</span>
      </div>

      <h1 id="article-title" style="font-size: clamp(1.8rem, 4.5vw, 2.6rem); font-weight: 900; color: #FFFFFF; line-height: 1.35; margin: 0 0 16px 0;">
        ${title}
      </h1>

      <div style="display: flex; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: #94A3B8;">
        <span style="font-weight: 700; color: #FFFFFF;">بقلم: م. محمد عبد السميع</span>
        <span>•</span>
        <span>Senior Performance Media Buyer & SEO Architect</span>
      </div>
    </header>

    <!-- Pre-Rendered Full Article Content (100% Crawlable) -->
    <main id="article-body" class="article-content">
      ${renderedHtml}
    </main>

    <!-- Bottom Proof Box & CTA -->
    <section style="margin-top: 60px; padding-top: 36px; border-top: 1px solid rgba(255,255,255,0.08);">
      <div style="background: linear-gradient(135deg, rgba(15,23,42,0.8), rgba(2,6,23,0.9)); border: 1px solid rgba(255,196,0,0.3); border-radius: 20px; padding: 32px 24px; text-align: center;">
        <h2 style="color: #FFFFFF; font-size: 1.4rem; font-weight: 900; margin: 0 0 10px 0;">
          هل ترغب في تطبيق هذه الاستراتيجية على حملاتك ومتجرك؟
        </h2>
        <p style="color: #94A3B8; font-size: 14px; line-height: 1.8; max-width: 650px; margin: 0 auto 24px auto;">
          دعنا نراجع حساباتك الإعلانية، ونكتشف نقاط الهدر، ونبني قمع تحويل مربح مع تتبع سحابي دقيق ومضاعفة الـ ROAS.
        </p>
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; max-width: 440px; margin: 0 auto;">
          <a href="https://wa.me/201035199880" target="_blank" rel="noopener noreferrer" style="width: 100%; box-sizing: border-box; background: #FFC400; color: #000000; font-weight: 800; padding: 15px 28px; border-radius: 14px; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 8px 24px -4px rgba(255, 196, 0, 0.4);">
            <span>💬 حجز استشارة نمو عبر واتساب مباشرة</span>
          </a>
          <a href="/" style="width: 100%; box-sizing: border-box; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.22); color: #FFFFFF; font-weight: 700; padding: 14px 28px; border-radius: 14px; font-size: 14px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; backdrop-filter: blur(8px);">
            <span>🚀 استعراض سابقة الأعمال ونتائج الحملات (البورتفوليو)</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer style="margin-top: 60px; text-align: center; color: #64748B; font-size: 13px; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 28px;">
      <p style="margin: 0 0 8px 0; font-weight: 700; color: #94A3B8;">بورتفوليو م. محمد عبد السميع © 2026</p>
      <p style="margin: 0; font-size: 11px;">Senior Performance Media Buyer & Ads Specialist</p>
    </footer>

  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  return res.status(200).send(html);
}
