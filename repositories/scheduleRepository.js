const db = require('../config/db');

class ScheduleRepository {
  async getAllSchedules() {
    const [rows] = await db.query(`
      SELECT ws.*, r.name as role_name 
      FROM work_schedules ws
      LEFT JOIN roles r ON ws.role_id = r.id
      ORDER BY r.name ASC, ws.name ASC
    `);
    return rows;
  }

  async getScheduleById(id) {
    const [rows] = await db.query(`
      SELECT ws.*, r.name as role_name 
      FROM work_schedules ws
      LEFT JOIN roles r ON ws.role_id = r.id
      WHERE ws.id = ?
    `, [id]);
    return rows[0] || null;
  }

  async getScheduleByRoleId(roleId) {
    const [rows] = await db.query(
      'SELECT * FROM work_schedules WHERE role_id = ?',
      [roleId]
    );
    return rows[0] || null;
  }

  async getGlobalDefaultSchedule() {
    const [rows] = await db.query(
      'SELECT * FROM work_schedules WHERE role_id IS NULL'
    );
    return rows[0] || null;
  }

  async saveSchedule({ name, role_id, jam_masuk, jam_pulang, toleransi_keterlambatan, flexible_window_minutes }) {
    // Gunakan INSERT ON DUPLICATE KEY UPDATE berdasarkan uq_schedule_role (role_id)
    const [result] = await db.query(`
      INSERT INTO work_schedules (name, role_id, jam_masuk, jam_pulang, toleransi_keterlambatan, flexible_window_minutes) 
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name),
        jam_masuk = VALUES(jam_masuk),
        jam_pulang = VALUES(jam_pulang),
        toleransi_keterlambatan = VALUES(toleransi_keterlambatan),
        flexible_window_minutes = VALUES(flexible_window_minutes)
    `, [name, role_id || null, jam_masuk, jam_pulang, toleransi_keterlambatan || 0, flexible_window_minutes || 0]);
    return result;
  }

  async deleteSchedule(id) {
    const [result] = await db.query('DELETE FROM work_schedules WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // --- Schedule Overrides ---
  async getOverrideForUserAndDate(userId, date) {
    const [rows] = await db.query(
      'SELECT * FROM employee_schedule_overrides WHERE user_id = ? AND date = ?',
      [userId, date]
    );
    return rows[0] || null;
  }

  async saveOverride({ user_id, date, jam_masuk, jam_pulang, notes }) {
    const [result] = await db.query(`
      INSERT INTO employee_schedule_overrides (user_id, date, jam_masuk, jam_pulang, notes) 
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        jam_masuk = VALUES(jam_masuk),
        jam_pulang = VALUES(jam_pulang),
        notes = VALUES(notes)
    `, [user_id, date, jam_masuk, jam_pulang, notes || null]);
    return result;
  }

  async deleteOverride(id) {
    const [result] = await db.query('DELETE FROM employee_schedule_overrides WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async getActiveOverridesForUser(userId) {
    const [rows] = await db.query(
      'SELECT * FROM employee_schedule_overrides WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );
    return rows;
  }
}

module.exports = new ScheduleRepository();
