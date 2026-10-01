const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { AcademicYear, Classroom, ClassroomTeacher, Enrollment, Student, User, sequelize } = require('../models');
const { generateTempPassword } = require('../helpers/password');
const { parseDate, readRows, styleHeader } = require('../helpers/excel');

const STUDENT_COLUMNS = [
  { header: 'NIS *', key: 'nis', width: 14 },
  { header: 'Nama Lengkap *', key: 'fullName', width: 30 },
  { header: 'Nama Panggilan', key: 'nickname', width: 16 },
  { header: 'Jenis Kelamin (L/P) *', key: 'gender', width: 20 },
  { header: 'Tanggal Lahir (YYYY-MM-DD)', key: 'birthDate', width: 26 },
  { header: 'Tahun Masuk *', key: 'entryYear', width: 14 },
  { header: 'Tingkat Kelas (1-6) *', key: 'grade', width: 20 },
  { header: 'Nama Kelas *', key: 'className', width: 20 },
];

const TEACHER_COLUMNS = [
  { header: 'Nama Lengkap *', key: 'fullName', width: 30 },
  { header: 'Username *', key: 'username', width: 20 },
  { header: 'Wali Kelas: Tingkat (1-6)', key: 'grade', width: 24 },
  { header: 'Wali Kelas: Nama Kelas', key: 'className', width: 24 },
];

const MAX_ROWS = 2000;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,30}$/;
const classKey = (grade, name) => `${grade}|${name.trim().toLowerCase()}`;

