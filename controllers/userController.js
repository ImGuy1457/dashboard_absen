const attendanceRepository = require('../repositories/attendanceRepository');
const userRepository = require('../repositories/userRepository');
const attendanceService = require('../services/attendanceService');
const uploadService = require('../services/uploadService');
const { formatTime, calcWorkHours, getStatusIcon } = require('../utils/helpers');

class UserController {
  async showDashboard(req, res) {
    const user = req.session.user;
    if (user.role !== 'user') return res.redirect('/admin/dashboard');
    
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);
    
    try {
      const absenHariIni = await attendanceRepository.getTodayAttendance(user.id, today);
      const stats = await attendanceRepository.getMonthlyUserStats(user.id, thisMonth);
      
      if (absenHariIni) {
        absenHariIni.checkin_fmt = formatTime(absenHariIni.checkin_time);
        absenHariIni.checkout_fmt = formatTime(absenHariIni.checkout_time);
        absenHariIni.work_hours = calcWorkHours(absenHariIni.checkin_time, absenHariIni.checkout_time);
        absenHariIni.status_icon = getStatusIcon(absenHariIni.status);
      }

      res.render('dashboard', {
        title: 'Dashboard',
        user,
        absenHariIni,
        stats,
        today,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Terjadi kesalahan server saat memuat dashboard');
      res.redirect('/login');
    }
  }

  async getAttendanceStatsApi(req, res) {
    const user = req.session.user;
    const today = new Date();
    
    // Cari mingguan (7 hari ke belakang)
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 6);
    const startDate = weekAgo.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);
    
    // Cari bulanan
    const thisMonth = today.toISOString().slice(0, 7);

    try {
      // Data mingguan user
      const [weeklyRaw] = await attendanceRepository.getAttendanceWithFilters(
        'a.user_id = ? AND a.date BETWEEN ? AND ?',
        [user.id, startDate, endDate]
      );
      
      const weekly = { hadir: 0, terlambat: 0, alpha: 0, izin: 0, sakit: 0, dinas: 0 };
      const weeklyRows = Array.isArray(weeklyRaw) ? weeklyRaw : [weeklyRaw].filter(Boolean);
      weeklyRows.forEach(r => {
        const s = r.status.toLowerCase();
        if (s === 'hadir') weekly.hadir++;
        else if (s === 'terlambat') weekly.terlambat++;
        else if (s === 'alpha') weekly.alpha++;
        else if (s === 'izin') weekly.izin++;
        else if (s === 'sakit') weekly.sakit++;
        else if (s === 'perjalanan dinas') weekly.dinas++;
      });

      // Data bulanan user
      const monthlyStats = await attendanceRepository.getMonthlyUserStats(user.id, thisMonth);
      
      res.json({
        ok: true,
        weekly,
        monthly: {
          hadir: monthlyStats.hadir || 0,
          terlambat: monthlyStats.terlambat || 0,
          alpha: monthlyStats.alpha || 0,
          izin: monthlyStats.izin || 0,
          sakit: monthlyStats.sakit || 0,
          dinas: monthlyStats.dinas || 0
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, message: 'Gagal memuat data statistik absensi' });
    }
  }

  async showCheckin(req, res) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await attendanceRepository.getTodayAttendance(req.session.user.id, today);

      if (existing && existing.checkin_time && !existing.checkout_time) {
        return res.redirect('/attendance/checkout');
      }

