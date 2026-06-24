const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'e_absen',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function runMigrations() {
  console.log('Running database migrations...');
  
  // 1. Buat tabel roles jika belum ada
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `);

  // 2. Cek kolom di tabel users
  const [userCols] = await pool.query('SHOW COLUMNS FROM users');
  const userFields = new Set(userCols.map(c => c.Field));

  // Tambahkan role_id jika belum ada
  if (!userFields.has('role_id')) {
    await pool.query('ALTER TABLE users ADD COLUMN role_id INT NULL');
    await pool.query('ALTER TABLE users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL');
  }

  // Ubah tipe ENUM role untuk mendukung superadmin jika belum
  const roleCol = userCols.find(c => c.Field === 'role');
  if (roleCol && (!roleCol.Type.includes('superadmin'))) {
    // Ubah tipe kolom role menjadi enum('superadmin', 'admin', 'user')
    // Pertama, hilangkan foreign key constraint sementara jika ada atau langsung ubah
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('superadmin', 'admin', 'user') DEFAULT 'user'");
  }

  // 3. Migrasi data jabatan lama ke tabel roles jika ada kolom jabatan
  if (userFields.has('jabatan')) {
    // Ambil daftar jabatan unik yang masih ada di users
    const [rows] = await pool.query('SELECT DISTINCT jabatan FROM users WHERE jabatan IS NOT NULL AND jabatan <> ""');
    
    // Default job options jika tabel roles kosong
    const defaultJobs = [
      'Admin', 'Staff', 'Supervisor', 'Security', 'Konsultan', 
      'Magang', 'Prakerin', 'Tenaga Harian Lepas', 'Manajer', 
      'Wakar Kantor', 'Wakar Pos Tenggarong Seberang'
    ];
    
    const allJobs = new Set([...defaultJobs, ...rows.map(r => r.jabatan)]);
    
    for (const jobName of allJobs) {
      await pool.query('INSERT IGNORE INTO roles (name) VALUES (?)', [jobName]);
    }

    // Update role_id di tabel users berdasarkan pencocokan string jabatan
    const [roles] = await pool.query('SELECT id, name FROM roles');
    for (const r of roles) {
      await pool.query('UPDATE users SET role_id = ? WHERE jabatan = ? AND role_id IS NULL', [r.id, r.name]);
    }
    
    // Set default role_id untuk admin
    const adminRole = roles.find(r => r.name.toLowerCase() === 'admin');
    if (adminRole) {
      await pool.query('UPDATE users SET role_id = ? WHERE username = "admin" AND role_id IS NULL', [adminRole.id]);
    }
  }

  // Set user 'admin' menjadi 'superadmin' agar ada superadmin default untuk pengujian log aktivitas
  await pool.query("UPDATE users SET role = 'superadmin' WHERE username = 'admin' AND role = 'admin'");

  // 4. Tabel work_schedules (Jadwal Kerja Fleksibel)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      role_id INT NULL,
      jam_masuk TIME NOT NULL DEFAULT '08:00:00',
      jam_pulang TIME NOT NULL DEFAULT '17:00:00',
      toleransi_keterlambatan INT DEFAULT 0,
      flexible_window_minutes INT DEFAULT 0,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      UNIQUE KEY uq_schedule_role (role_id)
    )
  `);

  // Jika tabel work_schedules kosong, migrasikan data dari jabatan_schedules lama
  const [[{ count: wsCount }]] = await pool.query('SELECT COUNT(*) as count FROM work_schedules');
  
  // Cek apakah tabel jabatan_schedules lama ada
  const [tables] = await pool.query("SHOW TABLES LIKE 'jabatan_schedules'");
  if (wsCount === 0 && tables.length > 0) {
    const [oldScheds] = await pool.query('SELECT * FROM jabatan_schedules');
    const [roles] = await pool.query('SELECT id, name FROM roles');
    
    for (const os of oldScheds) {
      if (os.jabatan === '_default_') {
        await pool.query(
          'INSERT INTO work_schedules (name, role_id, jam_masuk, jam_pulang) VALUES (?, NULL, ?, ?)',
          ['Jadwal Default', os.jam_masuk, os.jam_pulang]
        );
      } else {
        const matchingRole = roles.find(r => r.name === os.jabatan);
        if (matchingRole) {
          await pool.query(
            'INSERT INTO work_schedules (name, role_id, jam_masuk, jam_pulang) VALUES (?, ?, ?, ?)',
            [`Jadwal ${os.jabatan}`, matchingRole.id, os.jam_masuk, os.jam_pulang]
          );
        }
      }
    }
  }

  // 5. Tabel employee_schedule_overrides (Override Jadwal Kerja)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_schedule_overrides (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      jam_masuk TIME NOT NULL,
      jam_pulang TIME NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_date (user_id, date)
    )
  `);

  // 6. Tabel holidays (Tanggal Merah / Hari Libur)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama_hari_libur VARCHAR(150) NOT NULL,
      tanggal DATE NOT NULL,
      deskripsi TEXT,
      allow_override TINYINT(1) DEFAULT 0,
      UNIQUE KEY uq_holiday_date (tanggal)
    )
  `);

  // 7. Tabel attendance_finalizations (Pencegah Duplikasi ALPHA)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_finalizations (
      date DATE PRIMARY KEY,
      finalized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. Tabel admin_audit_logs (Immutable Log Aktivitas Admin)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      nama_admin VARCHAR(150) NOT NULL,
      aksi VARCHAR(255) NOT NULL,
      target_data TEXT,
      ip_address VARCHAR(45) NOT NULL,
      user_agent VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 9. Tabel attendance_status_history (Riwayat Perubahan Status Absensi)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      attendance_id INT NOT NULL,
      old_status VARCHAR(50),
      new_status VARCHAR(50),
      changed_by INT,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 10. Tabel login_attempts (Rate Limiting Login)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      username VARCHAR(150) NOT NULL,
      attempts INT NOT NULL DEFAULT 1,
      last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      cooldown_until TIMESTAMP NULL,
      UNIQUE KEY uq_ip_user (ip_address, username)
    )
  `);

  // 11. Cek & Tambahkan Kolom Baru di Tabel attendances jika perlu
  const [attnCols] = await pool.query('SHOW COLUMNS FROM attendances');
  const attnFields = new Set(attnCols.map(c => c.Field));
  const alters = [];
  
  if (!attnFields.has('checkin_photo')) alters.push('ADD COLUMN checkin_photo VARCHAR(255) NULL');
  if (!attnFields.has('checkout_photo')) alters.push('ADD COLUMN checkout_photo VARCHAR(255) NULL');
  if (!attnFields.has('checkin_location')) alters.push('ADD COLUMN checkin_location VARCHAR(100) NULL');
  if (!attnFields.has('checkout_location')) alters.push('ADD COLUMN checkout_location VARCHAR(100) NULL');
  if (!attnFields.has('attendance_place')) alters.push('ADD COLUMN attendance_place VARCHAR(150) NULL');
  if (!attnFields.has('attendance_purpose')) alters.push('ADD COLUMN attendance_purpose VARCHAR(100) NULL');
  if (!attnFields.has('source')) alters.push('ADD COLUMN source VARCHAR(50) NULL');
  if (!attnFields.has('alert_note')) alters.push('ADD COLUMN alert_note VARCHAR(100) NULL');

  if (alters.length) {
    await pool.query(`ALTER TABLE attendances ${alters.join(', ')}`);
  }

  // Jika kolom foto di database masih menggunakan MEDIUMTEXT dan kita ingin migrasi ke VARCHAR(255)
  // tapi kita harus hati-hati agar tidak merusak data Base64 lama yang tersimpan. 
  // Kita biarkan tipe datanya MEDIUMTEXT agar kompatibel dengan data base64 lama dan string path baru.
  await pool.query('ALTER TABLE attendances MODIFY COLUMN checkin_photo MEDIUMTEXT NULL');
  await pool.query('ALTER TABLE attendances MODIFY COLUMN checkout_photo MEDIUMTEXT NULL');

  console.log('Database migrations completed successfully.');
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  runMigrations
};
