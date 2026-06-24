const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const { isLogin, isEmployee } = require('../middlewares/authMiddleware');

router.get('/api/integration/users', apiController.listUsers);
router.get('/api/integration/session', apiController.getSession);
router.post('/api/integration/login', apiController.postLogin);
router.post('/api/integration/logout', apiController.postLogout);
router.post('/api/integration/attendance', isLogin, isEmployee, apiController.postAttendance);
router.get('/api/integration/options', apiController.listOptions);

module.exports = router;
