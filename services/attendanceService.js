const attendanceRepository = require('../repositories/attendanceRepository');
const scheduleRepository = require('../repositories/scheduleRepository');
const holidayRepository = require('../repositories/holidayRepository');
const { parseHHMM } = require('../utils/helpers');

class AttendanceService {
  async evaluateAttendanceWindow(user, now = new Date()) {
    const todayStr = now.toISOString().slice(0, 10);

    // 1. Cek Hari Libur / Tanggal Merah
    const holiday = await holidayRepository.getHolidayByDate(todayStr);
    if (holiday && !holiday.allow_override) {
      throw new Error(`Hari ini adalah hari libur: ${holiday.nama_hari_libur}. Absensi tidak diizinkan.`);
    }

    // 2. Ambil Jadwal Aktif (Cek Override -> Default Jabatan -> Default Global -> Fallback)
    const activeSchedule = await this.getActiveSchedule(user.id, user.role_id, todayStr);
    
    // 3. Evaluasi flexible window jika ada
    if (activeSchedule.flexible_window_minutes > 0) {
      // Logic window flexible absensi: bisa check-in lebih awal/lambat dari jam masuk reguler
      // untuk mendefinisikan batasan jendela absen yang diizinkan.
      const { hours: mH, minutes: mM } = parseHHMM(activeSchedule.jam_masuk);
      const scheduleTime = new Date(now);
      scheduleTime.setHours(mH, mM, 0, 0);

      const diffMs = now - scheduleTime;
      const diffMinutes = diffMs / 60000;

      // Jika mencoba absen di luar batas jendela fleksibel
      if (Math.abs(diffMinutes) > activeSchedule.flexible_window_minutes && diffMinutes < 0) {
        throw new Error(`Anda berada di luar jendela absensi fleksibel. Jam masuk dijadwalkan pukul ${activeSchedule.jam_masuk.slice(0,5)}.`);
      }
    }

    return { holiday, schedule: activeSchedule };
  }

  async getActiveSchedule(userId, roleId, dateStr) {
    const fallback = { name: 'Fallback Default', jam_masuk: '08:00:00', jam_pulang: '17:00:00', toleransi_keterlambatan: 0, flexible_window_minutes: 0 };
    
    // A. Cek Override
    const override = await scheduleRepository.getOverrideForUserAndDate(userId, dateStr);
    if (override) {
      return {
        name: 'Override Jadwal Harian',
        jam_masuk: override.jam_masuk,
        jam_pulang: override.jam_pulang,
        toleransi_keterlambatan: 0, // override biasanya ketat atau toleransi diset default
        flexible_window_minutes: 0,
        is_override: true,
        notes: override.notes
      };
    }

    // B. Cek Jadwal Per Jabatan (Role)
    if (roleId) {
      const roleSchedule = await scheduleRepository.getScheduleByRoleId(roleId);
      if (roleSchedule) {
        return {
          name: roleSchedule.name,
          jam_masuk: roleSchedule.jam_masuk,
          jam_pulang: roleSchedule.jam_pulang,
          toleransi_keterlambatan: roleSchedule.toleransi_keterlambatan,
          flexible_window_minutes: roleSchedule.flexible_window_minutes,
          is_override: false
        };
      }
    }

    // C. Cek Jadwal Default Global
    const globalDefault = await scheduleRepository.getGlobalDefaultSchedule();
    if (globalDefault) {
      return {
        name: globalDefault.name,
        jam_masuk: globalDefault.jam_masuk,
        jam_pulang: globalDefault.jam_pulang,
        toleransi_keterlambatan: globalDefault.toleransi_keterlambatan,
        flexible_window_minutes: globalDefault.flexible_window_minutes,
        is_override: false
      };
    }

    return fallback;
  }

  async calculateCheckinStatus(purpose, now, activeSchedule) {
    const allowedPurposes = ['Izin', 'Sakit', 'Perjalanan Dinas', 'Remote Work'];
    if (allowedPurposes.includes(purpose)) {
      return { status: purpose, alert: null };
    }

    // Evaluasi Keterlambatan untuk "Masuk Kantor" atau default check-in
    const { hours: mH, minutes: mM } = parseHHMM(activeSchedule.jam_masuk);
    const checkinTime = new Date(now);
    checkinTime.setHours(mH, mM, 0, 0);

    // Tambahkan toleransi keterlambatan
    const toleranceMs = (activeSchedule.toleransi_keterlambatan || 0) * 60 * 1000;
    const maxAllowedTime = new Date(checkinTime.getTime() + toleranceMs);

    const isLate = now > maxAllowedTime;
    
    // Status absensi yang valid
    const status = isLate ? 'Terlambat' : 'Hadir';
    const alert = isLate ? 'Datang Terlambat' : null;

    return { status, alert };
  }

  async calculateCheckoutAlert(now, activeSchedule) {
    const { hours: pH, minutes: pM } = parseHHMM(activeSchedule.jam_pulang);
    const checkoutLimit = new Date(now);
    checkoutLimit.setHours(pH, pM, 0, 0);

    const isEarly = now < checkoutLimit;
    return isEarly ? 'Pulang Terlalu Awal' : null;
  }
}

module.exports = new AttendanceService();