      await this.showAttendanceForm(req, res, 'checkin');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat form absensi');
      res.redirect('/dashboard');
    }
  }

  async showCheckout(req, res) {
    await this.showAttendanceForm(req, res, 'checkout');
  }

  async showAttendanceForm(req, res, mode) {
    const user = req.session.user;

    try {
      const options = await attendanceRepository.getAttendanceOptions();

      res.render('chekin', {
        title: mode === 'checkout' ? 'Check-Out' : 'Check-In',
        user,
        mode,
        options,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat form absensi');
      res.redirect('/dashboard');
    }
  }

  async postCheckin(req, res) {
    const user = req.session.user;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const { option_id, notes, photo_data, location } = req.body;

    try {
      const option = option_id
        ? (await attendanceRepository.getAttendanceOptions()).find(opt => String(opt.id) === String(option_id))
        : null;
      const purpose = option ? option.name : 'Hadir';
      const { schedule } = await attendanceService.evaluateAttendanceWindow(user, now);
      const { status, alert } = await attendanceService.calculateCheckinStatus(purpose, now, schedule);
      const existing = await attendanceRepository.getTodayAttendance(user.id, today);
      const photoPath = photo_data ? await uploadService.saveAttendancePhoto(user.id, photo_data, 'checkin', user.username) : null;

      const payload = {
        status,
        checkin_time: now,
        date: today,
        notes: notes || '',
        checkin_location: location || null,
        attendance_purpose: purpose,
        source: 'web',
        alert_note: alert || null
      };

      if (photoPath) payload.checkin_photo = photoPath;

      if (existing) {
        await attendanceRepository.updateAttendance(existing.id, payload);
      } else {
        await attendanceRepository.insertAttendance({ user_id: user.id, ...payload });
      }

      req.flash('success', `Check-in berhasil disimpan${alert ? `: ${alert}` : ''}`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      req.flash('error', err.message || 'Gagal menyimpan check-in');
      res.redirect('/attendance/checkin');
    }
  }

  async postCheckout(req, res) {
    const user = req.session.user;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const { notes, photo_data, location } = req.body;

    try {
      const { schedule } = await attendanceService.evaluateAttendanceWindow(user, now);
      const alert = await attendanceService.calculateCheckoutAlert(now, schedule);
      const existing = await attendanceRepository.getTodayAttendance(user.id, today);
      const photoPath = photo_data ? await uploadService.saveAttendancePhoto(user.id, photo_data, 'checkout', user.username) : null;

      const payload = {
        checkout_time: now,
        date: today,
        notes: notes || (existing && existing.notes) || '',
        checkout_location: location || null,
        attendance_purpose: 'Pulang Kantor',
        source: 'web',
        alert_note: alert || (existing && existing.alert_note) || null
      };

      if (photoPath) payload.checkout_photo = photoPath;

      if (existing) {
        await attendanceRepository.updateAttendance(existing.id, payload);
      } else {
        await attendanceRepository.insertAttendance({
          user_id: user.id,
          status: 'Hadir',
          ...payload
        });
      }

      req.flash('success', `Check-out berhasil disimpan${alert ? `: ${alert}` : ''}`);
      res.redirect('/dashboard');
    } catch (err) {
      console.error(err);
      req.flash('error', err.message || 'Gagal menyimpan check-out');
      res.redirect('/attendance/checkout');
    }
  }

  async showHistory(req, res) {
    const user = req.session.user;
    const isAdminUser = (user.role === 'admin' || user.role === 'superadmin');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = 20;
    
    const filters = {
  search: req.query.search || '',
  status: req.query.status || '',
  dateFrom: req.query.dateFrom || '',
  dateTo: req.query.dateTo || '',
  userId: req.query.userId || '',
  keperluan: req.query.keperluan || '',
  lokasi: req.query.lokasi || '',
  jabatan: req.query.jabatan || ''
};

    try {
      const where = [];
      const params = [];

      if (!isAdminUser) {
        where.push('a.user_id = ?');
        params.push(user.id);
      } else {
        where.push('u.role = "user"');
        if (filters.userId) {
          where.push('a.user_id = ?');
          params.push(filters.userId);
        }
      }

      // Filter search: untuk admin = filter status kehadiran (attendance_purpose), user biasa = nama/jabatan
      if (!isAdminUser && filters.search) {
  where.push('(u.username LIKE ? OR r.name LIKE ?)');
  params.push(`%${filters.search}%`, `%${filters.search}%`);
}

if (filters.status) {
  where.push('a.status = ?');
  params.push(filters.status);
}
      
      // Filter tanggal
      if (filters.dateFrom) {
        where.push('a.date >= ?');
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.push('a.date <= ?');
        params.push(filters.dateTo);
      }

      // Filter Keperluan
      if (filters.keperluan) {
        where.push('a.attendance_purpose = ?');
        params.push(filters.keperluan);
      }

      // Filter Lokasi
      if (filters.lokasi) {
        where.push('a.attendance_place = ?');
        params.push(filters.lokasi);
      }

      // Filter Jabatan/Role
      if (filters.jabatan) {
        where.push('u.role_id = ?');
        params.push(filters.jabatan);
      }

      const whereStr = where.length ? where.join(' AND ') : '';
      
      const total = await attendanceRepository.countAttendanceWithFilters(whereStr, params);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const offset = (page - 1) * pageSize;

      const rawRows = await attendanceRepository.getAttendanceWithFilters(whereStr, params, pageSize, offset);
      
      const rows = rawRows.map(r => ({
        ...r,
        user_name: r.user_name || '',
        checkin_photo: r.checkin_photo || null,
        checkout_photo: r.checkout_photo || null,
        checkin_location: r.checkin_location || null,
        checkout_location: r.checkout_location || null,
        attendance_place: r.attendance_place || '',
        attendance_purpose: r.attendance_purpose || '',
        status_color: r.status_color || '#64748b',
        status_name: r.status,
        status_icon: getStatusIcon(r.status),
        check_in: formatTime(r.checkin_time),
        check_out: formatTime(r.checkout_time),
        work_hours: calcWorkHours(r.checkin_time, r.checkout_time),
        is_late: r.status === 'Terlambat'
      }));

      let userList = [];
      let rolesList = [];
      let attendanceOptions = [];
      if (isAdminUser) {
        const usersRaw = await userRepository.getAllUsers();
        userList = usersRaw.filter(u => u.role === 'user').map(u => ({ id: u.id, name: u.username }));
        rolesList = await userRepository.getAllRoles();
        attendanceOptions = await attendanceRepository.getAttendanceOptions();
      }

      res.render('index02', {
        title: 'Histori Absensi',
        user,
        isAdmin: isAdminUser,
        result: { rows, total, page, totalPages },
        filters,
        userList,
        rolesList,
        attendanceOptions,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat riwayat histori absensi');
      res.redirect('/dashboard');
    }
  }

  async exportCsv(req, res) {
    const user = req.session.user;
    const isAdminUser = (user.role === 'admin' || user.role === 'superadmin');
    
    const filters = {
  search: req.query.search || '',
  status: req.query.status || '',
  dateFrom: req.query.dateFrom || '',
  dateTo: req.query.dateTo || '',
  userId: req.query.userId || '',
  keperluan: req.query.keperluan || '',
  lokasi: req.query.lokasi || '',
  jabatan: req.query.jabatan || ''
};

    try {
      const where = [];
      const params = [];

      if (!isAdminUser) {
        where.push('a.user_id = ?');
        params.push(user.id);
      } else {
        where.push('u.role = "user"');
        if (filters.userId) {
          where.push('a.user_id = ?');
          params.push(filters.userId);
        }
      }

      if (filters.search) {
  where.push('(u.username LIKE ? OR r.name LIKE ?)');
  params.push(`%${filters.search}%`, `%${filters.search}%`);
}

if (filters.status) {
  where.push('a.status = ?');
  params.push(filters.status);
}

      if (filters.dateFrom) {
        where.push('a.date >= ?');
        params.push(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.push('a.date <= ?');
        params.push(filters.dateTo);
      }
      if (filters.keperluan) {
        where.push('a.attendance_purpose = ?');
        params.push(filters.keperluan);
      }
      if (filters.lokasi) {
        where.push('a.attendance_place = ?');
        params.push(filters.lokasi);
      }
      if (filters.jabatan) {
        where.push('u.role_id = ?');
        params.push(filters.jabatan);
      }

      const whereStr = where.length ? where.join(' AND ') : '';
      const rows = await attendanceRepository.getAttendanceWithFilters(whereStr, params);

      let csv = 'Tanggal,Nama,Jabatan,Status,Tempat,Keperluan,Check-In,Check-Out,Catatan\n';
      rows.forEach(r => {
        csv += [
          r.date ? new Date(r.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
          `"${r.user_name}"`,
          `"${r.jabatan || ''}"`,
          r.status,
          `"${r.attendance_place || ''}"`,
          `"${r.attendance_purpose || ''}"`,
          r.checkin_time ? formatTime(r.checkin_time) : '-',
          r.checkout_time ? formatTime(r.checkout_time) : '-',
          `"${(r.notes || '').replace(/"/g, '""')}"`
        ].join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="absensi.csv"');
      res.send('\uFEFF' + csv);
    } catch (err) {
      console.error(err);
      res.redirect('/history');
    }
  }
}

module.exports = new UserController();
