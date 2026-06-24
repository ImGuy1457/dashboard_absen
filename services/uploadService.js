const fs = require('fs/promises');
const path = require('path');
const { normalizeCameraPhoto } = require('../utils/helpers');

class UploadService {
  async saveAttendancePhoto(userId, photoBase64, type = 'checkin', username = null) {
    const normalized = normalizeCameraPhoto(photoBase64);
    if (!normalized) return null;

    // Ekstrak tipe mime dan data base64
    const matches = normalized.match(/^data:image\/([A-Za-z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Format gambar tidak valid');
    }

    const imageType = matches[1].toLowerCase();
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validasi tipe file
    const allowedTypes = ['png', 'jpeg', 'jpg', 'webp'];
    if (!allowedTypes.includes(imageType)) {
      throw new Error('Tipe file gambar tidak didukung. Gunakan PNG, JPG, JPEG, atau WebP.');
    }

    // Validasi ukuran file (misal maks 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new Error('Ukuran file gambar terlalu besar (Maksimal 5MB)');
    }

    // Gunakan nama user untuk folder (sanitize karakter tidak valid), fallback ke user-{id}
    let folderName;
    if (username) {
      // Sanitize: ganti spasi dengan underscore, hapus karakter tidak aman untuk nama folder
      const safeName = username.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '');
      folderName = safeName || `user-${userId}`;
    } else {
      folderName = `user-${userId}`;
    }

    const uploadDir = path.resolve(__dirname, '..', 'uploads', folderName);
    
    // Pastikan direktori sudah dibuat secara rekursif
    await fs.mkdir(uploadDir, { recursive: true });

    // Buat nama file unik: YYYY-MM-DD_HHMMSS_checkin.jpg
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(v => String(v).padStart(2, '0'))
      .join('');
    
    const filename = `${dateStr}_${timeStr}_${type}.${imageType}`;
    const filePath = path.join(uploadDir, filename);

    // Tulis buffer ke file
    await fs.writeFile(filePath, buffer);

    // Return path relatif untuk database
    return `/uploads/${folderName}/${filename}`;
  }
}

module.exports = new UploadService();