class ImportController {
  static async template(req, res) {
    const workbook = new ExcelJS.Workbook();

    const guide = workbook.addWorksheet('Petunjuk');
    guide.getColumn(1).width = 100;
    [
      'TEMPLATE IMPORT AKUN GROWTH TOGETHER',
      '',
      '1. Isi sheet "Siswa" dan/atau "Guru". Kolom bertanda * wajib diisi. Jangan ubah baris judul.',
      '2. Setiap siswa otomatis dibuatkan akun orang tua dengan username = NIS.',
      '3. Kelas dibuat otomatis di tahun ajaran aktif jika belum ada (contoh: Tingkat 1, Nama Kelas "Abu Bakar").',
      '4. Tanggal lahir boleh format 2018-07-15 atau 15/07/2018.',
      '5. Jika ada satu baris yang salah, tidak ada data yang disimpan. Perbaiki lalu upload ulang.',
      '6. Setelah import berhasil, unduh daftar password awal dan bagikan ke masing-masing pengguna.',
      '',
      'Contoh baris Siswa: 2026001 | Ahmad Fauzan | Fauzan | L | 2019-03-21 | 2026 | 1 | Abu Bakar',
      'Contoh baris Guru:  Siti Aminah, S.Pd. | siti.aminah | 1 | Abu Bakar',
    ].forEach((line) => guide.addRow([line]));
    guide.getRow(1).font = { bold: true, size: 14 };

    const students = workbook.addWorksheet('Siswa');
    students.columns = STUDENT_COLUMNS;
    styleHeader(students);
    students.dataValidations.add('D2:D2000', { type: 'list', allowBlank: true, formulae: ['"L,P"'] });
    students.dataValidations.add('G2:G2000', {
      type: 'whole',
      operator: 'between',
      allowBlank: true,
      formulae: [1, 6],
      showErrorMessage: true,
      error: 'Tingkat kelas SD antara 1 sampai 6',
    });

    const teachers = workbook.addWorksheet('Guru');
    teachers.columns = TEACHER_COLUMNS;
    styleHeader(teachers);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-growth-together.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  static async import(req, res) {
    if (!req.file) throw { name: 'BadRequest', message: 'File Excel belum dipilih' };

    const activeYear = await AcademicYear.findOne({ where: { isActive: true } });
    if (!activeYear) throw { name: 'BadRequest', message: 'Aktifkan tahun ajaran terlebih dahulu' };

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      throw { name: 'BadRequest', message: 'File tidak bisa dibaca. Pastikan formatnya .xlsx' };
    }
    const studentSheet = workbook.getWorksheet('Siswa');
    const teacherSheet = workbook.getWorksheet('Guru');
    if (!studentSheet && !teacherSheet) {
      throw { name: 'BadRequest', message: 'Sheet "Siswa" atau "Guru" tidak ditemukan. Gunakan template resmi' };
    }

    const studentRows = studentSheet ? readRows(studentSheet, STUDENT_COLUMNS.map((c) => c.key)) : [];
    const teacherRows = teacherSheet ? readRows(teacherSheet, TEACHER_COLUMNS.map((c) => c.key)) : [];
    if (studentRows.length + teacherRows.length === 0) throw { name: 'BadRequest', message: 'File tidak berisi data' };
    if (studentRows.length + teacherRows.length > MAX_ROWS) {
      throw { name: 'BadRequest', message: `Maksimal ${MAX_ROWS} baris per sekali import` };
    }

    // ---------- 1. Validasi seluruh baris ----------
    const errors = [];
    const addError = (sheet, row, message) => errors.push({ sheet, row, message });
    const usernamesInFile = new Map(); // username -> "Sheet baris N"
    const claimUsername = (sheet, row, username) => {
      const key = username.toLowerCase();
      if (usernamesInFile.has(key)) {
        addError(sheet, row, `Username "${username}" sama dengan ${usernamesInFile.get(key)}`);
      } else {
        usernamesInFile.set(key, `${sheet} baris ${row}`);
      }
    };
    const currentYear = new Date().getFullYear();

    for (const r of studentRows) {
      const grade = Number(r.grade);
      const entryYear = Number(r.entryYear);
      r.gender = r.gender.toUpperCase();
      if (!r.nis) addError('Siswa', r.rowNumber, 'NIS wajib diisi');
      else if (!USERNAME_PATTERN.test(r.nis)) addError('Siswa', r.rowNumber, 'NIS hanya boleh berisi huruf/angka (3-30 karakter)');
      else claimUsername('Siswa', r.rowNumber, r.nis);
      if (!r.fullName) addError('Siswa', r.rowNumber, 'Nama lengkap wajib diisi');
      if (!['L', 'P'].includes(r.gender)) addError('Siswa', r.rowNumber, 'Jenis kelamin harus L atau P');
      if (r.birthDate) {
        r.birthDate = parseDate(r.birthDate);
        if (!r.birthDate) addError('Siswa', r.rowNumber, 'Format tanggal lahir tidak dikenali');
      }
      if (!Number.isInteger(entryYear) || entryYear < 2000 || entryYear > currentYear + 1) {
        addError('Siswa', r.rowNumber, 'Tahun masuk tidak valid');
      }
      if (!Number.isInteger(grade) || grade < 1 || grade > 6) addError('Siswa', r.rowNumber, 'Tingkat kelas harus 1 sampai 6');
      if (!r.className) addError('Siswa', r.rowNumber, 'Nama kelas wajib diisi');
      r.grade = grade;
      r.entryYear = entryYear;
    }

    for (const r of teacherRows) {
      if (!r.fullName) addError('Guru', r.rowNumber, 'Nama lengkap wajib diisi');
      if (!USERNAME_PATTERN.test(r.username)) {
        addError('Guru', r.rowNumber, 'Username 3-30 karakter, hanya huruf, angka, titik, strip, garis bawah');
      } else {
        claimUsername('Guru', r.rowNumber, r.username);
      }
      if (r.grade || r.className) {
        const grade = Number(r.grade);
        if (!Number.isInteger(grade) || grade < 1 || grade > 6 || !r.className) {
          addError('Guru', r.rowNumber, 'Untuk wali kelas, isi tingkat (1-6) dan nama kelas sekaligus');
        }
        r.grade = grade;
      }
    }

    // Cek bentrok dengan data yang sudah ada di database.
    const nisList = studentRows.map((r) => r.nis).filter(Boolean);
    const existingStudents = await Student.findAll({ where: { nis: nisList }, attributes: ['nis'] });
    const existingNis = new Set(existingStudents.map((s) => s.nis));
    studentRows
      .filter((r) => existingNis.has(r.nis))
      .forEach((r) => addError('Siswa', r.rowNumber, `NIS ${r.nis} sudah terdaftar`));

    const existingUsers = await User.findAll({
      where: { username: { [Op.in]: [...usernamesInFile.keys()] } },
      attributes: ['username'],
    });
    const takenUsernames = new Set(existingUsers.map((u) => u.username.toLowerCase()));
    teacherRows
      .filter((r) => takenUsernames.has(r.username.toLowerCase()))
      .forEach((r) => addError('Guru', r.rowNumber, `Username "${r.username}" sudah dipakai`));
    studentRows
      .filter((r) => !existingNis.has(r.nis) && takenUsernames.has(r.nis.toLowerCase()))
      .forEach((r) => addError('Siswa', r.rowNumber, `NIS ${r.nis} bentrok dengan username yang sudah ada`));

    if (errors.length) {
      errors.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.row - b.row);
      return res.status(400).json({ message: `Ditemukan ${errors.length} kesalahan. Tidak ada data yang disimpan.`, errors });
    }

