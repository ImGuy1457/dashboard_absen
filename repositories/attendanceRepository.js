const db = require('../config/db');

class AttendanceRepository {
  async getAttendanceById(id) {
    const [rows] = await db.query(`
      SELECT a.*, u.username as user_name, r.name as jabatan 
      FROM attendances a
      JOIN users u ON a.user~_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE a.id = ?
    `, [id]);
    return rows[0] || null;
  }

  async getTodayAttendance(userId, today) {
    const [rows] = await db.query(
      'SELECT * FROM attendances WHERE user_id = ? AND date = ?',
      [userId, today]
    );
    return rows[0] || null;
  }

  async insertAttendance(data) {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = Object.values(data);
    
    const [result] = await db.query(
      `INSERT INTO attendances (${fields.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return result.insertId;
  }

  async updateAttendance(id, data) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    
    if (fields.length === 0) return false;
    
    values.push(id);
    const [result] = await db.query(
      `UPDATE attendances SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  async getAttendanceWithFilters(whereStr, params, limit, offset) {
    let query = `
      SELECT a.*, u.username AS user_name, r.name AS jabatan
      FROM attendances a 
      JOIN users u ON a.user_id = u.id 
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    
    if (whereStr) {
      query += ` WHERE ${whereStr}`;
    }
    
    query += ` ORDER BY a.date DESC, a.checkin_time DESC`;
    
    if (limit !== undefined && offset !== undefined) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }
    
    const [rows] = await db.query(query, params);
    return rows;
  }

  async countAttendanceWithFilters(whereStr, params) {
    let query = `
      SELECT COUNT(*) as total 
      FROM attendances a 
      JOIN users u ON a.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    
    if (whereStr) {
      query += ` WHERE ${whereStr}`;
    }
    
    const [[{ total }]] = await db.query(query, params);
    return total;
  }

  // --- Attendance Options (untuk form UI) ---
  async getAttendanceOptions() {
    const [rows] = await db.query('SELECT * FROM attendance_options ORDER BY id');
    return rows;
  }

  async addAttendanceOption(name, color) {
    const [result] = await db.query(
      'INSERT INTO attendance_options (name, color) VALUES (?, ?)',
      [name, color || '#64748b']
    );
    return result.insertId;
  }

  async updateAttendanceOption(id, name, color) {
    const [result] = await db.query(
      'UPDATE attendance_options SET name = ?, color = ? WHERE id = ?',
      [name, color || '#64748b', id]
    );
    return result.affectedRows > 0;
  }

  async deleteAttendanceOption(id) {
    const [result] = await db.query('DELETE FROM attendance_options WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // --- Attendance Integration Options ---
  async getIntegrationOptions(type) {
    const [rows] = await db.query(
      "SELECT * FROM integration_options WHERE type = ? ORDER BY sort_order, name",
      [type]
    );
    return rows;
  }

  async addIntegrationOption(type, name, icon, sortOrder) {
    const [result] = await db.query(
      "INSERT INTO integration_options (type, name, icon, sort_order) VALUES (?, ?, ?, ?)",
      [type, name, icon || null, sortOrder || 0]
    );
    return result.insertId;
  }

  async updateIntegrationOption(id, name, icon) {
    const [result] = await db.query(
      "UPDATE integration_options SET name = ?, icon = ? WHERE id = ?",
      [name, icon || null, id]
    );
    return result.affectedRows > 0;
  }

  async deleteIntegrationOption(id) {
    const [result] = await db.query("DELETE FROM integration_options WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }

  // --- Stats & Dashboard ---
  async getTodayStatusCounts(todayDate) {
    const [rows] = await db.query(
      'SELECT status, COUNT(*) as total FROM attendances WHERE date = ? GROUP BY status',
      [todayDate]
    );
    return rows;
  }

  async getMonthlyUserStats(userId, monthPrefix) {
    const [rows] = await db.query(`
      SELECT 
        SUM(status='Hadir') hadir, 
        SUM(status='Terlambat') terlambat,
        SUM(status='Alpha') alpha, 
        SUM(status='Izin') izin, 
        SUM(status='Sakit') sakit, 
        SUM(status='Perjalanan Dinas') dinas,
        COUNT(*) total
      FROM attendances 
      WHERE user_id = ? AND date LIKE ?
    `, [userId, monthPrefix + '%']);
    return rows[0] || { hadir: 0, terlambat: 0, alpha: 0, izin: 0, sakit: 0, dinas: 0, total: 0 };
  }

  async getWeeklyDistStats(startDate, endDate) {
    const [rows] = await db.query(`
      SELECT status, COUNT(*) as total 
      FROM attendances 
      WHERE date BETWEEN ? AND ? 
      GROUP BY status
    `, [startDate, endDate]);
    return rows;
  }

  async getMonthlyDistStats(monthPrefix) {
    const [rows] = await db.query(`
      SELECT status, COUNT(*) as total 
      FROM attendances 
      WHERE date LIKE ? 
      GROUP BY status
    `, [monthPrefix + '%']);
    return rows;
  }

  async getMonthlyProgressStats(monthPrefix) {
    const [rows] = await db.query(`
      SELECT DAY(date) as day, SUM(status='Hadir') as tepat, SUM(status='Terlambat') as telat 
      FROM attendances 
      WHERE date LIKE ? 
      GROUP BY DAY(date)
    `, [monthPrefix + '%']);
    return rows;
  }

  // --- History Status Audit ---
  async createAttendanceStatusHistory({ attendance_id, old_status, new_status, changed_by, reason }) {
    const [result] = await db.query(`
      INSERT INTO attendance_status_history (attendance_id, old_status, new_status, changed_by, reason) 
      VALUES (?, ?, ?, ?, ?)
    `, [attendance_id, old_status, new_status, changed_by, reason]);
    return result.insertId;
  }

  async getStatusHistoryByAttendanceId(attendanceId) {
    const [rows] = await db.query(`
      SELECT h.*, u.username as changed_by_name 
      FROM attendance_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.attendance_id = ?
      ORDER BY h.created_at DESC
    `, [attendanceId]);
    return rows;
  }
}

module.exports = new AttendanceRepository();
