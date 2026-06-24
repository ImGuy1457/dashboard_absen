const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { doubleCsrfProtection } = require('../middlewares/securityMiddleware');

router.get('/login', authController.showLogin);
router.post('/login', doubleCsrfProtection, authController.postLogin);
router.get('/logout', authController.logout);

module.exports = router;
