const db = require('../config/db');

class UserRepository {
  async getAllUsers() {
    const [rows] = await db.query(`
      SELECT u.id, u.username, u.password, u.role, u.role_id, r.name as jabatan 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      ORDER BY u.username ASC
    `);
    return rows;
  }

  async getUserById(id) {
    const [rows] = await db.query(`
      SELECT u.id, u.username, u.password, u.role, u.role_id, r.name as jabatan 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [id]);
    return rows[0] || null;
  }

  async getUserByUsername(username) {
    const [rows] = await db.query(`
      SELECT u.id, u.username, u.password, u.role, u.role_id, r.name as jabatan 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id 
      WHERE u.username = ?
    `, [username]);
    return rows[0] || null;
  }

  async createUser({ username, password, role_id, role }) {
    const [result] = await db.query(
      'INSERT INTO users (username, password, role_id, role) VALUES (?, ?, ?, ?)',
      [username, password, role_id, role || 'user']
    );
    return result.insertId;
  }

  async updateUser(id, data) {
    const fields = [];
    const values = [];
    
    if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username); }
    if (data.password !== undefined) { fields.push('password = ?'); values.push(data.password); }
    if (data.role_id !== undefined) { fields.push('role_id = ?'); values.push(data.role_id); }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
    
    if (fields.length === 0) return false;
    
    values.push(id);
    const [result] = await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return result.affectedRows > 0;
  }

  async deleteUser(id) {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // --- Role / Jabatan Operations ---
  async getAllRoles() {
    const [rows] = await db.query('SELECT id, name FROM roles ORDER BY name ASC');
    return rows;
  }

  async getRoleById(id) {
    const [rows] = await db.query('SELECT id, name FROM roles WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async getRoleByName(name) {
    const [rows] = await db.query('SELECT id, name FROM roles WHERE name = ?', [name]);
    return rows[0] || null;
  }

  async createRole(name) {
    const [result] = await db.query('INSERT INTO roles (name) VALUES (?)', [name]);
    return { id: result.insertId, name };
  }

  async deleteRole(id) {
    const [result] = await db.query('DELETE FROM roles WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = new UserRepository();
