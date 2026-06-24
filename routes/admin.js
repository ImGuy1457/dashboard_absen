const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLogin, isAdmin, isSuperAdmin } = require('../middlewares/authMiddleware');
const { doubleCsrfProtection, injectCsrfToken } = require('../middlewares/securityMiddleware');

// Dashboard Admin
router.get('/admin/dashboard', isLogin, isAdmin, adminController.showDashboard);

// CRUD Karyawan
router.get('/admin/users', isLogin, isAdmin, adminController.listUsers);
router.get('/admin/users/add', isLogin, isAdmin, injectCsrfToken, adminController.showAddUser);
router.post('/admin/users/add', isLogin, isAdmin, doubleCsrfProtection, adminController.postAddUser);
router.get('/admin/users/edit/:id', isLogin, isAdmin, injectCsrfToken, adminController.showEditUser);
router.post('/admin/users/edit/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postEditUser);
router.post('/admin/users/delete/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postDeleteUser);

// CRUD Jadwal Jabatan
router.get('/admin/schedules', isLogin, isAdmin, injectCsrfToken, adminController.showSchedules);
router.post('/admin/schedules/save', isLogin, isAdmin, doubleCsrfProtection, adminController.postSaveSchedule);
router.post('/admin/schedules/delete/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postDeleteSchedule);

// CRUD Hari Libur / Tanggal Merah
router.get('/admin/holidays', isLogin, isAdmin, injectCsrfToken, adminController.showHolidays);
router.post('/admin/holidays/add', isLogin, isAdmin, doubleCsrfProtection, adminController.postAddHoliday);
router.post('/admin/holidays/edit/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postEditHoliday);
router.post('/admin/holidays/delete/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postDeleteHoliday);

// Kelola Opsi Absensi (EJS option management)
router.get('/admin/int-options', isLogin, isAdmin, injectCsrfToken, adminController.showIntegrationOptions);
router.post('/admin/options/add', isLogin, isAdmin, doubleCsrfProtection, adminController.postAddOption);
router.post('/admin/options/edit/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postEditOption);
router.post('/admin/options/delete/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postDeleteOption);

// Kelola Opsi Integrasi
router.post('/admin/int-options/add', isLogin, isAdmin, doubleCsrfProtection, adminController.postAddIntOption);
router.post('/admin/int-options/edit/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postEditIntOption);
router.post('/admin/int-options/delete/:id', isLogin, isAdmin, doubleCsrfProtection, adminController.postDeleteIntOption);

// Audit Log Superadmin
router.get('/admin/activity-history', isLogin, isSuperAdmin, adminController.showAuditLogs);

// Perubahan Status Absensi Manual
router.post('/admin/attendance/update-status', isLogin, isAdmin, doubleCsrfProtection, adminController.postUpdateStatus);

module.exports = router;
