const { AcademicYear, Classroom, ClassroomTeacher, Enrollment, Student, User, sequelize } = require('../models');

const TEACHER_ATTRS = ['id', 'fullName', 'username'];
const teachersInclude = { model: User, as: 'teachers', attributes: TEACHER_ATTRS, through: { attributes: [] } };

const PROMOTION_ACTIONS = ['promote', 'retain', 'graduate', 'moved'];

// Admin boleh mengakses semua kelas; guru hanya kelas yang ia ampu.
async function findAccessibleClassroom(user, id) {
  const classroom = await Classroom.findByPk(id, { include: [AcademicYear, teachersInclude] });
  if (!classroom) throw { name: 'NotFound', message: 'Kelas tidak ditemukan' };
  if (user.role === 'teacher' && !classroom.teachers.some((t) => t.id === user.id)) {
    throw { name: 'Forbidden', message: 'Anda bukan wali kelas ini' };
  }
  return classroom;
}

async function assertTeacherIds(teacherIds) {
  if (!Array.isArray(teacherIds)) throw { name: 'BadRequest', message: 'Daftar wali kelas tidak valid' };
  const ids = [...new Set(teacherIds.map(Number))];
  const count = await User.count({ where: { id: ids, role: 'teacher' } });
  if (count !== ids.length) throw { name: 'BadRequest', message: 'Ada wali kelas yang tidak ditemukan' };
  return ids;
}

class ClassroomController {
  // GET /classrooms?academicYearId=  (default: tahun ajaran aktif)
  static async list(req, res) {
    let { academicYearId } = req.query;
    if (!academicYearId) {
      const active = await AcademicYear.findOne({ where: { isActive: true } });
      if (!active) return res.json([]);
      academicYearId = active.id;
    }

    const classrooms = await Classroom.findAll({
      where: { academicYearId },
      attributes: {
        include: [
          [
            sequelize.literal(
              '(SELECT COUNT(*) FROM "Enrollments" e WHERE e."classroomId" = "Classroom"."id")::int',
            ),
            'studentCount',
          ],
        ],
      },
      include: [AcademicYear, teachersInclude],
      order: [
        ['grade', 'ASC'],
        ['name', 'ASC'],
      ],
    });
    res.json(classrooms);
  }

  static async create(req, res) {
    const { academicYearId, grade, name, teacherIds = [] } = req.body ?? {};
    const ids = await assertTeacherIds(teacherIds);
    if (!(await AcademicYear.findByPk(academicYearId))) {
      throw { name: 'BadRequest', message: 'Tahun ajaran tidak ditemukan' };
    }

    const classroom = await sequelize.transaction(async (transaction) => {
      const created = await Classroom.create({ academicYearId, grade, name: name?.trim() }, { transaction });
      await ClassroomTeacher.bulkCreate(
        ids.map((teacherId) => ({ classroomId: created.id, teacherId })),
        { transaction },
      );
      return created;
    });
    res.status(201).json(await findAccessibleClassroom(req.user, classroom.id));
  }

  static async update(req, res) {
    const classroom = await findAccessibleClassroom(req.user, req.params.id);
    const { grade, name, teacherIds } = req.body ?? {};
    const ids = teacherIds === undefined ? null : await assertTeacherIds(teacherIds);

    await sequelize.transaction(async (transaction) => {
      await classroom.update(
        { grade: grade ?? classroom.grade, name: name?.trim() ?? classroom.name },
        { transaction },
      );
      if (ids) {
        await ClassroomTeacher.destroy({ where: { classroomId: classroom.id }, transaction });
        await ClassroomTeacher.bulkCreate(
          ids.map((teacherId) => ({ classroomId: classroom.id, teacherId })),
          { transaction },
        );
      }
    });
    res.json(await findAccessibleClassroom(req.user, classroom.id));
  }

  static async show(req, res) {
    const classroom = await findAccessibleClassroom(req.user, req.params.id);
    const enrollments = await Enrollment.findAll({
      where: { classroomId: classroom.id },
      include: {
        model: Student,
        include: { model: User, as: 'parentAccount', attributes: ['id', 'username', 'isActive', 'mustChangePassword'] },
      },
      order: [[Student, 'fullName', 'ASC']],
    });

    res.json({
      ...classroom.toJSON(),
      students: enrollments.map((e) => ({ ...e.Student.toJSON(), enrollmentStatus: e.status })),
    });
  }

