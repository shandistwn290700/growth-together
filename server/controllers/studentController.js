const { Op, QueryTypes } = require('sequelize');
const { AcademicYear, Classroom, Enrollment, Post, PostMedia, Student, sequelize } = require('../models');
const { getViewerScope, canViewStudent, timelinePostIdsSql, parentCanPost } = require('../services/access');
const { POST_INCLUDES, isStaff, serializePosts } = require('../services/postView');
const { deliveryUrls, photoUrl, validateUploadedMedia, deleteFromCloudinary } = require('../helpers/media');

const PAGE_SIZE = 10;
const GALLERY_PAGE_SIZE = 24;

async function loadContext(req) {
  const studentId = Number(req.params.id);
  const scope = await getViewerScope(req.user);
  const student = await Student.findByPk(studentId);
  // Siswa yang tidak boleh dilihat dianggap tidak ada.
  if (!student || !(await canViewStudent(req.user, studentId, scope))) {
    throw { name: 'NotFound', message: 'Siswa tidak ditemukan' };
  }
  return { student, scope };
}

function cursorFilter(cursor) {
  const value = Number(cursor);
  return Number.isInteger(value) && value > 0 ? { id: { [Op.lt]: value } } : {};
}

const canEditPhoto = (user, student) => user.role === 'admin' || (user.role === 'parent' && user.studentId === student.id);

class StudentController {
  // GET /students/:id — profil + riwayat kelas + jumlah postingan per kelas.
  static async show(req, res) {
    const { student, scope } = await loadContext(req);

    const enrollments = await Enrollment.findAll({
      where: { studentId: student.id },
      include: { model: Classroom, include: AcademicYear },
      order: [[Classroom, AcademicYear, 'startDate', 'ASC']],
    });

    const counts = await sequelize.query(
      `SELECT ps."classroomId", COUNT(DISTINCT ps."postId")::int AS count
       FROM "PostStudents" ps
       WHERE ps."studentId" = ${student.id} AND ps."postId" IN (${timelinePostIdsSql(req.user, scope, student.id)})
       GROUP BY ps."classroomId"`,
      { type: QueryTypes.SELECT },
    );
    const countByClass = Object.fromEntries(counts.map((c) => [c.classroomId, c.count]));
    const isOwnParent = req.user.role === 'parent';

    res.json({
      student: {
        id: student.id,
        fullName: student.fullName,
        nickname: student.nickname,
        gender: student.gender,
        nis: student.nis,
        birthDate: student.birthDate,
        entryYear: student.entryYear,
        status: student.status,
        photoUrl: photoUrl(student.photoPublicId),
      },
      history: enrollments.map((e) => ({
        classroomId: e.classroomId,
        label: e.Classroom.label,
        grade: e.Classroom.grade,
        academicYear: e.Classroom.AcademicYear.name,
        isCurrentYear: e.Classroom.AcademicYear.isActive,
        status: e.status,
        postCount: countByClass[e.classroomId] ?? 0,
      })),
      canEditPhoto: canEditPhoto(req.user, student),
      canPost: isOwnParent ? parentCanPost(student) : isStaff(req.user),
    });
  }

  // GET /students/:id/posts?classroomId=&cursor= — timeline siswa, terbaru di atas.
  static async timeline(req, res) {
    const { student, scope } = await loadContext(req);
    const sql = timelinePostIdsSql(req.user, scope, student.id, req.query.classroomId);

    const posts = await Post.findAll({
      where: { [Op.and]: [{ id: { [Op.in]: sequelize.literal(`(${sql})`) } }, cursorFilter(req.query.cursor)] },
      include: POST_INCLUDES,
      order: [['id', 'DESC']],
      limit: PAGE_SIZE + 1,
    });
    const page = posts.slice(0, PAGE_SIZE);
    const items = await serializePosts(page, req.user, scope);

    res.json({
      // Kelas siswa ini saat postingan dibuat, untuk judul pemisah per kelas di timeline.
      items: items.map((item, i) => ({
        ...item,
        timelineClassroomId: page[i].PostStudents.find((t) => t.studentId === student.id)?.classroomId ?? null,
      })),
      nextCursor: posts.length > PAGE_SIZE ? page.at(-1).id : null,
    });
  }

  // GET /students/:id/media?classroomId=&cursor= — galeri foto/video (portofolio).
  static async gallery(req, res) {
    const { student, scope } = await loadContext(req);
    const sql = timelinePostIdsSql(req.user, scope, student.id, req.query.classroomId);

    const media = await PostMedia.findAll({
      where: { [Op.and]: [{ postId: { [Op.in]: sequelize.literal(`(${sql})`) } }, cursorFilter(req.query.cursor)] },
      include: { model: Post, attributes: ['id', 'createdAt', 'caption'] },
      order: [['id', 'DESC']],
      limit: GALLERY_PAGE_SIZE + 1,
    });
    const page = media.slice(0, GALLERY_PAGE_SIZE);

    res.json({
      items: page.map((m) => ({
        id: m.id,
        type: m.type,
        postId: m.postId,
        createdAt: m.Post.createdAt,
        caption: m.Post.caption,
        width: m.width,
        height: m.height,
        ...deliveryUrls(m),
      })),
      nextCursor: media.length > GALLERY_PAGE_SIZE ? page.at(-1).id : null,
    });
  }

  // PUT /students/:id/photo  body: { publicId, version, signature } — orang tua (anaknya) atau admin.
  static async updatePhoto(req, res) {
    const { student } = await loadContext(req);
    if (!canEditPhoto(req.user, student)) throw { name: 'Forbidden', message: 'Anda tidak bisa mengubah foto siswa ini' };

    const [photo] = validateUploadedMedia(req.user.id, [{ ...req.body, resourceType: 'image' }], 'avatar');
    const oldPublicId = student.photoPublicId;
    await student.update({ photoPublicId: photo.publicId });
    if (oldPublicId) {
      deleteFromCloudinary([{ type: 'image', publicId: oldPublicId }]).catch((err) =>
        console.error('Gagal menghapus foto lama:', err.error?.message ?? err.message),
      );
    }
    res.json({ photoUrl: photoUrl(student.photoPublicId) });
  }
}

module.exports = StudentController;
