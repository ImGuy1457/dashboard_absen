const db = require('../config/db');

class HolidayRepository {
  async getAllHolidays() {
    const [rows] = await db.query('SELECT * FROM holidays ORDER BY tanggal DESC');
    return rows;
  }

  async getHolidayById(id) {
    const [rows] = await db.query('SELECT * FROM holidays WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async getHolidayByDate(date) {
    const [rows] = await db.query('SELECT * FROM holidays WHERE tanggal = ?', [date]);
    return rows[0] || null;
  }

  async createHoliday({ nama_hari_libur, tanggal, deskripsi, allow_override }) {
    const [result] = await db.query(
      'INSERT INTO holidays (nama_hari_libur, tanggal, deskripsi, allow_override) VALUES (?, ?, ?, ?)',
      [nama_hari_libur, tanggal, deskripsi || null, allow_override ? 1 : 0]
    );
    return result.insertId;
  }

  async updateHoliday(id, { nama_hari_libur, tanggal, deskripsi, allow_override }) {
    const [result] = await db.query(
      'UPDATE holidays SET nama_hari_libur = ?, tanggal = ?, deskripsi = ?, allow_override = ? WHERE id = ?',
      [nama_hari_libur, tanggal, deskripsi || null, allow_override ? 1 : 0, id]
    );
    return result.affectedRows > 0;
  }

  async deleteHoliday(id) {
    const [result] = await db.query('DELETE FROM holidays WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = new HolidayRepository();
