const express = require('express');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit');

const authentication = require('../middlewares/authentication');
const { authorize, requirePasswordChanged } = require('../middlewares/authorization');
const AuthController = require('../controllers/authController');
const AcademicYearController = require('../controllers/academicYearController');
const ClassroomController = require('../controllers/classroomController');
const ImportController = require('../controllers/importController');
const UserController = require('../controllers/userController');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.xlsx')) return cb(null, true);
    cb({ name: 'BadRequest', message: 'File harus berformat .xlsx' });
  },
});

// ---------- Publik ----------
router.post('/auth/login', loginLimiter, AuthController.login);

// ---------- Wajib login ----------
router.use(authentication);
router.get('/auth/me', AuthController.me);
router.patch('/auth/password', AuthController.changePassword);

// Semua endpoint di bawah ini butuh password yang sudah diganti dari password awal.
router.use(requirePasswordChanged);

router.get('/academic-years', authorize('admin', 'teacher'), AcademicYearController.list);
router.post('/academic-years', authorize('admin'), AcademicYearController.create);
router.patch('/academic-years/:id/activate', authorize('admin'), AcademicYearController.activate);

router.get('/classrooms', authorize('admin', 'teacher'), ClassroomController.list);
router.post('/classrooms', authorize('admin'), ClassroomController.create);
router.get('/classrooms/:id', authorize('admin', 'teacher'), ClassroomController.show);
router.put('/classrooms/:id', authorize('admin'), ClassroomController.update);
router.post('/classrooms/:id/promotion', authorize('admin', 'teacher'), ClassroomController.promote);

router.get('/admin/teachers', authorize('admin'), UserController.listTeachers);
router.post('/admin/users/:id/reset-password', authorize('admin'), UserController.resetPassword);
router.patch('/admin/users/:id/status', authorize('admin'), UserController.setActive);
router.get('/admin/import/template', authorize('admin'), ImportController.template);
router.post('/admin/import', authorize('admin'), excelUpload.single('file'), ImportController.import);

module.exports = router;
