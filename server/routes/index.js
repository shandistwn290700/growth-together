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
const PostController = require('../controllers/postController');
const CommentController = require('../controllers/commentController');
const ReactionController = require('../controllers/reactionController');
const StudentController = require('../controllers/studentController');
const ChatController = require('../controllers/chatController');
const SettingsController = require('../controllers/settingsController');

const router = express.Router();

// ID di URL harus angka, selain itu langsung 404 (bukan error database).
router.param('id', (req, res, next, id) => {
  if (/^\d{1,9}$/.test(id)) return next();
  next({ name: 'NotFound', message: 'Data tidak ditemukan' });
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});

const passwordCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
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
router.get('/settings/appearance', SettingsController.getAppearance); // tema juga dipakai di halaman login

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

// Feed & postingan. Hak akses per postingan dicek di services/access.js.
router.post('/uploads/signature', PostController.uploadSignature);
router.get('/posts', PostController.feed);
router.post('/posts', PostController.create);
router.get('/posts/:id', PostController.show);
router.patch('/posts/:id', PostController.update);
router.delete('/posts/:id', PostController.destroy);
router.get('/posts/:id/comments', CommentController.list);
router.post('/posts/:id/comments', CommentController.create);
router.delete('/comments/:id', CommentController.destroy);
router.put('/posts/:id/reaction', ReactionController.upsert);
router.delete('/posts/:id/reaction', ReactionController.remove);
router.get('/posts/:id/reactions', ReactionController.list);

// Profil & timeline siswa.
router.put('/auth/avatar', AuthController.updateAvatar);
router.get('/students/:id', StudentController.show);
router.get('/students/:id/posts', StudentController.timeline);
router.get('/students/:id/media', StudentController.gallery);
router.put('/students/:id/photo', StudentController.updatePhoto);

// Chat terenkripsi end-to-end (guru ↔ orang tua). Server hanya menyimpan teks terenkripsi.
router.post('/auth/verify-password', passwordCheckLimiter, AuthController.verifyPassword);
router.get('/chat/keys/me', ChatController.myKey);
router.post('/chat/keys', ChatController.createKey);
router.get('/chat/keys', ChatController.publicKeys);
router.get('/chat/contacts', ChatController.contacts);
router.get('/chat/unread', ChatController.unreadCount);
router.get('/conversations', ChatController.listConversations);
router.post('/conversations', ChatController.openConversation);
router.get('/conversations/:id/messages', ChatController.messages);
router.post('/conversations/:id/messages', ChatController.send);
router.post('/conversations/:id/read', ChatController.markRead);

router.put('/admin/settings/appearance', authorize('admin'), SettingsController.updateAppearance);
router.get('/admin/teachers', authorize('admin'), UserController.listTeachers);
router.post('/admin/users/:id/reset-password', authorize('admin'), UserController.resetPassword);
router.patch('/admin/users/:id/status', authorize('admin'), UserController.setActive);
router.get('/admin/import/template', authorize('admin'), ImportController.template);
router.post('/admin/import', authorize('admin'), excelUpload.single('file'), ImportController.import);

module.exports = router;
