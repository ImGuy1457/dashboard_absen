const authService = require('../services/authService');
const attendanceRepository = require('../repositories/attendanceRepository');
const userRepository = require('../repositories/userRepository');
const attendanceService = require('../services/attendanceService');
const uploadService = require('../services/uploadService');

class ApiController {
  async listUsers(req, res) {
    try {
      const usersRaw = await userRepository.getAllUsers();
      const users = usersRaw.filter(u => u.role === 'user').map(u => ({
        id: u.id,
        username: u.username,
        jabatan: u.jabatan
      }));
      res.json({ ok: true, users });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Gagal mengambil data user' });
    }
  }

  async getSession(req, res) {
    const user = req.session.user;
    if (!user || user.role === 'admin' || user.role === 'superadmin') {
      return res.status(401).json({ ok: false, message: 'Belum login' });
    }
    res.json({ ok: true, user });
  }

  async postLogin(req, res) {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Username dan password wajib diisi' });
    }

    try {
      const user = await authService.authenticate(username, password, ipAddress);
      
      if (user.role !== 'user') {
        return res.status(401).json({ ok: false, message: 'Akses ditolak. Endpoint khusus karyawan.' });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        role_id: user.role_id,
        jabatan: user.jabatan
      };

      res.json({ ok: true, user: req.session.user });
    } catch (err) {
      res.status(401).json({ ok: false, message: err.message });
    }
  }

  async postLogout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ ok: false, message: 'Gagal logout' });
      }
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  }

  async postAttendance(req, res) {
    const user = req.session.user;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    
    const {
      tempat,
      keterangan,
      keperluan,
      catatan,
      latitude,
      longitude,
      foto
    } = req.body;

    const purpose = keperluan || keterangan || '';
    const location = latitude && longitude ? `${latitude}, ${longitude}` : null;

    if (!purpose || !location || !foto) {
      return res.status(400).json({ ok: false, message: 'Foto, lokasi, dan keperluan wajib diisi' });
    }

    try {
      // 1. Evaluasi window absensi, hari libur, dan ambil jadwal aktif
      const { schedule } = await attendanceService.evaluateAttendanceWindow(user, now);

      const existing = await attendanceRepository.getTodayAttendance(user.id, today);
      const isCheckout = (purpose === 'Pulang Kantor');
      const photoType = isCheckout ? 'checkout' : 'checkin';

      // 2. Simpan foto base64 ke filesystem
      const photoPath = await uploadService.saveAttendancePhoto(user.id, foto, photoType);

      if (isCheckout) {
        const earlyAlert = await attendanceService.calculateCheckoutAlert(now, schedule);
        
        if (existing) {
          await attendanceRepository.updateAttendance(existing.id, {
            checkout_time: now,
            checkout_photo: photoPath,
            checkout_location: location,
            attendance_place: tempat || existing.attendance_place,
            attendance_purpose: purpose,
            notes: catatan || existing.notes,
            alert_note: earlyAlert || existing.alert_note
          });
        } else {
          await attendanceRepository.insertAttendance({
            user_id: user.id,
            status: 'Hadir',
            checkout_time: now,
            date: today,
            notes: catatan || '',
            checkout_photo: photoPath,
            checkout_location: location,
            attendance_place: tempat || null,
            attendance_purpose: purpose,
            source: 'integrasi',
            alert_note: earlyAlert
          });
        }
        const alertMsg = earlyAlert ? ` ⚠️ ${earlyAlert}` : '';
        res.json({ ok: true, message: `Absensi pulang berhasil disimpan${alertMsg}`, alert: earlyAlert });
      } else {
        // Proses Check-in
        const { status: finalStatus, alert: checkinAlert } = await attendanceService.calculateCheckinStatus(purpose, now, schedule);
        
        if (existing) {
          await attendanceRepository.updateAttendance(existing.id, {
            status: finalStatus,
            checkin_time: now,
            checkin_photo: photoPath,
            checkin_location: location,
            attendance_place: tempat || existing.attendance_place,
            attendance_purpose: purpose,
            notes: catatan || existing.notes,
            source: 'integrasi',
            alert_note: checkinAlert || existing.alert_note
          });
        } else {
          await attendanceRepository.insertAttendance({
            user_id: user.id,
            status: finalStatus,
            checkin_time: now,
            date: today,
            notes: catatan || '',
            checkin_photo: photoPath,
            checkin_location: location,
            attendance_place: tempat || null,
            attendance_purpose: purpose,
            source: 'integrasi',
            alert_note: checkinAlert
          });
        }
        const alertMsg = checkinAlert ? ` ⚠️ ${checkinAlert}` : '';
        res.json({ ok: true, message: `Absensi masuk berhasil disimpan${alertMsg}`, alert: checkinAlert });
      }
    } catch (err) {
      console.error(err);
      res.status(400).json({ ok: false, message: err.message || 'Gagal memproses absensi' });
    }
  }

  async listOptions(req, res) {
    try {
      const tempat = await attendanceRepository.getIntegrationOptions('tempat');
      const keperluan = await attendanceRepository.getIntegrationOptions('keperluan');
      res.json({ ok: true, tempat, keperluan });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Gagal mengambil opsi integrasi' });
    }
  }
}

module.exports = new ApiController();