    // ---------- 2. Simpan semua dalam satu transaksi ----------
    const credentials = [];
    const summary = await sequelize.transaction(async (transaction) => {
      const classrooms = new Map(
        (await Classroom.findAll({ where: { academicYearId: activeYear.id }, transaction })).map((c) => [
          classKey(c.grade, c.name),
          c,
        ]),
      );
      let createdClassrooms = 0;
      const getClassroom = async (grade, name) => {
        const key = classKey(grade, name);
        if (!classrooms.has(key)) {
          classrooms.set(key, await Classroom.create({ academicYearId: activeYear.id, grade, name: name.trim() }, { transaction }));
          createdClassrooms++;
        }
        return classrooms.get(key);
      };

      for (const r of teacherRows) {
        const password = generateTempPassword();
        const teacher = await User.create(
          { username: r.username, password, role: 'teacher', fullName: r.fullName, mustChangePassword: true },
          { transaction },
        );
        let classLabel = '';
        if (r.className) {
          const classroom = await getClassroom(r.grade, r.className);
          await ClassroomTeacher.findOrCreate({
            where: { classroomId: classroom.id, teacherId: teacher.id },
            transaction,
          });
          classLabel = classroom.label;
        }
        credentials.push({ role: 'Guru', name: r.fullName, classLabel, username: teacher.username, password });
      }

      for (const r of studentRows) {
        const classroom = await getClassroom(r.grade, r.className);
        const student = await Student.create(
          {
            nis: r.nis,
            fullName: r.fullName,
            nickname: r.nickname || null,
            gender: r.gender,
            birthDate: r.birthDate || null,
            entryYear: r.entryYear,
          },
          { transaction },
        );
        await Enrollment.create(
          { studentId: student.id, classroomId: classroom.id, academicYearId: activeYear.id, status: 'active' },
          { transaction },
        );
        const password = generateTempPassword();
        const parent = await User.create(
          { username: r.nis, password, role: 'parent', studentId: student.id, mustChangePassword: true },
          { transaction },
        );
        credentials.push({
          role: 'Orang Tua',
          name: r.fullName,
          classLabel: classroom.label,
          username: parent.username,
          password,
        });
      }

      return { teachers: teacherRows.length, students: studentRows.length, classrooms: createdClassrooms };
    });

    // ---------- 3. Buat file daftar password awal ----------
    const output = new ExcelJS.Workbook();
    const sheet = output.addWorksheet('Akun');
    sheet.columns = [
      { header: 'Peran', key: 'role', width: 12 },
      { header: 'Nama', key: 'name', width: 32 },
      { header: 'Kelas', key: 'classLabel', width: 24 },
      { header: 'Username', key: 'username', width: 18 },
      { header: 'Password Awal', key: 'password', width: 18 },
    ];
    styleHeader(sheet);
    sheet.addRows(credentials);
    const buffer = await output.xlsx.writeBuffer();

    res.status(201).json({
      message: 'Import berhasil',
      summary,
      credentialsFile: Buffer.from(buffer).toString('base64'),
    });
  }
}

module.exports = ImportController;
