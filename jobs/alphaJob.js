const db = require('../config/db');
const userRepository = require('../repositories/userRepository');
const holidayRepository = require('../repositories/holidayRepository');
const attendanceRepository = require('../repositories/attendanceRepository');

async function runAlphaCheck() {
  console.log('[AlphaJob] Starting automatic ALPHA checks...');
  
  // Dapatkan daftar tanggal selama 14 hari terakhir untuk mengecek finalisasi yang terlewat
  const datesToCheck = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    datesToCheck.push(d.toISOString().slice(0, 10));
  }
  
  // Urutkan dari tanggal terlama ke terbaru
  datesToCheck.reverse();

  for (const dateStr of datesToCheck) {
    try {
      // 1. Cek apakah tanggal sudah finalized
      const [finalized] = await db.query(
        'SELECT date FROM attendance_finalizations WHERE date = ?',
        [dateStr]
      );
      if (finalized.length > 0) {
        continue; // Sudah finalized, abaikan
      }

      console.log(`[AlphaJob] Processing date: ${dateStr}`);

      const dateObj = new Date(dateStr);
      const dayOfWeek = dateObj.getDay(); // 0 = Minggu, 6 = Sabtu

      // 2. Cek apakah hari libur akhir pekan
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Akhir pekan langsung ditandai finalized
        await db.query('INSERT IGNORE INTO attendance_finalizations (date) VALUES (?)', [dateStr]);
        continue;
      }

      // 3. Cek apakah tanggal merah / hari libur nasional
      const holiday = await holidayRepository.getHolidayByDate(dateStr);
      if (holiday) {
        // Hari libur nasional langsung ditandai finalized
        await db.query('INSERT IGNORE INTO attendance_finalizations (date) VALUES (?)', [dateStr]);
        continue;
      }

      // 4. Cari karyawan aktif (role = user)
      const users = await userRepository.getAllUsers();
      const employees = users.filter(u => u.role === 'user');

      for (const emp of employees) {
        // A. Cek apakah sudah ada data absensi untuk user di tanggal tersebut
        const todayAttendance = await attendanceRepository.getTodayAttendance(emp.id, dateStr);
        if (todayAttendance) {
          continue; // Sudah melakukan absensi (Hadir/Terlambat/Izin/Sakit/dll), abaikan
        }

        // B. Cek apakah ada override jadwal perjalanan dinas/izin/sakit di hari tersebut
        const [overrides] = await db.query(
          "SELECT * FROM employee_schedule_overrides WHERE user_id = ? AND date = ?",
          [emp.id, dateStr]
        );
        
        // Catatan: Jika ada override tapi tidak ada absensi, kita tetap perlu tahu
        // apakah status di override membebaskan absensi. Sesuai ketentuan user:
        // "Jangan membuat ALPHA jika: hari libur, izin, sakit, perjalanan dinas, libur shift"
        // Kita periksa catatan/keterangan di override jika berisi kata kunci pembebasan.
        let skipAlpha = false;
        if (overrides.length > 0) {
          const notesLower = (overrides[0].notes || '').toLowerCase();
          if (
            notesLower.includes('dinas') ||
            notesLower.includes('perjalanan dinas') ||
            notesLower.includes('izin') ||
            notesLower.includes('sakit') ||
            notesLower.includes('libur') ||
            notesLower.includes('shift')
          ) {
            skipAlpha = true;
          }
        }

        if (skipAlpha) {
          continue;
        }

        // C. Sisipkan record ALPHA untuk user tersebut
        await attendanceRepository.insertAttendance({
          user_id: emp.id,
          status: 'Alpha',
          date: dateStr,
          notes: 'ALPHA otomatis oleh sistem (tidak check-in pada hari kerja)',
          source: 'system'
        });
        
        console.log(`[AlphaJob] Marked user ${emp.username} as Alpha on ${dateStr}`);
      }

      // 5. Tandai tanggal ini sebagai finalized
      await db.query('INSERT IGNORE INTO attendance_finalizations (date) VALUES (?)', [dateStr]);
      console.log(`[AlphaJob] Date ${dateStr} finalized.`);

    } catch (err) {
      console.error(`[AlphaJob] Error processing date ${dateStr}:`, err.message);
    }
  }
}

module.exports = {
  runAlphaCheck
};
