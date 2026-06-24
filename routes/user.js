const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLogin, isEmployee } = require('../middlewares/authMiddleware');
const { doubleCsrfProtection } = require('../middlewares/securityMiddleware');

router.get('/dashboard', isLogin, userController.showDashboard);
router.get('/api/user/attendance-stats', isLogin, isEmployee, userController.getAttendanceStatsApi);
router.get('/attendance/checkin', isLogin, isEmployee, (req, res) => userController.showCheckin(req, res));
router.post('/attendance/checkin', isLogin, isEmployee, doubleCsrfProtection, (req, res) => userController.postCheckin(req, res));
router.get('/attendance/checkout', isLogin, isEmployee, (req, res) => userController.showCheckout(req, res));
router.post('/attendance/checkout', isLogin, isEmployee, doubleCsrfProtection, (req, res) => userController.postCheckout(req, res));
router.get('/history', isLogin, userController.showHistory);
router.get('/history/export', isLogin, userController.exportCsv);

module.exports = router;
