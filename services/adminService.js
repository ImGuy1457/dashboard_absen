const auditLogRepository = require('../repositories/auditLogRepository');
const userRepository = require('../repositories/userRepository');
const scheduleRepository = require('../repositories/scheduleRepository');
const holidayRepository = require('../repositories/holidayRepository');
const attendanceRepository = require('../repositories/attendanceRepository');
const bcrypt = require('bcryptjs');

class AdminService {
  async logAdminActivity(req, action, targetData = null) {
    try {
      const admin = req.session.user;
      if (!admin) return;
      
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      await auditLogRepository.createLog({
        admin_id: admin.id,
        nama_admin: admin.username,
        aksi: action,
        target_data: targetData,
        ip_address: ipAddress,
        user_agent: userAgent
      });
    } catch (err) {
      console.error('Failed to log admin activity:', err.message);
    }
  }

  // --- User / Karyawan CRUD ---
  async addUser(req, { username, password, role_id, role }) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUserId = await userRepository.createUser({
      username,
      password: hashedPassword,
      role_id,
      role: role || 'user'
    });
    
    await this.logAdminActivity(req, `Tambah User Karyawan`, { username, role, role_id });
    return newUserId;
  }

  async editUser(req, id, { username, password, role_id, role }) {
    const updateData = { username, role_id, role };
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    const success = await userRepository.updateUser(id, updateData);
    if (success) {
      await this.logAdminActivity(req, `Update User ID: ${id}`, { username, role, role_id });
    }
    return success;
  }

  async deleteUser(req, id) {
    const user = await userRepository.getUserById(id);
    const success = await userRepository.deleteUser(id);
    if (success && user) {
      await this.logAdminActivity(req, `Hapus User ID: ${id}`, { username: user.username });
    }
    return success;
  }

  // --- Work Schedule CRUD ---
  async saveSchedule(req, { name, role_id, jam_masuk, jam_pulang, toleransi_keterlambatan, flexible_window_minutes }) {
    const result = await scheduleRepository.saveSchedule({
      name,
      role_id,
      jam_masuk,
      jam_pulang,
      toleransi_keterlambatan,
      flexible_window_minutes
    });
    await this.logAdminActivity(req, `Simpan/Update Jadwal Kerja`, { name, role_id, jam_masuk, jam_pulang });
    return result;
  }

  async deleteSchedule(req, id) {
    const sched = await scheduleRepository.getScheduleById(id);
    const success = await scheduleRepository.deleteSchedule(id);
    if (success && sched) {
      await this.logAdminActivity(req, `Hapus Jadwal Kerja ID: ${id}`, { name: sched.name, role: sched.role_name });
    }
    return success;
  }

  // --- Holiday CRUD ---
  async addHoliday(req, { nama_hari_libur, tanggal, deskripsi, allow_override }) {
    const holidayId = await holidayRepository.createHoliday({
      nama_hari_libur,
      tanggal,
      deskripsi,
      allow_override
    });
    await this.logAdminActivity(req, `Tambah Hari Libur`, { nama_hari_libur, tanggal });
    return holidayId;
  }

  async editHoliday(req, id, { nama_hari_libur, tanggal, deskripsi, allow_override }) {
    const success = await holidayRepository.updateHoliday(id, {
      nama_hari_libur,
      tanggal,
      deskripsi,
      allow_override
    });
    if (success) {
      await this.logAdminActivity(req, `Update Hari Libur ID: ${id}`, { nama_hari_libur, tanggal });
    }
    return success;
  }

  async deleteHoliday(req, id) {
    const holiday = await holidayRepository.getHolidayById(id);
    const success = await holidayRepository.deleteHoliday(id);
    if (success && holiday) {
      await this.logAdminActivity(req, `Hapus Hari Libur ID: ${id}`, { nama_hari_libur: holiday.nama_hari_libur, tanggal: holiday.tanggal });
    }
    return success;
  }

  // --- Edit Absensi & Status History ---
  async updateAttendanceStatus(req, attendanceId, newStatus, reason) {
    const attendance = await attendanceRepository.getAttendanceById(attendanceId);
    if (!attendance) throw new Error('Data absensi tidak ditemukan');
    
    const oldStatus = attendance.status;
    const admin = req.session.user;
    
    // Update status
    const success = await attendanceRepository.updateAttendance(attendanceId, { status: newStatus });
    
    if (success) {
      // Catat ke riwayat status absensi
      await attendanceRepository.createAttendanceStatusHistory({
        attendance_id: attendanceId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: admin.id,
        reason: reason || 'Diperbarui oleh Admin'
      });
      
      // Catat ke audit log admin
      await this.logAdminActivity(req, `Ubah Status Absen ID: ${attendanceId}`, {
        user: attendance.user_name,
        old_status: oldStatus,
        new_status: newStatus,
        reason
      });
    }
    return success;
  }
}

module.exports = new AdminService();
