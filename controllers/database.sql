  -- =============================================
  -- E-Absen Database
  -- =============================================

  CREATE DATABASE IF NOT EXISTS e_absen;
  USE e_absen;

  -- Tabel users (karyawan)
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    jabatan VARCHAR(100) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Tabel opsi absensi
  CREATE TABLE IF NOT EXISTS attendance_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) DEFAULT '#64748b'
  );

  -- Tabel absensi
  CREATE TABLE IF NOT EXISTS attendances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    checkin_time DATETIME,
    checkout_time DATETIME,
    date DATE NOT NULL,
    notes TEXT,
    checkin_photo MEDIUMTEXT NULL,
    checkout_photo MEDIUMTEXT NULL,
    checkin_location VARCHAR(100) NULL,
    checkout_location VARCHAR(100) NULL,
    attendance_place VARCHAR(150) NULL,
    attendance_purpose VARCHAR(100) NULL,
    source VARCHAR(50) NULL,
    alert_note VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Tabel jadwal per jabatan
  CREATE TABLE IF NOT EXISTS jabatan_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jabatan VARCHAR(100) NOT NULL,
    jam_masuk TIME NOT NULL DEFAULT '08:00:00',
    jam_pulang TIME NOT NULL DEFAULT '17:00:00',
    UNIQUE KEY uq_jabatan (jabatan)
  );

  -- Tabel opsi form integrasi (Tempat & Keperluan)
  CREATE TABLE IF NOT EXISTS integration_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('tempat','keperluan') NOT NULL,
    name VARCHAR(150) NOT NULL,
    icon VARCHAR(20) DEFAULT NULL,
    sort_order INT DEFAULT 0
  );

  -- =============================================
  -- Data awal: opsi absensi
  -- =============================================
  INSERT INTO attendance_options (name, color) VALUES
  ('Hadir', '#22c55e'),
  ('Terlambat', '#f97316'),
  ('Izin', '#eab308'),
  ('Sakit', '#ef4444'),
  ('Alpha', '#dc2626');

  -- =============================================
  -- Data awal: karyawan
  -- =============================================
  INSERT INTO users (username, password, jabatan, role) VALUES
  ('A SY Safira Nur Humaira, S.AK.', '384', 'Staff', 'user'),
  ('Abdul Hafid', '527', 'Staff', 'user'),
  ('Achmad Fazriannur, S.E', '691', 'Staff', 'user'),
  ('Adi Irwan', '248', 'Staff', 'user'),
  ('Aji Andri Dwi Wijaya', '735', 'Wakar Pos Tenggarong Seberang', 'user'),
  ('Arif Budi Rahman, S.P', '786', 'Supervisor', 'user'),
  ('Benny', '459', 'Security', 'user'),
  ('Chris Ferdinan Dalores, S.E, M.Si.', '973', 'Konsultan', 'user'),
  ('David Richardo', '314', 'Supervisor', 'user'),
  ('Deny', '558', 'Staff', 'user'),
  ('Desi Fitri Yani, S.Tr.Ak. M.Ak.', '127', 'Supervisor', 'user'),
  ('ES. Nurul Fahria Fatmi', '846', 'Konsultan', 'user'),
  ('Firyaal Nada Affifah', '290', 'Magang', 'user'),
  ('Muhamamd Turrishan Utomo Adac', '2417', 'Prakerin', 'user'),
  ('Krisna Putra Effendi', '1457', 'Prakerin', 'user'),
  ('Mohammad Shopi, S.T.', '759', 'Staff', 'user'),
  ('Muhammad Fajaruddin, S.T.', '118', 'Staff', 'user'),
  ('Muhammad Ibnu Syuaib', '932', 'Tenaga Harian Lepas', 'user'),
  ('Oky Sjaifudin Adam, S Sos', '564', 'Manajer', 'user'),
  ('Sudirman Baharudin', '287', 'Wakar Kantor', 'user'),
  ('Supriyanto Suzanna', '645', 'Konsultan', 'user'),
  ('Yana Roza Dina, S. Pd.', '371', 'Staff', 'user'),
  ('Yansyah', '809', 'Konsultan', 'user'),
  ('Rezkiah, A.Md.Ak. M.Ak.', '001', 'Supervisor', 'user'),
  ('admin', 'admin123', 'Admin', 'admin');
