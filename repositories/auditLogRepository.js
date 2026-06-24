const db = require('../config/db');

class AuditLogRepository {
  async createLog({ admin_id, nama_admin, aksi, target_data, ip_address, user_agent }) {
    const [result] = await db.query(`
      INSERT INTO admin_audit_logs (admin_id, nama_admin, aksi, target_data, ip_address, user_agent) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [admin_id, nama_admin, aksi, target_data ? JSON.stringify(target_data) : null, ip_address, user_agent]);
    return result.insertId;
  }

  async getAllLogs(limit = 100) {
    const [rows] = await db.query(`
      SELECT l.*, u.username as admin_username 
      FROM admin_audit_logs l
      JOIN users u ON l.admin_id = u.id
      ORDER BY l.created_at DESC 
      LIMIT ?
    `, [limit]);
    return rows;
  }

  async getLogsByAdminId(adminId, limit = 100) {
    const [rows] = await db.query(`
      SELECT l.*, u.username as admin_username 
      FROM admin_audit_logs l
      JOIN users u ON l.admin_id = u.id
      WHERE l.admin_id = ?
      ORDER BY l.created_at DESC 
      LIMIT ?
    `, [adminId, limit]);
    return rows;
  }
}

module.exports = new AuditLogRepository();
