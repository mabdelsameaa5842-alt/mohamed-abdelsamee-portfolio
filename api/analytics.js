import pg from 'pg';

const { Pool } = pg;

let pool;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

// Calculate start and end Date objects based on query filters
function calculateDateBounds(query) {
  const now = new Date();
  const { period, startDate, endDate, year, month } = query;

  // Cairo / Egypt offset is UTC+3 (Egypt Daylight Time / Summer Time)
  const tzOffsetHours = 3;
  const getEgyptNow = () => new Date(Date.now() + tzOffsetHours * 3600 * 1000);

  let fromDate = null;
  let toDate = null;
  let label = 'كل الأوقات';
  let prevFromDate = null;
  let prevToDate = null;

  // Custom Range
  if (startDate && endDate) {
    fromDate = new Date(`${startDate}T00:00:00+03:00`);
    toDate = new Date(`${endDate}T23:59:59.999+03:00`);
    label = `من ${startDate} إلى ${endDate}`;
  } 
  // Specific Year & Month
  else if (year && month) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10) - 1; // 0-indexed
    fromDate = new Date(Date.UTC(y, m, 1, 0 - tzOffsetHours, 0, 0));
    const lastDay = new Date(Date.UTC(y, m + 1, 0, 23 - tzOffsetHours, 59, 59, 999));
    toDate = lastDay;
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    label = `${monthNames[m] || month} ${y}`;
  }
  // Specific Year only
  else if (year && !month) {
    const y = parseInt(year, 10);
    fromDate = new Date(Date.UTC(y, 0, 1, 0 - tzOffsetHours, 0, 0));
    toDate = new Date(Date.UTC(y, 11, 31, 23 - tzOffsetHours, 59, 59, 999));
    label = `سنة ${y}`;
  }
  // Preset Periods
  else {
    const egyptNow = getEgyptNow();
    const y = egyptNow.getUTCFullYear();
    const m = egyptNow.getUTCMonth();
    const d = egyptNow.getUTCDate();

    switch (period) {
      case 'today': {
        fromDate = new Date(Date.UTC(y, m, d, 0 - tzOffsetHours, 0, 0));
        toDate = new Date();
        label = 'اليوم (آخر 24 ساعة)';
        // Previous = Yesterday
        prevFromDate = new Date(Date.UTC(y, m, d - 1, 0 - tzOffsetHours, 0, 0));
        prevToDate = new Date(Date.UTC(y, m, d - 1, 23 - tzOffsetHours, 59, 59, 999));
        break;
      }
      case 'yesterday': {
        fromDate = new Date(Date.UTC(y, m, d - 1, 0 - tzOffsetHours, 0, 0));
        toDate = new Date(Date.UTC(y, m, d - 1, 23 - tzOffsetHours, 59, 59, 999));
        label = 'أمس بالكامل';
        break;
      }
      case '7d': {
        fromDate = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        toDate = new Date();
        label = 'آخر 7 أيام';
        prevFromDate = new Date(Date.now() - 14 * 24 * 3600 * 1000);
        prevToDate = fromDate;
        break;
      }
      case '30d': {
        fromDate = new Date(Date.now() - 30 * 24 * 3600 * 1000);
        toDate = new Date();
        label = 'آخر 30 يوماً';
        prevFromDate = new Date(Date.now() - 60 * 24 * 3600 * 1000);
        prevToDate = fromDate;
        break;
      }
      case 'this_month': {
        fromDate = new Date(Date.UTC(y, m, 1, 0 - tzOffsetHours, 0, 0));
        toDate = new Date();
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        label = `هذا الشهر (${monthNames[m]} ${y})`;
        prevFromDate = new Date(Date.UTC(y, m - 1, 1, 0 - tzOffsetHours, 0, 0));
        prevToDate = new Date(Date.UTC(y, m, 0, 23 - tzOffsetHours, 59, 59, 999));
        break;
      }
      case 'last_month': {
        fromDate = new Date(Date.UTC(y, m - 1, 1, 0 - tzOffsetHours, 0, 0));
        toDate = new Date(Date.UTC(y, m, 0, 23 - tzOffsetHours, 59, 59, 999));
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        label = `الشهر الماضي (${monthNames[(m - 1 + 12) % 12]})`;
        break;
      }
      case 'this_year': {
        fromDate = new Date(Date.UTC(y, 0, 1, 0 - tzOffsetHours, 0, 0));
        toDate = new Date();
        label = `هذا العام (${y})`;
        break;
      }
      case 'all':
      default: {
        fromDate = null;
        toDate = null;
        label = 'كل الأوقات (تراكمي)';
        break;
      }
    }
  }

  return { fromDate, toDate, label, prevFromDate, prevToDate };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const client = await getPool().connect();

  try {
    // 1. POST: Record tracking event
    if (req.method === 'POST') {
      const { id, sessionId, visitorId, type, data, path, source, device } = req.body;

      // Filter out admin routes from ever being recorded
      if (path && (path.startsWith('/studio-ops-701') || path.startsWith('/admin'))) {
        return res.status(200).json({ success: true, ignored: true });
      }

      const eventId = id || ('ev_' + Math.random().toString(36).substring(2, 9));
      const payload = data || {};
      if (visitorId) payload.vid = visitorId;

      await client.query(
        `INSERT INTO public.vorder_analytics_events (
          id, session_id, type, data, path, source, device, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());`,
        [
          eventId, 
          sessionId || 'unknown', 
          type || 'pageview', 
          JSON.stringify(payload), 
          path || '/', 
          source || 'زيارة مباشرة (Direct)', 
          device || 'كمبيوتر (Desktop)'
        ]
      );

      return res.status(200).json({ success: true, id: eventId });
    }

    // 2. GET: Return aggregated analytics with Smart Date Filter
    if (req.method === 'GET') {
      const dateBounds = calculateDateBounds(req.query);
      const { fromDate, toDate, label, prevFromDate, prevToDate } = dateBounds;

      // Construct SQL WHERE conditions
      const conditions = [
        "path NOT LIKE '/studio-ops%'",
        "path NOT LIKE '/admin%'"
      ];
      const params = [];

      if (fromDate) {
        params.push(fromDate.toISOString());
        conditions.push(`timestamp >= $${params.length}`);
      }
      if (toDate) {
        params.push(toDate.toISOString());
        conditions.push(`timestamp <= $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Main metrics query
      const countsResult = await client.query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE type = 'pageview') as total_pageviews,
          COUNT(DISTINCT COALESCE(data->>'vid', session_id)) as unique_visitors,
          COUNT(*) FILTER (WHERE type = 'whatsapp_click') as total_whatsapp_clicks,
          COUNT(*) FILTER (WHERE type = 'roas_calc') as total_roas_runs,
          COUNT(*) FILTER (WHERE type = 'cv_download') as total_cv_downloads
        FROM public.vorder_analytics_events
        ${whereClause};
      `, params);

      const stats = countsResult.rows[0];
      const uniqueVis = parseInt(stats.unique_visitors || 0, 10);
      const waClicks = parseInt(stats.total_whatsapp_clicks || 0, 10);
      const conversionRate = uniqueVis > 0 
        ? ((waClicks / uniqueVis) * 100).toFixed(1) 
        : '0.0';

      // Previous period query for growth comparison (if applicable)
      let comparison = null;
      if (prevFromDate && prevToDate) {
        const prevParams = [prevFromDate.toISOString(), prevToDate.toISOString()];
        const prevResult = await client.query(`
          SELECT 
            COUNT(*) FILTER (WHERE type = 'pageview') as prev_pageviews,
            COUNT(*) FILTER (WHERE type = 'whatsapp_click') as prev_whatsapp_clicks
          FROM public.vorder_analytics_events
          WHERE path NOT LIKE '/studio-ops%' AND path NOT LIKE '/admin%'
            AND timestamp >= $1 AND timestamp <= $2;
        `, prevParams);
        const prevStats = prevResult.rows[0];
        const prevPv = parseInt(prevStats.prev_pageviews || 0, 10);
        const prevWa = parseInt(prevStats.prev_whatsapp_clicks || 0, 10);
        const pvDiff = prevPv > 0 ? (((parseInt(stats.total_pageviews || 0, 10) - prevPv) / prevPv) * 100).toFixed(0) : null;
        comparison = {
          prevPageviews: prevPv,
          prevWhatsappClicks: prevWa,
          pageviewsGrowth: pvDiff ? (pvDiff >= 0 ? `+${pvDiff}%` : `${pvDiff}%`) : null,
        };
      }

      // WhatsApp by Location in selected period
      const waLocResult = await client.query(`
        SELECT 
          COALESCE(data->>'location', 'عام') as loc, 
          COUNT(*) as count
        FROM public.vorder_analytics_events
        ${whereClause ? whereClause + " AND type = 'whatsapp_click'" : "WHERE type = 'whatsapp_click'"}
        GROUP BY 1
        ORDER BY count DESC;
      `, params);
      const whatsappByLocation = {};
      waLocResult.rows.forEach(r => {
        whatsappByLocation[r.loc] = parseInt(r.count, 10);
      });

      // Traffic Sources in selected period
      const srcResult = await client.query(`
        SELECT 
          COALESCE(source, 'زيارة مباشرة (Direct)') as src, 
          COUNT(*) as count
        FROM public.vorder_analytics_events
        ${whereClause}
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 10;
      `, params);
      const trafficSources = {};
      srcResult.rows.forEach(r => {
        trafficSources[r.src] = parseInt(r.count, 10);
      });

      // Recent events in selected period (up to 30)
      const feedResult = await client.query(`
        SELECT id, session_id as "sessionId", COALESCE(data->>'vid', session_id) as "visitorId", type, data, path, source, device, timestamp
        FROM public.vorder_analytics_events
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT 30;
      `, params);

      return res.status(200).json({
        totalEvents: parseInt(stats.total_events || 0, 10),
        totalPageviews: parseInt(stats.total_pageviews || 0, 10),
        uniqueVisitors: uniqueVis,
        totalWhatsappClicks: waClicks,
        totalRoasRuns: parseInt(stats.total_roas_runs || 0, 10),
        totalCvDownloads: parseInt(stats.total_cv_downloads || 0, 10),
        conversionRate,
        whatsappByLocation,
        trafficSources,
        recentFeed: feedResult.rows,
        comparison,
        filterInfo: {
          period: req.query.period || (req.query.startDate ? 'custom' : (req.query.year ? 'yearly' : 'all')),
          label,
          fromDate: fromDate ? fromDate.toISOString() : null,
          toDate: toDate ? toDate.toISOString() : null,
        }
      });
    }

    // 3. DELETE: Reset analytics
    if (req.method === 'DELETE') {
      await client.query(`TRUNCATE TABLE public.vorder_analytics_events;`);
      return res.status(200).json({ success: true, message: 'Analytics reset successfully' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    console.error('[API /api/analytics Error]:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}
