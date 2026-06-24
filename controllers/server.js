const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const cronService = require('./services/cronService');

// Import Middlewares Keamanan
const {
  helmetMiddleware,
  cookieParser,
  xssSanitizer,
  csrfErrorHandler,
  injectCsrfToken
} = require('./middlewares/securityMiddleware');

// Import Routes Modular
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();

// Security Middleware (Helmet & XSS)
app.use(helmetMiddleware);

// Static assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/integrasi', express.static(path.join(__dirname, 'intregrasi')));
app.use('/intregrasi', express.static(path.join(__dirname, 'intregrasi')));

// Parser body (Limit 10mb untuk base64 foto check-in)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(xssSanitizer);

// Setup Session Store (MySQL Database Store)
const sessionStore = new MySQLStore({}, db.pool);

app.use(session({
  key: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'absensi-karyawan-super-secret-key-1234',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Rolling session aktif
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  }
}));

app.use(flash());
app.use(cookieParser);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Inject User Session & path ke res.locals
app.use((req, res, next) => {
  res.locals.sessionUser = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

// ── REGISTRASI ROUTES ──

// A. API Routes (Tanpa Proteksi CSRF Double-Submit agar kompatibel dengan client integrasi)
app.use(apiRoutes);

// B. Web App Routes (Dengan Proteksi CSRF Token & inject token)
app.use(injectCsrfToken);
app.use(authRoutes);
app.use(userRoutes);
app.use(adminRoutes);

// Redirect Root
app.get('/', (req, res) => {
  if (req.session.user) {
    return req.session.user.role === 'user' 
      ? res.redirect('/dashboard') 
      : res.redirect('/admin/dashboard');
  }
  res.redirect('/login');
});

// Fallback 404 Route
app.use((req, res) => {
  res.status(404);
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.json({ ok: false, message: 'Endpoint tidak ditemukan' });
  }
  res.render('loginNew', {
    title: '404 - Not Found',
    loginUsers: [],
    error: ['Halaman yang Anda cari tidak ditemukan.'],
    success: []
  });
});

// CSRF & General Error Handler Middleware
app.use(csrfErrorHandler);
app.use((err, req, res, next) => {
  console.error('[System Error]', err);
  res.status(500);
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.json({ ok: false, message: 'Terjadi kesalahan sistem internal' });
  }
  req.flash('error', 'Terjadi kesalahan server internal.');
  res.redirect('/login');
});

const PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_RETRIES = 10;

function startServer(port, retryCount = 0) {
  const server = app.listen(port, () => {
    console.log(`Server absensi berjalan di http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retryCount < MAX_PORT_RETRIES) {
      const nextPort = port + 1;
      console.warn(`Port ${port} sedang digunakan. Mencoba port ${nextPort}...`);
      startServer(nextPort, retryCount + 1);
      return;
    }

    console.error('Fatal: Gagal menjalankan server.', err);
    process.exit(1);
  });
}

// Jalankan Migrasi, Scheduler Cron, lalu Start Server
db.runMigrations()
  .then(() => {
    // Inisialisasi scheduler otomatis ALPHA
    cronService.init();

    startServer(PORT);
  })
  .catch(err => {
    console.error('Fatal: Gagal menjalankan migrasi database. Server berhenti.', err);
    process.exit(1);
  });
