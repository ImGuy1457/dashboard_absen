const cron = require('node-cron');
const { runAlphaCheck } = require('../jobs/alphaJob');

class CronService {
  init() {
    console.log('[CronService] Initializing schedulers...');
    
    // Jalankan pengecekan otomatis ALPHA setiap jam pada menit ke-0
    // Format: menit jam hari_bulan bulan hari_minggu
    cron.schedule('0 * * * *', async () => {
      try {
        await runAlphaCheck();
      } catch (err) {
        console.error('[CronService] Error running runAlphaCheck:', err);
      }
    });

    // Jalankan sekali pada startup untuk memastikan tanggal-tanggal sebelumnya ter-finalisasi
    setTimeout(async () => {
      try {
        await runAlphaCheck();
      } catch (err) {
        console.error('[CronService] Startup runAlphaCheck failed:', err);
      }
    }, 5000); // Tunggu 5 detik setelah server berjalan agar DB siap
  }
}

module.exports = new CronService();
