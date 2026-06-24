const adminService = require('../services/adminService');
const userRepository = require('../repositories/userRepository');
const attendanceRepository = require('../repositories/attendanceRepository');
const scheduleRepository = require('../repositories/scheduleRepository');
const holidayRepository = require('../repositories/holidayRepository');
const auditLogRepository = require('../repositories/auditLogRepository');

class AdminController {
  async showDashboard(req, res) {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = today.slice(0, 7);

    try {
      const usersRaw = await userRepository.getAllUsers();
      const totalUser = usersRaw.filter(u => u.role === 'user').length;

      const statRows = await attendanceRepository.getTodayStatusCounts(today);
      const stat = { hadir: 0, telat: 0, alpha: 0, izin: 0, sakit: 0, dinas: 0 };
      statRows.forEach(r => {
        const s = r.status.toLowerCase();
        if (s === 'hadir') stat.hadir = r.total;
        else if (s === 'terlambat') stat.telat = r.total;
        else if (s === 'alpha') stat.alpha = r.total;
        else if (s === 'izin') stat.izin = r.total;
        else if (s === 'sakit') stat.sakit = r.total;
        else if (s === 'perjalanan dinas') stat.dinas = r.total;
      });

      const attendanceOptions = await attendanceRepository.getAttendanceOptions();
      
      // Weekly dist stats (7 days back)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekStart = weekAgo.toISOString().slice(0, 10);
      const weeklyDistRows = await attendanceRepository.getWeeklyDistStats(weekStart, today);

      // Monthly dist stats
      const monthlyDistRows = await attendanceRepository.getMonthlyDistStats(thisMonth);

      // Monthly progress stats (DAY by DAY)
      const monthlyProgressRows = await attendanceRepository.getMonthlyProgressStats(thisMonth);

      // Schedules list
      const schedules = await scheduleRepository.getAllSchedules();

      // Transform stats to colors mapping
      const dist = attendanceOptions.map(opt => {
        const found = statRows.find(r => r.status === opt.name);
        return { name: opt.name, color: opt.color, total: found ? found.total : 0 };
      });

      const weeklyDist = attendanceOptions.map(opt => {
        const found = weeklyDistRows.find(r => r.status === opt.name);
        return { name: opt.name, color: opt.color, total: found ? found.total : 0 };
      });

      const monthlyDist = attendanceOptions.map(opt => {
        const found = monthlyDistRows.find(r => r.status === opt.name);
        return { name: opt.name, color: opt.color, total: found ? found.total : 0 };
      });

      res.render('admin/dashboard11', {
        title: 'Admin Dashboard',
        user: req.session.user,
        totalUser,
        stat,
        dist,
        weeklyDist,
        monthlyDist,
        monthly: monthlyProgressRows,
        schedules,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memuat dashboard admin');
      res.redirect('/login');
    }
  }

  // --- Karyawan / Users CRUD ---
  async listUsers(req, res) {
    try {
      const users = await userRepository.getAllUsers();
      res.render('admin/users', {
        title: 'Kelola Karyawan',
        user: req.session.user,
        users,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/dashboard');
    }
  }

  async showAddUser(req, res) {
    try {
      const roles = await userRepository.getAllRoles();
      res.render('admin/users-form', {
        title: 'Tambah Karyawan',
        user: req.session.user,
        edit: null,
        roles,
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/users');
    }
  }

  async postAddUser(req, res) {
    const { username, password, role_id, role } = req.body;
    if (!username || !password || !role_id) {
      req.flash('error', 'Semua field wajib diisi');
      return res.redirect('/admin/users/add');
    }

    try {
      const existing = await userRepository.getUserByUsername(username);
      if (existing) {
        req.flash('error', 'Nama user sudah terdaftar di database');
        return res.redirect('/admin/users/add');
      }

      await adminService.addUser(req, { username, password, role_id, role });
      req.flash('success', `Karyawan "${username}" berhasil ditambahkan`);
      res.redirect('/admin/users');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menambahkan karyawan: ' + err.message);
      res.redirect('/admin/users/add');
    }
  }

  async showEditUser(req, res) {
    try {
      const editUser = await userRepository.getUserById(req.params.id);
      if (!editUser) {
        req.flash('error', 'Karyawan tidak ditemukan');
        return res.redirect('/admin/users');
      }
      
      const roles = await userRepository.getAllRoles();
      res.render('admin/users-form', {
        title: 'Edit Karyawan',
        user: req.session.user,
        edit: editUser,
        roles,
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/users');
    }
  }

  async postEditUser(req, res) {
    const { username, password, role_id, role } = req.body;
    if (!username || !role_id) {
      req.flash('error', 'Nama dan jabatan wajib diisi');
      return res.redirect('/admin/users/edit/' + req.params.id);
    }

    try {
      const existing = await userRepository.getUserByUsername(username);
      if (existing && existing.id !== parseInt(req.params.id)) {
        req.flash('error', 'Nama user sudah dipakai akun lain');
        return res.redirect('/admin/users/edit/' + req.params.id);
      }

      await adminService.editUser(req, req.params.id, { username, password, role_id, role });
      req.flash('success', 'Data karyawan berhasil diperbarui');
      res.redirect('/admin/users');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memperbarui data: ' + err.message);
      res.redirect('/admin/users/edit/' + req.params.id);
    }
  }

  async postDeleteUser(req, res) {
    try {
      await adminService.deleteUser(req, req.params.id);
      req.flash('success', 'Karyawan berhasil dihapus');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus karyawan');
    }
    res.redirect('/admin/users');
  }

  // --- Work Schedules CRUD ---
  async showSchedules(req, res) {
    try {
      const schedules = await scheduleRepository.getAllSchedules();
      const roles = await userRepository.getAllRoles();
      res.render('admin/schedules', {
        title: 'Pengaturan Jadwal',
        user: req.session.user,
        schedules,
        rolesList: roles,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/dashboard');
    }
  }

  async postSaveSchedule(req, res) {
    const { role_id, new_role_name, jam_masuk, jam_pulang, toleransi_keterlambatan, flexible_window_minutes } = req.body;

    try {
      let finalRoleId = role_id;
      
      // Jika admin mengetik jabatan baru secara manual
      if (new_role_name && new_role_name.trim() !== '') {
        const trimmedName = new_role_name.trim();
        let existingRole = await userRepository.getRoleByName(trimmedName);
        if (!existingRole) {
          existingRole = await userRepository.createRole(trimmedName);
        }
        finalRoleId = existingRole.id;
      }

      if (!finalRoleId && !req.body.is_default) {
        req.flash('error', 'Pilih jabatan atau ketik jabatan baru');
        return res.redirect('/admin/schedules');
      }

      const scheduleName = finalRoleId 
        ? `Jadwal Jabatan ID ${finalRoleId}` 
        : 'Jadwal Default Global';

      await adminService.saveSchedule(req, {
        name: scheduleName,
        role_id: finalRoleId || null,
        jam_masuk,
        jam_pulang,
        toleransi_keterlambatan: parseInt(toleransi_keterlambatan) || 0,
        flexible_window_minutes: parseInt(flexible_window_minutes) || 0
      });

      req.flash('success', 'Jadwal berhasil disimpan');
      res.redirect('/admin/schedules');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menyimpan jadwal: ' + err.message);
      res.redirect('/admin/schedules');
    }
  }

  async postDeleteSchedule(req, res) {
    try {
      await adminService.deleteSchedule(req, req.params.id);
      req.flash('success', 'Jadwal berhasil dihapus');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus jadwal');
    }
    res.redirect('/admin/schedules');
  }

  // --- Holidays / Tanggal Merah CRUD ---
  async showHolidays(req, res) {
    try {
      const holidays = await holidayRepository.getAllHolidays();
      res.render('admin/holidays', { // Kita gunakan holidays.ejs yang baru
        title: 'Kelola Hari Libur',
        user: req.session.user,
        holidays,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/dashboard');
    }
  }

  async postAddHoliday(req, res) {
    const { nama_hari_libur, tanggal, deskripsi, allow_override } = req.body;
    if (!nama_hari_libur || !tanggal) {
      req.flash('error', 'Nama libur dan tanggal wajib diisi');
      return res.redirect('/admin/holidays');
    }

    try {
      const existing = await holidayRepository.getHolidayByDate(tanggal);
      if (existing) {
        req.flash('error', 'Hari libur pada tanggal tersebut sudah didaftarkan');
        return res.redirect('/admin/holidays');
      }

      await adminService.addHoliday(req, {
        nama_hari_libur,
        tanggal,
        deskripsi,
        allow_override: allow_override === '1'
      });
      
      req.flash('success', `Hari libur "${nama_hari_libur}" berhasil ditambahkan`);
      res.redirect('/admin/holidays');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menambahkan hari libur');
      res.redirect('/admin/holidays');
    }
  }

  async postEditHoliday(req, res) {
    const { nama_hari_libur, tanggal, deskripsi, allow_override } = req.body;
    if (!nama_hari_libur || !tanggal) {
      req.flash('error', 'Nama libur dan tanggal wajib diisi');
      return res.redirect('/admin/holidays');
    }

    try {
      await adminService.editHoliday(req, req.params.id, {
        nama_hari_libur,
        tanggal,
        deskripsi,
        allow_override: allow_override === '1'
      });
      req.flash('success', 'Hari libur berhasil diperbarui');
      res.redirect('/admin/holidays');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memperbarui hari libur');
      res.redirect('/admin/holidays');
    }
  }

  async postDeleteHoliday(req, res) {
    try {
      await adminService.deleteHoliday(req, req.params.id);
      req.flash('success', 'Hari libur berhasil dihapus');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus hari libur');
    }
    res.redirect('/admin/holidays');
  }

  // --- Audit Log Superadmin ---
  async showAuditLogs(req, res) {
    try {
      const logs = await auditLogRepository.getAllLogs(150);
      res.render('admin/activity-history', {
        title: 'Audit Log Admin',
        user: req.session.user,
        logs
      });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/dashboard');
    }
  }

  // --- Kelola Opsi Absensi / Integrasi ---
  async showIntegrationOptions(req, res) {
    try {
      const tempat = await attendanceRepository.getIntegrationOptions('tempat');
      const keperluan = await attendanceRepository.getIntegrationOptions('keperluan');
      const options = await attendanceRepository.getAttendanceOptions();
      
      res.render('admin/int-options', {
        title: 'Kelola Opsi Absensi',
        user: req.session.user,
        tempat,
        keperluan,
        options,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error(err);
      res.redirect('/admin/dashboard');
    }
  }

  async postAddOption(req, res) {
    const { name, color } = req.body;
    if (!name) {
      req.flash('error', 'Nama opsi wajib diisi');
      return res.redirect('/admin/int-options');
    }
    try {
      await attendanceRepository.addAttendanceOption(name, color);
      await adminService.logAdminActivity(req, `Tambah Opsi Absen`, { name, color });
      req.flash('success', `Opsi "${name}" berhasil ditambahkan`);
      res.redirect('/admin/int-options');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menambahkan opsi');
      res.redirect('/admin/int-options');
    }
  }

  async postEditOption(req, res) {
    const { name, color } = req.body;
    if (!name) {
      req.flash('error', 'Nama opsi wajib diisi');
      return res.redirect('/admin/int-options');
    }
    try {
      await attendanceRepository.updateAttendanceOption(req.params.id, name, color);
      await adminService.logAdminActivity(req, `Update Opsi Absen ID: ${req.params.id}`, { name, color });
      req.flash('success', 'Opsi berhasil diperbarui');
      res.redirect('/admin/int-options');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memperbarui opsi');
      res.redirect('/admin/int-options');
    }
  }

  async postDeleteOption(req, res) {
    try {
      await attendanceRepository.deleteAttendanceOption(req.params.id);
      await adminService.logAdminActivity(req, `Hapus Opsi Absen ID: ${req.params.id}`);
      req.flash('success', 'Opsi berhasil dihapus');
      res.redirect('/admin/int-options');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus opsi');
      res.redirect('/admin/int-options');
    }
  }

  // --- Add Integration Options ---
  async postAddIntOption(req, res) {
    const { type, name, icon } = req.body;
    if (!name || !type) {
      req.flash('error', 'Nama dan tipe wajib diisi');
      return res.redirect('/admin/int-options');
    }
    try {
      const list = await attendanceRepository.getIntegrationOptions(type);
      const maxOrder = list.reduce((max, item) => item.sort_order > max ? item.sort_order : max, 0);
      
      await attendanceRepository.addIntegrationOption(type, name.trim(), icon, maxOrder + 1);
      await adminService.logAdminActivity(req, `Tambah Opsi Integrasi`, { type, name, icon });
      
      req.flash('success', `Opsi "${name}" berhasil ditambahkan`);
      res.redirect('/admin/int-options');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menambahkan opsi integrasi');
      res.redirect('/admin/int-options');
    }
  }

  async postEditIntOption(req, res) {
    const { name, icon } = req.body;
    if (!name) {
      req.flash('error', 'Nama wajib diisi');
      return res.redirect('/admin/int-options');
    }
    try {
      await attendanceRepository.updateIntegrationOption(req.params.id, name.trim(), icon);
      await adminService.logAdminActivity(req, `Update Opsi Integrasi ID: ${req.params.id}`, { name, icon });
      req.flash('success', 'Opsi berhasil diperbarui');
      res.redirect('/admin/int-options');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memperbarui opsi integrasi');
      res.redirect('/admin/int-options');
    }
  }

  async postDeleteIntOption(req, res) {
    try {
      await attendanceRepository.deleteIntegrationOption(req.params.id);
      await adminService.logAdminActivity(req, `Hapus Opsi Integrasi ID: ${req.params.id}`);
      req.flash('success', 'Opsi berhasil dihapus');
      res.redirect('/admin/int-options');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal menghapus opsi integrasi');
      res.redirect('/admin/int-options');
    }
  }

  // --- Perubahan Status Absensi Manual ---
  async postUpdateStatus(req, res) {
    const { attendance_id, new_status, reason } = req.body;
    if (!attendance_id || !new_status) {
      req.flash('error', 'Data tidak lengkap');
      return res.redirect('back');
    }

    try {
      await adminService.updateAttendanceStatus(req, attendance_id, new_status, reason);
      req.flash('success', 'Status absensi berhasil diperbarui');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Gagal memperbarui status: ' + err.message);
    }
    res.redirect('back');
  }
}

module.exports = new AdminController();
