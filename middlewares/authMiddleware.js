function isLogin(req, res, next) {
  if (req.session && req.session.user) {
    // Inject session user ke locals untuk EJS template
    res.locals.sessionUser = req.session.user;
    res.locals.currentPath = req.path;
    return next();
  }
  
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, message: 'Sesi login telah berakhir' });
  }
  
  res.redirect('/login');
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'superadmin')) {
    return next();
  }
  res.redirect('/dashboard');
}

function isSuperAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'superadmin') {
    return next();
  }
  
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(403).json({ ok: false, message: 'Hanya Superadmin yang memiliki akses ke fitur ini' });
  }
  
  req.flash('error', 'Akses ditolak. Fitur ini hanya untuk Superadmin.');
  res.redirect('/admin/dashboard');
}

function isEmployee(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'user') {
    return next();
  }
  res.redirect('/admin/dashboard');
}

module.exports = {
  isLogin,
  isAdmin,
  isSuperAdmin,
  isEmployee
};