  /**
   * POST /classrooms/:id/promotion
   * body: {
   *   targetAcademicYearId,
   *   decisions: [{ studentId, action: 'promote'|'retain'|'graduate'|'moved', targetClassroomId? }]
   * }
   */
  static async promote(req, res) {
    const classroom = await findAccessibleClassroom(req.user, req.params.id);
    const { targetAcademicYearId, decisions } = req.body ?? {};
    if (!Array.isArray(decisions) || decisions.length === 0) {
      throw { name: 'BadRequest', message: 'Belum ada siswa yang diproses' };
    }

    const needsTarget = decisions.some((d) => d.action === 'promote' || d.action === 'retain');
    let targetClassrooms = new Map();
    if (needsTarget) {
      const targetYear = await AcademicYear.findByPk(targetAcademicYearId);
      if (!targetYear) throw { name: 'BadRequest', message: 'Tahun ajaran tujuan tidak ditemukan' };
      if (targetYear.startDate <= classroom.AcademicYear.startDate) {
        throw { name: 'BadRequest', message: 'Tahun ajaran tujuan harus setelah tahun ajaran kelas ini' };
      }
      const classes = await Classroom.findAll({ where: { academicYearId: targetYear.id } });
      targetClassrooms = new Map(classes.map((c) => [c.id, c]));
    }

    const activeEnrollments = await Enrollment.findAll({
      where: { classroomId: classroom.id, status: 'active' },
      include: Student,
    });
    const enrollmentByStudent = new Map(activeEnrollments.map((e) => [e.studentId, e]));

    // Validasi semua keputusan dulu sebelum menyentuh database.
    const seen = new Set();
    const plans = decisions.map(({ studentId, action, targetClassroomId }) => {
      const enrollment = enrollmentByStudent.get(Number(studentId));
      if (!enrollment) {
        throw { name: 'BadRequest', message: `Siswa dengan ID ${studentId} tidak aktif di kelas ini` };
      }
      if (seen.has(enrollment.studentId)) {
        throw { name: 'BadRequest', message: `${enrollment.Student.fullName} diproses lebih dari sekali` };
      }
      seen.add(enrollment.studentId);
      const who = enrollment.Student.fullName;
      if (!PROMOTION_ACTIONS.includes(action)) {
        throw { name: 'BadRequest', message: `Pilihan untuk ${who} tidak valid` };
      }
      if (action === 'graduate' && classroom.grade !== 6) {
        throw { name: 'BadRequest', message: `${who} belum kelas 6, belum bisa diluluskan` };
      }
      if (action === 'promote' && classroom.grade === 6) {
        throw { name: 'BadRequest', message: `${who} sudah kelas 6, pilih "Lulus"` };
      }

      let target = null;
      if (action === 'promote' || action === 'retain') {
        target = targetClassrooms.get(Number(targetClassroomId));
        const expectedGrade = action === 'promote' ? classroom.grade + 1 : classroom.grade;
        if (!target || target.grade !== expectedGrade) {
          throw { name: 'BadRequest', message: `Kelas tujuan untuk ${who} harus kelas ${expectedGrade}` };
        }
      }
      return { enrollment, action, target };
    });

    const ENROLLMENT_STATUS = { promote: 'promoted', retain: 'retained', graduate: 'graduated', moved: 'moved' };
    const STUDENT_STATUS = { graduate: 'graduated', moved: 'inactive' };

    await sequelize.transaction(async (transaction) => {
      for (const { enrollment, action, target } of plans) {
        await enrollment.update({ status: ENROLLMENT_STATUS[action] }, { transaction });
        if (target) {
          await Enrollment.create(
            {
              studentId: enrollment.studentId,
              classroomId: target.id,
              academicYearId: target.academicYearId,
              status: 'active',
            },
            { transaction },
          );
        }
        if (STUDENT_STATUS[action]) {
          await enrollment.Student.update({ status: STUDENT_STATUS[action] }, { transaction });
        }
      }
    });

    const summary = Object.fromEntries(PROMOTION_ACTIONS.map((a) => [a, plans.filter((p) => p.action === a).length]));
    res.json({ message: 'Proses kenaikan kelas berhasil', summary });
  }
}

module.exports = ClassroomController;
