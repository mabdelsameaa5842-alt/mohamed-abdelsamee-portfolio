import crypto from 'crypto';

const AUTH_SECRET = process.env.ADMIN_JWT_SECRET || 'vorder_auth_sec_key_2026_mohamed_abdelsameea_99880';

// Canonical Super Admin Credentials
const SUPER_ADMIN = {
  id: "usr_mohamed_samee_admin",
  name: "م. محمد عبد السميع",
  email: "mohamed701164@gmail.com",
  role: "super_admin",
  roleTitle: "👑 المدير العام والتنفيذي (Super Admin)",
  avatar: "MA",
  phone: "+201035199880",
  permissions: [
    "PERM_ALL",
    "PERM_PUBLISH_ARTICLES",
    "PERM_MANAGE_INTEGRATIONS",
    "PERM_VIEW_ANALYTICS",
    "PERM_SYSTEM_RESET",
    "PERM_USER_MANAGEMENT"
  ]
};

const VALID_PASSWORD_HASH = crypto.createHash('sha256').update('Mm201915842').digest('hex');

function createToken(user, rememberMe = false) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const durationMs = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const exp = Math.floor((Date.now() + durationMs) / 1000);
  
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleTitle: user.roleTitle,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString()
  };
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (signature !== expectedSignature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return data;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query || {};

  // Action: Verify Token
  if (action === 'verify' || req.method === 'GET') {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || req.query.token;

    const session = verifyToken(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'جلسة الدخول منتهية أو غير صالحة. يرجى تسجيل الدخول مجدداً.'
      });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      user: {
        id: session.sub,
        email: session.email,
        name: session.name,
        role: session.role,
        roleTitle: session.roleTitle,
        permissions: session.permissions,
        avatar: SUPER_ADMIN.avatar
      },
      expiresAt: new Date(session.exp * 1000).toISOString()
    });
  }

  // Action: Login
  if (action === 'login' || req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const rememberMe = Boolean(body.rememberMe);

      // Check email
      const isEmailValid = email === SUPER_ADMIN.email || email === 'mohame701164@gmail.com';
      const inputPassHash = crypto.createHash('sha256').update(password).digest('hex');
      const isPasswordValid = inputPassHash === VALID_PASSWORD_HASH;

      if (!isEmailValid || !isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد الإلكتروني وكلمة المرور.'
        });
      }

      // Generate signed token
      const { token, expiresAt } = createToken(SUPER_ADMIN, rememberMe);

      return res.status(200).json({
        success: true,
        authenticated: true,
        token,
        expiresAt,
        user: SUPER_ADMIN,
        message: 'تم تسجيل الدخول بنجاح وتوثيق الجلسة السحابية.'
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'فشل معالجة طلب تسجيل الدخول.'
      });
    }
  }

  return res.status(404).json({ error: 'Action not supported' });
}
