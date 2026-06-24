const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const loginAttemptRepository = require('../repositories/loginAttemptRepository');

class AuthService {
  async authenticate(username, password, ipAddress) {
    // 1. Cek apakah IP & Username sedang terkena cooldown rate limit
    const attempt = await loginAttemptRepository.getAttempt(ipAddress, username);
    
    if (attempt && attempt.cooldown_until) {
      const cooldownUntil = new Date(attempt.cooldown_until).getTime();
      const now = new Date().getTime();
      if (cooldownUntil > now) {
        const remainingSeconds = Math.ceil((cooldownUntil - now) / 1000);
        throw new Error(`Terlalu banyak percobaan login salah. Akun dikunci, silakan coba lagi dalam ${remainingSeconds} detik.`);
      }
    }

    // 2. Ambil data user
    const user = await userRepository.getUserByUsername(username);
    if (!user) {
      await this.handleFailedAttempt(ipAddress, username);
      throw new Error('Username atau password salah');
    }

    // 3. Cocokkan password
    let isMatch = false;
    const isBcrypt = user.password.startsWith('$2');

    if (isBcrypt) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
      
      // Auto-migration: hash password plain-text lama menggunakan bcrypt jika login sukses
      if (isMatch) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await userRepository.updateUser(user.id, { password: hashedPassword });
        user.password = hashedPassword; // update instansi memori
      }
    }

    if (!isMatch) {
      await this.handleFailedAttempt(ipAddress, username);
      throw new Error('Username atau password salah');
    }

    // 4. Reset rate limit login jika login berhasil
    await loginAttemptRepository.resetAttempt(ipAddress, username);

    return user;
  }

  async handleFailedAttempt(ipAddress, username) {
    await loginAttemptRepository.incrementAttempt(ipAddress, username);
    const attempt = await loginAttemptRepository.getAttempt(ipAddress, username);
    
    if (attempt) {
      if (attempt.attempts >= 10) {
        // Cooldown 30 menit
        await loginAttemptRepository.setCooldown(ipAddress, username, 30);
      } else if (attempt.attempts >= 5) {
        // Cooldown 5 menit
        await loginAttemptRepository.setCooldown(ipAddress, username, 5);
      }
    }
  }
}

module.exports = new AuthService();
