const helmet = require('helmet');
const xss = require('xss');
const { doubleCsrf } = require('csrf-csrf');
require('dotenv').config();

// 1. Inisialisasi CSRF-CSRF (Double Submit Cookie)
const {
  invalidCsrfTokenError,
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'rahasia-csrf-token-super-secure-key-999',
  getSessionIdentifier: (req) => req.sessionID || req.ip || 'anonymous',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => {
    // Cari token di headers, query parameter, atau body
    return req.headers['x-csrf-token'] || 
           (req.body && req.body._csrf) || 
           (req.query && req.query._csrf);
  }
});

// csrf-csrf membaca cookie dari req.cookies, sementara project ini tidak memakai cookie-parser.
function cookieParser(req, res, next) {
  req.cookies = {};

  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return next();
  }

  cookieHeader.split(';').forEach((cookie) => {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (!name) {
      return;
    }

    try {
      req.cookies[name] = decodeURIComponent(value);
    } catch (err) {
      req.cookies[name] = value;
    }
  });

  next();
}

// 2. Custom XSS Sanitizer Middleware
function xssSanitizer(req, res, next) {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Skip payload foto Base64 agar encoding-nya tidak terganggu/rusak
        if (['photo_data', 'foto', 'photo'].includes(key)) {
          continue;
        }
        req.body[key] = xss(req.body[key]);
      }
    }
  }
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    }
  }
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = xss(req.params[key]);
      }
    }
  }
  next();
}

// 3. CSRF Error Handler
function csrfErrorHandler(error, req, res, next) {
  if (error === invalidCsrfTokenError) {
    res.status(403);
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.json({ ok: false, message: 'Token CSRF tidak valid atau kedaluwarsa' });
    }
    req.flash('error', 'Token keamanan CSRF tidak valid. Silakan muat ulang halaman.');
    return res.redirect('back');
  }
  next(error);
}

// Helper untuk inject CSRF token ke views EJS
function injectCsrfToken(req, res, next) {
  res.locals.csrfToken = generateCsrfToken(req, res);
  next();
}

// 4. Konfigurasi Helmet Security Headers
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.tailwindcss.com"], // Izinkan Chart.js CDN dan Tailwind/Alpine inline
      scriptSrcAttr: ["'unsafe-inline'"], // Project ini masih memakai handler onclick inline di banyak tombol.
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"], // Izinkan gambar inline (base64) & folder upload lokal
      connectSrc: ["'self'"]
    }
  }
});

module.exports = {
  helmetMiddleware,
  cookieParser,
  xssSanitizer,
  doubleCsrfProtection,
  csrfErrorHandler,
  injectCsrfToken
};
