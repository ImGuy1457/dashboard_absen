const db = require('../config/db');

class LoginAttemptRepository {
  async getAttempt(ipAddress, username) {
    const [rows] = await db.query(
      'SELECT * FROM login_attempts WHERE ip_address = ? AND username = ?',
      [ipAddress, username]
    );
    return rows[0] || null;
  }

  async incrementAttempt(ipAddress, username) {
    const [result] = await db.query(`
      INSERT INTO login_attempts (ip_address, username, attempts, last_attempt, cooldown_until) 
      VALUES (?, ?, 1, CURRENT_TIMESTAMP, NULL)
      ON DUPLICATE KEY UPDATE 
        attempts = attempts + 1,
        last_attempt = CURRENT_TIMESTAMP
    `, [ipAddress, username]);
    return result;
  }

  async setCooldown(ipAddress, username, cooldownMinutes) {
    const [result] = await db.query(`
      UPDATE login_attempts 
      SET cooldown_until = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE)
      WHERE ip_address = ? AND username = ?
    `, [cooldownMinutes, ipAddress, username]);
    return result;
  }

  async resetAttempt(ipAddress, username) {
    const [result] = await db.query(
      'DELETE FROM login_attempts WHERE ip_address = ? AND username = ?',
      [ipAddress, username]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new LoginAttemptRepository();
