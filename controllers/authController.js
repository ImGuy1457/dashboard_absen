const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');

class AuthController {
  async showLogin(req, res) {
    if (req.session.user) {
      return req.session.user.role === 'user' 
        ? res.redirect('/dashboard') 
        : res.redirect('/admin/dashboard');
    }
    
    try {
      const loginUsers = await userRepository.getAllUsers();
      res.render('loginNew', {
        title: 'Login',
        loginUsers,
        error: req.flash('error'),
        success: req.flash('success')
      });
    } catch (err) {
      console.error(err);
      res.render('loginNew', {
        title: 'Login',
        loginUsers: [],
        error: ['Gagal mengambil data user dari database'],
        success: req.flash('success')
      });
    }
  }

  async postLogin(req, res) {
    const { username, password, remember_me } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    try {
      const user = await authService.authenticate(username, password, ipAddress);
      
      // Simpan data di session
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        role_id: user.role_id,
        jabatan: user.jabatan
      };

      // Implementasi Remember Me
      if (remember_me) {
        // Durasi 30 hari
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        // Berakhir ketika browser ditutup
        req.session.cookie.expires = false;
      }

      // Redirect berdasarkan role
      if (user.role === 'user') {
        res.redirect('/dashboard');
      } else {
        res.redirect('/admin/dashboard');
      }
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/login');
    }
  }

  async logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  }
}

module.exports = new AuthController();
