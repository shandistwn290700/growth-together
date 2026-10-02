const { Op, QueryTypes } = require('sequelize');
const { AcademicYear, Classroom, Enrollment, Post, Student, User, sequelize } = require('../models');
const { POST_INCLUDES, serializePosts } = require('../services/postView');

const WEEKS = 12;
const ACTIVE_DAYS = 7;

async function activeYear() {
  return AcademicYear.findOne({ where: { isActive: true } });
}

class AdminController {
  // GET /admin/stats — angka dan grafik untuk dashboard admin.
  static async stats(req, res) {
    const year = await activeYear();
    const since = new Date(Date.now() - ACTIVE_DAYS * 86400_000);

    const [students, teachers, parents, activeUsers, posts, postsByWeek, perClass] = await Promise.all([
      Student.count({ where: { status: 'active' } }),
      User.count({ where: { role: 'teacher', isActive: true } }),
      // Orang tua siswa aktif: sudah aktif = sudah pernah login dan mengganti password awal.
      sequelize.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE NOT u."mustChangePassword")::int AS activated
         FROM "Users" u JOIN "Students" s ON s.id = u."studentId"
         WHERE u.role = 'parent' AND u."isActive" AND s.status = 'active'`,
        { type: QueryTypes.SELECT },
      ),
      User.count({ where: { isActive: true, lastLoginAt: { [Op.gte]: since } } }),
      Post.count(),
      // Jumlah postingan per minggu, 12 minggu terakhir (minggu tanpa postingan tetap muncul dengan 0).
      sequelize.query(
        `SELECT to_char(w.week, 'YYYY-MM-DD') AS week, COUNT(p.id)::int AS count
         FROM generate_series(date_trunc('week', now()) - interval '${WEEKS - 1} weeks', date_trunc('week', now()), interval '1 week') AS w(week)
         LEFT JOIN "Posts" p ON date_trunc('week', p."createdAt") = w.week
         GROUP BY w.week ORDER BY w.week`,
        { type: QueryTypes.SELECT },
      ),
      year
        ? Classroom.findAll({
            where: { academicYearId: year.id },
            attributes: [
              'id',
              'grade',
              'name',
              [
                sequelize.literal(
                  `(SELECT COUNT(*) FROM "Enrollments" e JOIN "Students" s ON s.id = e."studentId"
                    WHERE e."classroomId" = "Classroom"."id" AND s.status = 'active')::int`,
                ),
                'studentCount',
              ],
            ],
            order: [
              ['grade', 'ASC'],
              ['name', 'ASC'],
            ],
          })
        : [],
    ]);

    res.json({
      academicYear: year ? { id: year.id, name: year.name } : null,
      totals: {
        students,
        teachers,
        parents: parents[0].total,
        parentsActivated: parents[0].activated,
        activeUsers7d: activeUsers,
        posts,
      },
      postsByWeek,
      studentsPerClass: perClass.map((c) => ({ id: c.id, label: c.label, count: c.get('studentCount') })),
    });
  }

  // GET /admin/students?search=&classroomId=&parentStatus=pending|active&page=1&limit=20
  static async students(req, res) {
    const year = await activeYear();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 20));
    const search = String(req.query.search ?? '').trim();
    const classroomId = Number(req.query.classroomId) || null;

    const where = {};
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { nickname: { [Op.iLike]: `%${search}%` } },
        { nis: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const parentWhere = {};
    if (req.query.parentStatus === 'pending') parentWhere.mustChangePassword = true;
    if (req.query.parentStatus === 'active') parentWhere.mustChangePassword = false;

    const { rows, count } = await Student.findAndCountAll({
      where,
      include: [
        {
          model: Enrollment,
          where: { academicYearId: year?.id ?? 0, ...(classroomId ? { classroomId } : {}) },
          required: Boolean(classroomId),
          include: { model: Classroom, attributes: ['id', 'grade', 'name'] },
        },
        {
          model: User,
          as: 'parentAccount',
          attributes: ['id', 'username', 'isActive', 'mustChangePassword', 'lastLoginAt'],
          where: parentWhere,
          required: Object.keys(parentWhere).length > 0,
        },
      ],
      order: [['fullName', 'ASC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    res.json({
      total: count,
      page,
      limit,
      items: rows.map((s) => {
        const classroom = s.Enrollments?.[0]?.Classroom;
        return {
          id: s.id,
          nis: s.nis,
          fullName: s.fullName,
          nickname: s.nickname,
          status: s.status,
          classroom: classroom ? { id: classroom.id, label: classroom.label } : null,
          parent: s.parentAccount
            ? {
                id: s.parentAccount.id,
                username: s.parentAccount.username,
                isActive: s.parentAccount.isActive,
                mustChangePassword: s.parentAccount.mustChangePassword,
                lastLoginAt: s.parentAccount.lastLoginAt,
              }
            : null,
        };
      }),
    });
  }

  // GET /admin/posts?cursor=&classroomId=&search= — semua postingan untuk moderasi (terbaru dulu).
  static async posts(req, res) {
    const where = {};
    const cursor = Number(req.query.cursor);
    if (Number.isInteger(cursor) && cursor > 0) where.id = { [Op.lt]: cursor };
    const search = String(req.query.search ?? '').trim();
    if (search) where.caption = { [Op.iLike]: `%${search}%` };
    const classroomId = Number(req.query.classroomId);
    if (Number.isInteger(classroomId) && classroomId > 0) {
      where[Op.and] = [
        sequelize.literal(`"Post"."id" IN (SELECT "postId" FROM "PostStudents" WHERE "classroomId" = ${classroomId})`),
      ];
    }

    const PAGE = 20;
    const posts = await Post.findAll({ where, include: POST_INCLUDES, order: [['id', 'DESC']], limit: PAGE + 1 });
    const page = posts.slice(0, PAGE);
    const scope = { all: true, studentIds: new Set(), classroomIds: new Set() };
    res.json({
      items: await serializePosts(page, req.user, scope),
      nextCursor: posts.length > PAGE ? page.at(-1).id : null,
    });
  }
}

module.exports = AdminController;
