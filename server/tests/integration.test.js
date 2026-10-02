// Tes integrasi end-to-end: npm test
// Menjalankan PostgreSQL sementara (embedded-postgres), migrasi naik/turun, lalu menguji seluruh API,
// aturan privasi, dan chat terenkripsi lewat HTTP dan Socket.IO. Database aslimu tidak tersentuh.
const path = require('path');
const { execFileSync } = require('child_process');
const EmbeddedPostgres = require('embedded-postgres').default;

const SERVER = path.join(__dirname, '..');
const PORT = 54329;
Object.assign(process.env, {
  NODE_ENV: 'development',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'password',
  DB_HOST: '127.0.0.1',
  DB_PORT: String(PORT),
  DB_NAME: 'gt_test',
  JWT_SECRET: 'integration-test-secret',
  SEED_ADMIN_USERNAME: 'Admin',
  SEED_ADMIN_PASSWORD: 'adminpass123',
  CLOUDINARY_CLOUD_NAME: 'testcloud',
  CLOUDINARY_API_KEY: '1234567890',
  CLOUDINARY_API_SECRET: 'test-secret',
  CLOUDINARY_FOLDER: 'growth-together',
});
const { v2: cld } = require('cloudinary');
// Meniru respons upload Cloudinary yang sah untuk user tertentu.
let mediaSeq = 0;
const fakeMedia = (userId, overrides = {}) => {
  const publicId = overrides.publicId ?? `growth-together/posts/u${userId}/file${++mediaSeq}`;
  const version = 1700000000 + mediaSeq;
  return {
    publicId,
    version,
    signature: cld.utils.api_sign_request({ public_id: publicId, version }, 'test-secret', null, 1),
    resourceType: 'image',
    width: 800,
    height: 600,
    ...overrides,
  };
};

const ExcelJS = require('exceljs');
let failures = 0;
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && extra ? `  -> ${extra}` : ''}`);
  if (!cond) failures++;
};
const cli = (...args) =>
  execFileSync(process.execPath, [path.join(SERVER, 'node_modules/sequelize-cli/lib/sequelize'), ...args], {
    cwd: SERVER,
    env: process.env,
    stdio: 'pipe',
  }).toString();

(async () => {
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(require('os').tmpdir(), `gt-test-pg-${process.pid}`),
    user: 'postgres',
    password: 'password',
    port: PORT,
    persistent: false,
    // UTF8 agar emoji di postingan/komentar tersimpan, sama seperti database produksi.
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('gt_test');

  let server;
  try {
    // Migrasi naik-turun-naik untuk memastikan "down" juga benar.
    cli('db:migrate');
    cli('db:migrate:undo:all');
    cli('db:migrate');
    cli('db:seed:all');
    cli('db:seed:all'); // seeder admin harus aman dijalankan ulang
    console.log('PASS  migrasi up/down/up + seeder (2x)');

    const app = require(path.join(SERVER, 'app'));
    server = require('http').createServer(app);
    require(path.join(SERVER, 'socket')).initSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (method, url, { token, json, form } = {}) => {
      const headers = {};
      if (token) headers.authorization = `Bearer ${token}`;
      let body;
      if (json) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(json);
      } else if (form) body = form;
      const res = await fetch(base + url, { method, headers, body });
      const type = res.headers.get('content-type') || '';
      const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
      return { status: res.status, data };
    };

    // ---------- Admin login & ganti password ----------
    let r = await call('POST', '/auth/login', { json: { username: 'admin', password: 'salah' } });
    check('login password salah -> 401', r.status === 401);
    r = await call('POST', '/auth/login', { json: { username: 'ADMIN', password: 'adminpass123' } });
    check('login admin (huruf besar) -> 200', r.status === 200, JSON.stringify(r.data));
    check('admin wajib ganti password', r.data.user.mustChangePassword === true);
    let admin = r.data.access_token;
    r = await call('GET', '/academic-years', { token: admin });
    check('endpoint diblokir sebelum ganti password -> 403', r.status === 403);
    await new Promise((res) => setTimeout(res, 1100)); // agar iat token lama < passwordChangedAt
    r = await call('PATCH', '/auth/password', { token: admin, json: { currentPassword: 'adminpass123', newPassword: 'adminbaru123' } });
    check('ganti password admin', r.status === 200, JSON.stringify(r.data));
    const oldAdmin = admin;
    admin = r.data.access_token;
    r = await call('GET', '/auth/me', { token: oldAdmin });
    check('token lama ditolak setelah ganti password -> 401', r.status === 401, JSON.stringify(r.data));

    // ---------- Tahun ajaran ----------
    r = await call('POST', '/admin/import', { token: admin, form: new FormData() });
    check('import tanpa tahun ajaran aktif / file -> 400', r.status === 400);
    r = await call('POST', '/academic-years', { token: admin, json: { name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30' } });
    const y1 = r.data;
    r = await call('POST', '/academic-years', { token: admin, json: { name: '2027/2028', startDate: '2027-07-01', endDate: '2028-06-30' } });
    const y2 = r.data;
    r = await call('POST', '/academic-years', { token: admin, json: { name: '2027-2028', startDate: '2027-07-01', endDate: '2028-06-30' } });
    check('format nama tahun ajaran salah -> 400', r.status === 400 && /Format/.test(r.data.message), JSON.stringify(r.data));
    r = await call('PATCH', `/academic-years/${y1.id}/activate`, { token: admin });
    check('aktifkan 2026/2027', r.status === 200 && r.data.isActive);

    // ---------- Import Excel ----------
    r = await call('GET', '/admin/import/template', { token: admin });
    check('unduh template', r.status === 200 && Buffer.isBuffer(r.data));
    const makeFile = async (students, teachers) => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(r.data);
      students.forEach((row) => wb.getWorksheet('Siswa').addRow(row));
      teachers.forEach((row) => wb.getWorksheet('Guru').addRow(row));
      const form = new FormData();
      form.append('file', new Blob([await wb.xlsx.writeBuffer()]), 'data.xlsx');
      return form;
    };
    const templateBuf = r.data;

    // File berisi kesalahan
    r = { data: templateBuf };
    let res = await call('POST', '/admin/import', {
      token: admin,
      form: await makeFile(
        [
          ['S001', 'Budi', '', 'X', '31/02/2019', 2026, 7, 'Abu Bakar'],
          ['S001', 'Duplikat', '', 'L', '', 2026, 1, 'Abu Bakar'],
        ],
        [['Guru Tanpa Username', '', '', '']],
      ),
    });
    check('import file salah -> 400 + daftar error', res.status === 400 && res.data.errors?.length >= 4, JSON.stringify(res.data));
    console.log('      contoh error:', res.data.errors?.slice(0, 4).map((e) => `${e.sheet}:${e.row} ${e.message}`).join(' | '));

    // File benar
    res = await call('POST', '/admin/import', {
      token: admin,
      form: await makeFile(
        [
          ['S001', 'Ahmad Fauzan', 'Fauzan', 'l', new Date(Date.UTC(2019, 2, 21)), 2026, 1, 'Abu Bakar'],
          ['S002', 'Aisyah Putri', '', 'P', '05/09/2019', 2026, 1, 'abu bakar'],
          ['S003', 'Umar Faruq', '', 'L', '', 2021, 6, 'Umar'],
        ],
        [
          ['Siti Aminah, S.Pd.', 'Siti.Aminah', 1, 'Abu Bakar'],
          ['Hasan Basri, S.Pd.', 'hasan', 6, 'Umar'],
        ],
      ),
    });
    check('import file benar -> 201', res.status === 201, JSON.stringify(res.data).slice(0, 300));
    check(
      'ringkasan: 3 siswa, 2 guru, 2 kelas (nama kelas tidak peka huruf)',
      res.data.summary?.students === 3 && res.data.summary?.teachers === 2 && res.data.summary?.classrooms === 2,
      JSON.stringify(res.data.summary),
    );
    const credWb = new ExcelJS.Workbook();
    await credWb.xlsx.load(Buffer.from(res.data.credentialsFile, 'base64'));
    const creds = {};
    credWb.getWorksheet('Akun').eachRow((row, n) => {
      if (n > 1) creds[row.getCell(4).text] = row.getCell(5).text;
    });
    check('file kredensial berisi 5 akun', Object.keys(creds).length === 5, JSON.stringify(Object.keys(creds)));

    res = await call('POST', '/admin/import', {
      token: admin,
      form: await makeFile([['S001', 'Ahmad Lagi', '', 'L', '', 2026, 1, 'Abu Bakar']], [['X', 'SITI.AMINAH', '', '']]),
    });
    check('import ulang NIS & username yang sudah ada -> 400', res.status === 400 && res.data.errors.length === 2, JSON.stringify(res.data));

    // ---------- Guru ----------
    const loginAndChange = async (username) => {
      const l = await call('POST', '/auth/login', { json: { username, password: creds[username.toLowerCase()] } });
      await new Promise((res2) => setTimeout(res2, 1100));
      const c = await call('PATCH', '/auth/password', {
        token: l.data.access_token,
        json: { currentPassword: creds[username.toLowerCase()], newPassword: 'passwordbaru1' },
      });
      return { login: l, token: c.data.access_token, user: c.data.user };
    };
    const siti = await loginAndChange('siti.aminah');
    check('guru login dengan password dari file', siti.login.status === 200 && !!siti.token);
    const hasan = await loginAndChange('hasan');

    r = await call('GET', '/classrooms', { token: siti.token });
    const class1 = r.data.find((c) => c.grade === 1);
    const class6 = r.data.find((c) => c.grade === 6);
    check('daftar kelas: 2 kelas, kelas 1 berisi 2 siswa', r.data.length === 2 && class1.studentCount === 2, JSON.stringify(r.data));
    r = await call('GET', `/classrooms/${class1.id}`, { token: siti.token });
    check('detail kelas sendiri', r.status === 200 && r.data.students.length === 2);
    check('akun ortu tercantum di detail kelas', r.data.students.every((s) => s.parentAccount?.username));
    r = await call('GET', `/classrooms/${class6.id}`, { token: siti.token });
    check('detail kelas guru lain -> 403', r.status === 403);
    r = await call('POST', '/classrooms', { token: siti.token, json: { academicYearId: y2.id, grade: 2, name: 'X' } });
    check('guru tidak bisa membuat kelas -> 403', r.status === 403);

    // ---------- Kelas tahun depan ----------
    const teacherIds = (await call('GET', '/admin/teachers', { token: admin })).data.map((t) => t.id);
    r = await call('POST', '/classrooms', { token: admin, json: { academicYearId: y2.id, grade: 2, name: 'Abu Bakar', teacherIds } });
    const next2 = r.data;
    check('admin membuat kelas 2 Abu Bakar 2027/2028', r.status === 201 && next2.teachers.length === 2, JSON.stringify(r.data));
    r = await call('POST', '/classrooms', { token: admin, json: { academicYearId: y2.id, grade: 1, name: 'Abu Bakar' } });
    const next1 = r.data;
    r = await call('POST', '/classrooms', { token: admin, json: { academicYearId: y2.id, grade: 7, name: 'Salah' } });
    check('tingkat 7 ditolak -> 400', r.status === 400, JSON.stringify(r.data));
    r = await call('POST', '/classrooms', { token: admin, json: { academicYearId: y2.id, grade: 2, name: 'Abu Bakar' } });
    check('kelas duplikat ditolak -> 400 dengan pesan jelas', r.status === 400 && /sudah ada/.test(r.data.message), JSON.stringify(r.data));

    // ---------- Naik kelas ----------
    const detail1 = (await call('GET', `/classrooms/${class1.id}`, { token: siti.token })).data;
    const [ahmad, aisyah] = ['Ahmad Fauzan', 'Aisyah Putri'].map((n) => detail1.students.find((s) => s.fullName === n));
    r = await call('POST', `/classrooms/${class1.id}/promotion`, {
      token: siti.token,
      json: { targetAcademicYearId: y2.id, decisions: [{ studentId: ahmad.id, action: 'promote', targetClassroomId: next1.id }] },
    });
    check('naik ke kelas dengan tingkat salah -> 400', r.status === 400, JSON.stringify(r.data));
    r = await call('POST', `/classrooms/${class1.id}/promotion`, {
      token: siti.token,
      json: { targetAcademicYearId: y2.id, decisions: [{ studentId: ahmad.id, action: 'graduate' }] },
    });
    check('kelas 1 tidak bisa lulus -> 400', r.status === 400, JSON.stringify(r.data));
    r = await call('POST', `/classrooms/${class1.id}/promotion`, {
      token: siti.token,
      json: {
        targetAcademicYearId: y2.id,
        decisions: [
          { studentId: ahmad.id, action: 'promote', targetClassroomId: next2.id },
          { studentId: aisyah.id, action: 'retain', targetClassroomId: next1.id },
        ],
      },
    });
    check('proses naik/tinggal kelas', r.status === 200 && r.data.summary.promote === 1 && r.data.summary.retain === 1, JSON.stringify(r.data));
    r = await call('POST', `/classrooms/${class1.id}/promotion`, {
      token: siti.token,
      json: { targetAcademicYearId: y2.id, decisions: [{ studentId: ahmad.id, action: 'promote', targetClassroomId: next2.id }] },
    });
    check('proses ulang siswa yang sama -> 400', r.status === 400, JSON.stringify(r.data));

    const detail6 = (await call('GET', `/classrooms/${class6.id}`, { token: hasan.token })).data;
    r = await call('POST', `/classrooms/${class6.id}/promotion`, {
      token: siti.token,
      json: { decisions: [{ studentId: detail6.students[0].id, action: 'graduate' }] },
    });
    check('guru lain tidak bisa memproses kelas 6 -> 403', r.status === 403);
    r = await call('POST', `/classrooms/${class6.id}/promotion`, {
      token: hasan.token,
      json: { decisions: [{ studentId: detail6.students[0].id, action: 'graduate' }] },
    });
    check('kelas 6 lulus', r.status === 200 && r.data.summary.graduate === 1, JSON.stringify(r.data));

    r = await call('GET', `/classrooms/${class1.id}`, { token: admin });
    check(
      'riwayat kelas lama tetap ada dengan status baru',
      r.data.students.map((s) => s.enrollmentStatus).sort().join() === 'promoted,retained',
      JSON.stringify(r.data.students.map((s) => s.enrollmentStatus)),
    );
    r = await call('GET', `/classrooms/${next2.id}`, { token: admin });
    check('Ahmad aktif di Kelas 2 Abu Bakar 2027/2028', r.data.students.length === 1 && r.data.students[0].fullName === 'Ahmad Fauzan');
    r = await call('GET', `/classrooms?academicYearId=${y2.id}`, { token: admin });
    check('jumlah siswa per kelas tahun depan', r.data.map((c) => `${c.grade}:${c.studentCount}`).join() === '1:1,2:1', JSON.stringify(r.data.map((c) => [c.grade, c.studentCount])));

    // ---------- Orang tua ----------
    const ortu = await loginAndChange('S003');
    check('ortu login pakai NIS huruf besar', ortu.login.status === 200);
    check('nama tampilan ortu = nama anak', ortu.user.displayName === 'Umar Faruq', ortu.user.displayName);
    check('status anak lulus', ortu.user.student.status === 'graduated', ortu.user.student.status);
    r = await call('GET', '/classrooms', { token: ortu.token });
    check('ortu tidak bisa melihat daftar kelas -> 403', r.status === 403);
    check('respons tidak membocorkan hash password', !JSON.stringify(ortu.user).includes('$2'));

    // ================= TAHAP 3: POSTINGAN =================
    console.log('\n--- Tahap 3 ---');
    const ahmadOrtu = await loginAndChange('S001');
    const aisyahOrtu = await loginAndChange('S002');
    const umarOrtu = ortu;
    const sitiId = siti.user.id;

    r = await call('POST', '/uploads/signature', { token: siti.token, json: { resourceType: 'image' } });
    check(
      'tanda tangan upload untuk guru',
      r.status === 200 && r.data.params.signature && r.data.params.folder === `growth-together/posts/u${sitiId}` &&
        r.data.uploadUrl === 'https://api.cloudinary.com/v1_1/testcloud/image/upload',
      JSON.stringify(r.data),
    );
    r = await call('POST', '/uploads/signature', { token: siti.token, json: { resourceType: 'video' } });
    check('tanda tangan video berisi eager transform', r.data.params?.eager === 'c_limit,w_720,q_auto/mp4');
    r = await call('POST', '/uploads/signature', { token: siti.token, json: { resourceType: 'pdf' } });
    check('jenis file pdf ditolak -> 400', r.status === 400);
    r = await call('POST', '/uploads/signature', { token: umarOrtu.token, json: { resourceType: 'image' } });
    check('ortu siswa lulus tidak bisa upload -> 403', r.status === 403);

    // Postingan orang tua
    r = await call('POST', '/posts', { token: ahmadOrtu.token, json: { caption: 'Ahmad belajar wudhu', media: [fakeMedia(ahmadOrtu.user.id)] } });
    const pParent = r.data;
    check('ortu membuat postingan', r.status === 201, JSON.stringify(r.data));
    check('postingan ortu otomatis menandai anaknya', pParent.students?.map((s) => s.fullName).join() === 'Ahmad Fauzan');
    check('kelas postingan = Kelas 1 Abu Bakar', pParent.classroom?.label === 'Kelas 1 Abu Bakar', JSON.stringify(pParent.classroom));
    check('URL media bertanda tangan (s--...--)', /\/image\/authenticated\/s--[\w-]+--\//.test(pParent.media?.[0]?.url), pParent.media?.[0]?.url);

    r = await call('POST', '/posts', { token: ahmadOrtu.token, json: { caption: 'x', media: [{ ...fakeMedia(ahmadOrtu.user.id), signature: 'palsu' }] } });
    check('media dengan tanda tangan palsu ditolak', r.status === 400);
    r = await call('POST', '/posts', { token: ahmadOrtu.token, json: { caption: 'x', media: [fakeMedia(ahmadOrtu.user.id, { publicId: `growth-together/posts/u${sitiId}/curian` })] } });
    check('media milik user lain ditolak', r.status === 400);
    r = await call('POST', '/posts', { token: ahmadOrtu.token, json: { media: Array.from({ length: 11 }, () => fakeMedia(ahmadOrtu.user.id)) } });
    check('11 media ditolak (maks 10)', r.status === 400 && /10/.test(r.data.message), JSON.stringify(r.data));
    r = await call('POST', '/posts', { token: ahmadOrtu.token, json: { caption: '   ' } });
    check('postingan kosong ditolak', r.status === 400);
    r = await call('POST', '/posts', { token: umarOrtu.token, json: { caption: 'Halo' } });
    check('ortu siswa lulus tidak bisa memposting -> 403', r.status === 403);

    // Postingan guru
    r = await call('POST', '/posts', {
      token: siti.token,
      json: { caption: 'Kegiatan manasik haji kelas 1', classroomId: class1.id, studentIds: [ahmad.id, aisyah.id], media: [fakeMedia(sitiId), fakeMedia(sitiId, { resourceType: 'video', duration: 12.5 })] },
    });
    const pTeacher = r.data;
    check('guru memposting dengan tag 2 siswa', r.status === 201 && pTeacher.students.length === 2 && pTeacher.totalTagged === 2, JSON.stringify(r.data));
    check('video punya url, originalUrl, posterUrl', ['url', 'originalUrl', 'posterUrl'].every((k) => pTeacher.media?.[1]?.[k]), JSON.stringify(pTeacher.media?.[1]));
    const umarId = detail6.students[0].id;
    r = await call('POST', '/posts', { token: siti.token, json: { caption: 'x', classroomId: class1.id, studentIds: [umarId] } });
    check('guru tidak bisa menandai siswa lulus/di kelas lain', r.status === 400 || r.status === 403, `${r.status}`);
    r = await call('POST', '/posts', { token: hasan.token, json: { caption: 'x', classroomId: class1.id, studentIds: [ahmad.id] } });
    check('guru tidak bisa memposting ke kelas yang bukan miliknya -> 403', r.status === 403, `${r.status} ${JSON.stringify(r.data)}`);
    r = await call('POST', '/posts', { token: siti.token, json: { caption: 'x', classroomId: class1.id, studentIds: [] } });
    check('guru wajib menandai minimal 1 siswa', r.status === 400);

    // Postingan admin
    r = await call('POST', '/posts', { token: admin, json: { caption: 'Pengumuman untuk Aisyah', studentIds: [aisyah.id] } });
    const pAdmin = r.data;
    check('admin memposting', r.status === 201, JSON.stringify(r.data));

    // ---- Feed: siapa melihat apa ----
    const feedOf = async (token) => (await call('GET', '/posts', { token })).data.items ?? [];
    const ids = (items) => items.map((p) => p.id).sort((a, b) => a - b).join();
    let feed = await feedOf(ahmadOrtu.token);
    check('feed ortu Ahmad: postingannya + postingan guru', ids(feed) === [pParent.id, pTeacher.id].join(), ids(feed));
    const teacherPostForAhmad = feed.find((p) => p.id === pTeacher.id);
    check('ortu Ahmad hanya melihat nama Ahmad di tag', teacherPostForAhmad?.students.map((s) => s.fullName).join() === 'Ahmad Fauzan', JSON.stringify(teacherPostForAhmad?.students));
    check('ortu tidak diberi jumlah total tag', teacherPostForAhmad?.totalTagged === undefined);
    feed = await feedOf(aisyahOrtu.token);
    check('feed ortu Aisyah: postingan guru + admin (bukan milik ortu Ahmad)', ids(feed) === [pTeacher.id, pAdmin.id].join(), ids(feed));
    feed = await feedOf(siti.token);
    check('feed wali kelas: ketiga postingan kelasnya', ids(feed) === [pParent.id, pTeacher.id, pAdmin.id].join(), ids(feed));
    feed = await feedOf(admin);
    check('feed admin: semua postingan', feed.length === 3);
    feed = await feedOf(umarOrtu.token);
    check('feed ortu Umar kosong', feed.length === 0);
    feed = await feedOf(hasan.token);
    const hasanTeacherPost = feed.find((p) => p.id === pTeacher.id);
    check(
      'wali kelas tahun depan (Hasan) hanya melihat Ahmad, bukan Aisyah',
      !feed.some((p) => p.id === pAdmin.id) && hasanTeacherPost?.students.map((s) => s.fullName).join() === 'Ahmad Fauzan',
      `${ids(feed)} ${JSON.stringify(hasanTeacherPost?.students)}`,
    );
    r = await call('GET', `/posts/${pAdmin.id}`, { token: ahmadOrtu.token });
    check('ortu membuka postingan yang bukan haknya -> 404', r.status === 404);
    r = await call('GET', '/posts/abc', { token: ahmadOrtu.token });
    check('ID bukan angka -> 404', r.status === 404);

    // ---- Komentar per siswa ----
    r = await call('POST', `/posts/${pTeacher.id}/comments`, { token: siti.token, json: { content: 'Ahmad hebat!' } });
    check('guru wajib memilih siswa pada postingan multi-tag', r.status === 400);
    r = await call('POST', `/posts/${pTeacher.id}/comments`, { token: siti.token, json: { content: 'Ahmad hebat!', studentId: ahmad.id } });
    const cAhmad = r.data;
    check('guru berkomentar di utas Ahmad', r.status === 201 && cAhmad.author.displayName === 'Siti Aminah, S.Pd.');
    await call('POST', `/posts/${pTeacher.id}/comments`, { token: siti.token, json: { content: 'Aisyah rapi sekali', studentId: aisyah.id } });
    r = await call('POST', `/posts/${pTeacher.id}/comments`, { token: ahmadOrtu.token, json: { content: 'Terima kasih, Bu', parentId: cAhmad.id } });
    check('ortu membalas komentar (utas otomatis)', r.status === 201 && r.data.parentId === cAhmad.id && r.data.author.displayName === 'Ahmad Fauzan', JSON.stringify(r.data));
    r = await call('POST', `/posts/${pTeacher.id}/comments`, { token: ahmadOrtu.token, json: { content: 'iseng', studentId: aisyah.id } });
    check('ortu tidak bisa menulis di utas anak lain', r.status === 400);
    r = await call('GET', `/posts/${pTeacher.id}/comments`, { token: ahmadOrtu.token });
    check(
      'ortu Ahmad hanya melihat utas Ahmad (1 komentar + 1 balasan)',
      r.data.threads.length === 1 && r.data.threads[0].student.fullName === 'Ahmad Fauzan' && r.data.threads[0].comments[0].replies.length === 1,
      JSON.stringify(r.data),
    );
    r = await call('GET', `/posts/${pTeacher.id}/comments`, { token: aisyahOrtu.token });
    check('ortu Aisyah hanya melihat utas Aisyah', r.data.threads.length === 1 && r.data.threads[0].comments[0].content === 'Aisyah rapi sekali', JSON.stringify(r.data));
    r = await call('GET', `/posts/${pTeacher.id}/comments`, { token: siti.token });
    check('guru melihat semua utas', r.data.threads.length === 2);
    feed = await feedOf(ahmadOrtu.token);
    check('jumlah komentar untuk ortu Ahmad = 2 (bukan 3)', feed.find((p) => p.id === pTeacher.id)?.commentCount === 2);

    // ---- Reaksi ----
    r = await call('PUT', `/posts/${pTeacher.id}/reaction`, { token: ahmadOrtu.token, json: { type: 'love' } });
    check('ortu memberi reaksi love', r.status === 200 && r.data.mine === 'love' && r.data.total === 1, JSON.stringify(r.data));
    r = await call('PUT', `/posts/${pTeacher.id}/reaction`, { token: aisyahOrtu.token, json: { type: 'like' } });
    r = await call('PUT', `/posts/${pTeacher.id}/reaction`, { token: ahmadOrtu.token, json: { type: 'care' } });
    check('ganti jenis reaksi (tetap 2 total)', r.data.total === 2 && r.data.mine === 'care' && r.data.counts.love === undefined, JSON.stringify(r.data));
    r = await call('PUT', `/posts/${pTeacher.id}/reaction`, { token: ahmadOrtu.token, json: { type: 'marah' } });
    check('jenis reaksi tidak valid -> 400', r.status === 400);
    r = await call('GET', `/posts/${pTeacher.id}/reactions`, { token: siti.token });
    check('guru melihat siapa saja yang bereaksi (2)', r.status === 200 && r.data.length === 2);
    r = await call('GET', `/posts/${pTeacher.id}/reactions`, { token: hasan.token });
    check('wali kelas lain hanya melihat reaksi ortu Ahmad', r.data.length === 1 && r.data[0].user.displayName === 'Ahmad Fauzan', JSON.stringify(r.data));
    r = await call('GET', `/posts/${pTeacher.id}/reactions`, { token: ahmadOrtu.token });
    check('ortu tidak bisa melihat daftar nama yang bereaksi -> 403', r.status === 403);
    r = await call('DELETE', `/posts/${pTeacher.id}/reaction`, { token: aisyahOrtu.token });
    check('hapus reaksi', r.data.total === 1 && r.data.mine === null);

    // ---- Edit & hapus ----
    r = await call('PATCH', `/posts/${pTeacher.id}`, { token: ahmadOrtu.token, json: { caption: 'diubah' } });
    check('ortu tidak bisa mengedit postingan guru', r.status === 403);
    r = await call('PATCH', `/posts/${pTeacher.id}`, { token: siti.token, json: { caption: 'Manasik haji (diperbarui)' } });
    check('guru mengedit caption', r.status === 200 && r.data.caption === 'Manasik haji (diperbarui)');
    r = await call('DELETE', `/posts/${pTeacher.id}`, { token: aisyahOrtu.token });
    check('ortu tidak bisa menghapus postingan guru', r.status === 403);
    r = await call('DELETE', `/posts/${pParent.id}`, { token: admin });
    check('admin menghapus postingan ortu (moderasi)', r.status === 200);
    feed = await feedOf(ahmadOrtu.token);
    check('postingan terhapus hilang dari feed', !feed.some((p) => p.id === pParent.id));

    // ---- Paginasi ----
    for (let i = 1; i <= 12; i++) {
      await call('POST', '/posts', { token: siti.token, json: { caption: `Post ${i}`, classroomId: class1.id, studentIds: [ahmad.id] } });
    }
    const page1 = (await call('GET', '/posts', { token: ahmadOrtu.token })).data;
    const page2 = (await call('GET', `/posts?cursor=${page1.nextCursor}`, { token: ahmadOrtu.token })).data;
    check(
      'paginasi: 10 + 3, urut terbaru, tanpa duplikat',
      page1.items.length === 10 && page2.items.length === 3 && page2.nextCursor === null &&
        page1.items[0].caption === 'Post 12' && new Set([...page1.items, ...page2.items].map((p) => p.id)).size === 13,
      `${page1.items.length}+${page2.items?.length} next=${page2.nextCursor}`,
    );

    // ================= TAHAP 4: PROFIL & TIMELINE =================
    console.log('\n--- Tahap 4 ---');
    // Pindah ke tahun ajaran berikutnya, lalu Hasan memposting di Kelas 2 Abu Bakar.
    await call('PATCH', `/academic-years/${y2.id}/activate`, { token: admin });
    r = await call('POST', '/posts', {
      token: hasan.token,
      json: { caption: 'Ahmad di kelas 2', classroomId: next2.id, studentIds: [ahmad.id], media: [fakeMedia(hasan.user.id)] },
    });
    check('posting di kelas tahun ajaran baru', r.status === 201, JSON.stringify(r.data));

    r = await call('GET', `/students/${ahmad.id}`, { token: ahmadOrtu.token });
    check(
      'profil Ahmad: riwayat 2 kelas berurutan',
      r.status === 200 && r.data.history.map((h) => `${h.label}|${h.academicYear}|${h.status}`).join(' > ') ===
        'Kelas 1 Abu Bakar|2026/2027|promoted > Kelas 2 Abu Bakar|2027/2028|active',
      JSON.stringify(r.data.history),
    );
    check('jumlah postingan per kelas: 13 dan 1', r.data.history.map((h) => h.postCount).join() === '13,1', JSON.stringify(r.data.history?.map((h) => h.postCount)));
    check('ortu boleh mengubah foto anaknya dan memposting', r.data.canEditPhoto === true && r.data.canPost === true);

    r = await call('GET', `/students/${ahmad.id}/posts?classroomId=${next2.id}`, { token: ahmadOrtu.token });
    check('timeline difilter per kelas (kelas 2: 1 postingan)', r.data.items?.length === 1 && r.data.items[0].timelineClassroomId === next2.id, JSON.stringify(r.data).slice(0, 200));
    r = await call('GET', `/students/${ahmad.id}/posts`, { token: ahmadOrtu.token });
    check('timeline semua kelas: halaman 1 berisi 10, terbaru dulu', r.data.items.length === 10 && r.data.items[0].caption === 'Ahmad di kelas 2' && r.data.nextCursor);
    check('timelineClassroomId berganti antar kelas', r.data.items[1].timelineClassroomId === class1.id);

    r = await call('GET', `/students/${aisyah.id}`, { token: ahmadOrtu.token });
    check('ortu tidak bisa membuka profil anak lain -> 404', r.status === 404);
    r = await call('GET', `/students/${aisyah.id}/posts`, { token: ahmadOrtu.token });
    check('ortu tidak bisa membuka timeline anak lain -> 404', r.status === 404);
    r = await call('GET', `/students/${ahmad.id}`, { token: hasan.token });
    check('wali kelas sekarang melihat seluruh riwayat Ahmad', r.status === 200 && r.data.history.map((h) => h.postCount).join() === '13,1', JSON.stringify(r.data.history));
    check('guru tidak bisa mengubah foto siswa', r.data.canEditPhoto === false);
    r = await call('GET', `/students/${aisyah.id}`, { token: hasan.token });
    check('guru tidak bisa membuka profil siswa yang tidak pernah di kelasnya -> 404', r.status === 404);
    r = await call('GET', `/students/${aisyah.id}`, { token: siti.token });
    check('wali kelas lama bisa membuka profil Aisyah', r.status === 200);
    r = await call('GET', `/students/${umarId}`, { token: siti.token });
    check('guru lain tidak bisa membuka profil Umar -> 404', r.status === 404);
    r = await call('GET', `/students/${umarId}`, { token: umarOrtu.token });
    check('ortu siswa lulus: profil arsip, tidak bisa memposting', r.status === 200 && r.data.canPost === false && r.data.history[0].status === 'graduated');

    r = await call('GET', `/students/${ahmad.id}/media`, { token: ahmadOrtu.token });
    check(
      'galeri Ahmad: 3 media (2 dari manasik + 1 kelas 2) dengan thumbnail',
      r.data.items?.length === 3 && r.data.items.every((m) => m.thumbUrl) && r.data.items.some((m) => m.type === 'video'),
      JSON.stringify(r.data.items?.map((m) => m.type)),
    );
    r = await call('GET', `/students/${aisyah.id}/media`, { token: aisyahOrtu.token });
    check('galeri Aisyah: 2 media dari postingan bersama', r.data.items?.length === 2, `${r.data.items?.length}`);

    // ---- Foto profil ----
    r = await call('POST', '/uploads/signature', { token: umarOrtu.token, json: { resourceType: 'image', purpose: 'avatar' } });
    check('ortu siswa lulus tetap bisa mengganti foto profil', r.status === 200 && r.data.params.folder === `growth-together/avatars/u${umarOrtu.user.id}`);
    r = await call('POST', '/uploads/signature', { token: ahmadOrtu.token, json: { resourceType: 'video', purpose: 'avatar' } });
    check('foto profil tidak boleh video -> 400', r.status === 400);
    const avatar = (u) => fakeMedia(u.id, { publicId: `growth-together/avatars/u${u.id}/foto${++mediaSeq}` });
    r = await call('PUT', `/students/${ahmad.id}/photo`, { token: ahmadOrtu.token, json: fakeMedia(ahmadOrtu.user.id) });
    check('file dari folder postingan ditolak untuk foto profil', r.status === 400);
    r = await call('PUT', `/students/${ahmad.id}/photo`, { token: ahmadOrtu.token, json: avatar(ahmadOrtu.user) });
    check('ortu mengganti foto Ahmad (dipotong fokus wajah)', r.status === 200 && /c_fill/.test(r.data.photoUrl) && /g_face/.test(r.data.photoUrl), JSON.stringify(r.data));
    r = await call('GET', '/auth/me', { token: ahmadOrtu.token });
    check('avatar akun ortu = foto anak', !!r.data.avatarUrl);
    r = await call('PUT', `/students/${aisyah.id}/photo`, { token: ahmadOrtu.token, json: avatar(ahmadOrtu.user) });
    check('ortu tidak bisa mengganti foto anak lain -> 404', r.status === 404);
    r = await call('PUT', `/students/${ahmad.id}/photo`, { token: hasan.token, json: avatar(hasan.user) });
    check('guru tidak bisa mengganti foto siswa -> 403', r.status === 403);
    r = await call('PUT', '/auth/avatar', { token: hasan.token, json: avatar(hasan.user) });
    check('guru mengganti foto profilnya', r.status === 200 && !!r.data.avatarUrl);
    r = await call('PUT', '/auth/avatar', { token: ahmadOrtu.token, json: avatar(ahmadOrtu.user) });
    check('ortu tidak memakai /auth/avatar -> 400', r.status === 400);
    feed = await feedOf(ahmadOrtu.token);
    check('avatar guru tampil di postingan', !!feed.find((p) => p.author.id === hasan.user.id)?.author.avatarUrl);

    // ================= TEMA WARNA =================
    console.log('\n--- Tema ---');
    r = await call('GET', '/settings/appearance');
    check('tema bisa dibaca tanpa login (untuk halaman login), default toska', r.data.theme === 'toska', JSON.stringify(r.data));
    r = await call('PUT', '/admin/settings/appearance', { token: siti.token, json: { theme: 'biru' } });
    check('guru tidak bisa mengganti tema -> 403', r.status === 403);
    r = await call('PUT', '/admin/settings/appearance', { token: admin, json: { theme: 'kuning-neon' } });
    check('tema di luar daftar ditolak -> 400', r.status === 400);
    r = await call('PUT', '/admin/settings/appearance', { token: admin, json: { theme: 'biru' } });
    check('admin mengganti tema', r.status === 200 && r.data.theme === 'biru', JSON.stringify(r.data));
    r = await call('PUT', '/admin/settings/appearance', { token: admin, json: { theme: 'ungu' } });
    r = await call('GET', '/settings/appearance');
    check('tema terbaru berlaku untuk semua (tersimpan di server)', r.data.theme === 'ungu', JSON.stringify(r.data));

    // ================= PANEL ADMIN =================
    console.log('\n--- Panel admin ---');
    r = await call('GET', '/admin/stats', { token: siti.token });
    check('statistik admin tertutup untuk guru -> 403', r.status === 403);
    r = await call('GET', '/admin/stats', { token: admin });
    check(
      'statistik dashboard: angka total',
      r.status === 200 && r.data.totals.students === 2 && r.data.totals.teachers === 2 && r.data.totals.posts > 0,
      JSON.stringify(r.data.totals),
    );
    check('orang tua aktif: 2 dari 2 siswa aktif sudah login', r.data.totals.parents === 2 && r.data.totals.parentsActivated === 2, JSON.stringify(r.data.totals));
    check('pengguna aktif 7 hari terakhir tercatat dari login', r.data.totals.activeUsers7d >= 4, JSON.stringify(r.data.totals));
    check(
      'grafik postingan: 12 minggu, minggu ini berisi postingan',
      r.data.postsByWeek.length === 12 && r.data.postsByWeek.at(-1).count > 0,
      JSON.stringify(r.data.postsByWeek.slice(-2)),
    );
    check('siswa per kelas di tahun ajaran aktif', r.data.studentsPerClass.length === 2, JSON.stringify(r.data.studentsPerClass));

    r = await call('GET', '/admin/students?search=fauz', { token: admin });
    check('cari siswa (tidak peka huruf besar/kecil)', r.data.total === 1 && r.data.items[0].fullName === 'Ahmad Fauzan', JSON.stringify(r.data));
    check('data siswa berisi kelas dan akun orang tua', r.data.items[0].classroom?.label === 'Kelas 2 Abu Bakar' && r.data.items[0].parent?.username === 's001', JSON.stringify(r.data.items[0]));
    r = await call('GET', `/admin/students?classroomId=${next1.id}`, { token: admin });
    check('filter siswa per kelas', r.data.total === 1 && r.data.items[0].fullName === 'Aisyah Putri', JSON.stringify(r.data.items));
    r = await call('GET', '/admin/students?limit=5&page=1', { token: admin });
    check('daftar siswa berhalaman (total semua siswa)', r.data.total === 3 && r.data.items.length === 3, `${r.data.total}`);
    r = await call('GET', '/admin/teachers', { token: admin });
    check('daftar guru berisi kelas yang diampu & login terakhir', r.data.some((t) => t.classrooms.length > 0 && t.lastLoginAt), JSON.stringify(r.data));

    r = await call('GET', '/admin/posts?search=manasik', { token: admin });
    check('moderasi: cari postingan berdasarkan caption', r.status === 200 && r.data.items.length === 1, `${r.data.items?.length}`);
    r = await call('GET', `/admin/posts?classroomId=${next2.id}`, { token: admin });
    check('moderasi: filter postingan per kelas', r.data.items.length === 1 && r.data.items[0].caption === 'Ahmad di kelas 2', JSON.stringify(r.data.items.map((p) => p.caption)));
    r = await call('GET', '/admin/posts', { token: hasan.token });
    check('moderasi tertutup untuk guru -> 403', r.status === 403);

    // ---- Laporan ZIP ----
    console.log('\n--- Laporan ---');
    const thisMonth = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7); // bulan ini (WIB)
    r = await call('GET', `/admin/reports/preview?type=month&month=${thisMonth}`, { token: siti.token });
    check('laporan tertutup untuk guru -> 403', r.status === 403);
    r = await call('GET', '/admin/reports/preview?type=month&month=2026-13', { token: admin });
    check('bulan tidak valid -> 400', r.status === 400);
    r = await call('GET', `/admin/reports/preview?type=month&month=${thisMonth}`, { token: admin });
    check(
      'pratinjau bulanan: postingan, foto (1 per postingan bersama), video',
      r.status === 200 && r.data.totals.posts >= 14 && r.data.totals.photos === 2 && r.data.totals.videos === 1,
      JSON.stringify(r.data),
    );
    check('pratinjau memakai kelas tahun ajaran yang mencakup bulan itu', r.data.academicYear === '2026/2027' && r.data.classes === 2, JSON.stringify(r.data));
    const monthPosts = r.data.totals.posts;
    r = await call('GET', `/admin/reports/preview?type=semester&academicYearId=${y1.id}&half=ganjil`, { token: admin });
    check('semester ganjil 2026/2027 berisi postingan bulan ini', r.data.totals.posts === monthPosts && /Ganjil 2026\/2027/.test(r.data.label), JSON.stringify(r.data));
    r = await call('GET', `/admin/reports/preview?type=semester&academicYearId=${y1.id}&half=genap`, { token: admin });
    check('semester genap (Jan–Jun) masih kosong', r.data.totals.posts === 0);

    r = await call('PUT', '/admin/settings/appearance', { token: admin, json: { schoolName: 'SDIT Bahtera Nuh' } });
    check('admin mengisi nama sekolah, tema tidak berubah', r.data.schoolName === 'SDIT Bahtera Nuh' && r.data.theme === 'ungu', JSON.stringify(r.data));

    r = await call('GET', `/admin/reports/download?type=month&month=${thisMonth}`, { token: admin });
    const zip = r.data;
    check('unduh ZIP laporan', r.status === 200 && Buffer.isBuffer(zip) && zip.subarray(0, 2).toString() === 'PK', `${r.status}`);
    const zipText = zip.toString('latin1');
    check(
      'ZIP berisi Ringkasan.pdf, Rekap-aktivitas.xlsx, BACA-SAYA.txt',
      ['Ringkasan.pdf', 'Rekap-aktivitas.xlsx', 'BACA-SAYA.txt'].every((name) => zipText.includes(name)),
    );
    // Cloudinary palsu di tes: foto gagal diunduh dan dicatat, bukan membuat laporan gagal.
    check('foto yang gagal diunduh dicatat di foto-gagal-diunduh.txt', zipText.includes('foto-gagal-diunduh.txt'));

    const { buildReport } = require(path.join(SERVER, 'services/reportData'));
    const { parsePeriod } = require(path.join(SERVER, 'services/reportPeriod'));
    const { buildReportPdf } = require(path.join(SERVER, 'helpers/reportPdf'));
    const { buildReportExcel } = require(path.join(SERVER, 'helpers/reportExcel'));
    const report = await buildReport(await parsePeriod({ type: 'month', month: thisMonth }));
    check(
      'lokasi foto: postingan bersama -> _Kegiatan kelas, satu siswa -> folder siswa',
      report.photos.some((p) => p.path.startsWith('Foto/Kelas 1 Abu Bakar/_Kegiatan kelas/')) &&
        report.photos.some((p) => p.path.startsWith('Foto/Kelas 2 Abu Bakar/Ahmad Fauzan/')),
      JSON.stringify(report.photos.map((p) => p.path)),
    );
    const umarRow = report.classRows.find((c) => c.label === 'Kelas 6 Umar');
    check('siswa tanpa momen terdeteksi (Umar)', umarRow?.withoutMoments.includes('Umar Faruq'), JSON.stringify(umarRow));
    const pdf = await buildReportPdf(report, { schoolName: 'SDIT Bahtera Nuh', color: '#6d28d9' });
    check('PDF ringkasan valid', pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 2000, `${pdf.length} byte`);
    const xlsxBook = new ExcelJS.Workbook();
    await xlsxBook.xlsx.load(await buildReportExcel(report, 'SDIT Bahtera Nuh'));
    check(
      'Excel rekap berisi 5 sheet',
      xlsxBook.worksheets.map((w) => w.name).join() === 'Ringkasan,Per kelas,Per siswa,Postingan,Video',
      xlsxBook.worksheets.map((w) => w.name).join(),
    );
    check('sheet Per siswa berisi semua siswa tahun ajaran', xlsxBook.getWorksheet('Per siswa').rowCount === 1 + report.studentRows.length);

    // ---------- Pengumuman admin (kelas tertentu / seluruh sekolah) ----------
    // Tahun ajaran aktif 2027/2028: Ahmad di Kelas 2 Abu Bakar (guru Siti & Hasan), Aisyah di Kelas 1 Abu Bakar.
    console.log('\n--- Pengumuman ---');
    const adminId = (await call('GET', '/auth/me', { token: admin })).data.id;
    r = await call('POST', '/posts', { token: siti.token, json: { caption: 'Info', audience: 'school' } });
    check('guru tidak bisa membuat pengumuman sekolah -> 403', r.status === 403, JSON.stringify(r.data));
    r = await call('POST', '/posts', { token: ahmadOrtu.token, json: { caption: 'Info', audience: 'classes', classroomIds: [next2.id] } });
    check('ortu tidak bisa membuat pengumuman kelas -> 403', r.status === 403);
    r = await call('POST', '/posts', { token: admin, json: { caption: 'Info', audience: 'semua' } });
    check('sasaran tidak dikenal -> 400', r.status === 400);
    r = await call('POST', '/posts', { token: admin, json: { caption: 'Info', audience: 'classes', classroomIds: [] } });
    check('pengumuman kelas tanpa kelas -> 400', r.status === 400 && /minimal satu kelas/.test(r.data.message), JSON.stringify(r.data));
    r = await call('POST', '/posts', { token: admin, json: { caption: 'Info', audience: 'classes', classroomIds: [class1.id] } });
    check('kelas dari tahun ajaran lain -> 400', r.status === 400, JSON.stringify(r.data));

    r = await call('POST', '/posts', { token: admin, json: { caption: 'Pengumuman kelas 1: bawa buku iqra', audience: 'classes', classroomIds: [next1.id] } });
    const annClass = r.data;
    check(
      'admin mengumumkan ke Kelas 1 Abu Bakar',
      r.status === 201 && annClass.audience?.type === 'classes' && annClass.audience.classes.map((c) => c.label).join() === 'Kelas 1 Abu Bakar' && annClass.students.length === 0,
      JSON.stringify(r.data),
    );
    r = await call('POST', '/posts', {
      token: admin,
      json: { caption: 'Libur awal Ramadhan 3 hari', audience: 'school', media: [fakeMedia(adminId)] },
    });
    const annSchool = r.data;
    check(
      'admin mengumumkan ke seluruh sekolah (semua siswa aktif ditandai)',
      r.status === 201 && annSchool.audience?.type === 'school' && annSchool.totalTagged === 2 && annSchool.audience.classes.length === 2,
      JSON.stringify(r.data),
    );

    const feedCaptions = async (token) => (await call('GET', '/posts', { token })).data.items.map((p) => p.caption);
    let captions = await feedCaptions(aisyahOrtu.token);
    check('ortu Aisyah melihat pengumuman kelasnya & sekolah', captions.includes(annClass.caption) && captions.includes(annSchool.caption), JSON.stringify(captions));
    captions = await feedCaptions(ahmadOrtu.token);
    check('ortu Ahmad tidak melihat pengumuman kelas lain, tapi melihat pengumuman sekolah', !captions.includes(annClass.caption) && captions.includes(annSchool.caption), JSON.stringify(captions));
    r = await call('GET', `/posts/${annSchool.id}`, { token: ahmadOrtu.token });
    check(
      'ortu hanya melihat kelas anaknya di sasaran & tanpa daftar siswa',
      r.data.audience.classes.map((c) => c.label).join() === 'Kelas 2 Abu Bakar' && r.data.students.length === 0 && r.data.totalTagged === undefined,
      JSON.stringify(r.data.audience),
    );
    captions = await feedCaptions(siti.token);
    check('guru Kelas 2 melihat pengumuman sekolah, tidak melihat pengumuman Kelas 1', captions.includes(annSchool.caption) && !captions.includes(annClass.caption), JSON.stringify(captions));
    r = await call('GET', `/posts/${annClass.id}`, { token: ahmadOrtu.token });
    check('ortu kelas lain membuka pengumuman kelas -> 404', r.status === 404);

    r = await call('GET', `/students/${ahmad.id}/posts`, { token: ahmadOrtu.token });
    check('pengumuman tidak masuk timeline siswa', r.data.items.every((p) => !p.audience), JSON.stringify(r.data.items.map((p) => p.caption)));
    r = await call('GET', `/students/${ahmad.id}/media`, { token: admin });
    check('foto pengumuman tidak masuk galeri siswa', r.status === 200 && !JSON.stringify(r.data).includes('Libur awal'));

    // Komentar ortu pada pengumuman: tetap per utas anaknya, tidak terlihat ortu lain.
    r = await call('POST', `/posts/${annSchool.id}/comments`, { token: ahmadOrtu.token, json: { content: 'Baik, terima kasih infonya' } });
    check('ortu berkomentar di pengumuman', r.status === 201, JSON.stringify(r.data));
    r = await call('GET', `/posts/${annSchool.id}/comments`, { token: aisyahOrtu.token });
    check('ortu lain tidak melihat komentar tsb', r.status === 200 && r.data.threads.length === 0, JSON.stringify(r.data));
    r = await call('GET', `/posts/${annSchool.id}/comments`, { token: admin });
    check('admin melihat komentar ortu di pengumuman', r.data.threads.length === 1);

    const reportAfter = await buildReport(await parsePeriod({ type: 'month', month: thisMonth }));
    check(
      'laporan: pengumuman dihitung terpisah & tidak menambah momen siswa/kelas',
      reportAfter.totals.announcements === 2 &&
        reportAfter.totals.posts === report.totals.posts + 2 &&
        reportAfter.totals.studentsWithMoments === report.totals.studentsWithMoments &&
        reportAfter.classRows.every((c, i) => c.posts === report.classRows[i].posts),
      JSON.stringify(reportAfter.totals),
    );
    check(
      'laporan: foto pengumuman di Foto/_Pengumuman (sekali saja) & kolom sasaran',
      reportAfter.photos.filter((p) => p.path.startsWith('Foto/_Pengumuman/')).length === 1 &&
        reportAfter.postRows.some((p) => p.tagged === 'Pengumuman: seluruh sekolah'),
      JSON.stringify(reportAfter.photos.map((p) => p.path)),
    );

    // ================= TAHAP 5: CHAT E2EE =================
    console.log('\n--- Tahap 5 ---');
    const c = await import(require('url').pathToFileURL(path.join(SERVER, '..', 'client', 'src', 'lib', 'crypto.js')).href);
    const { io: ioClient } = require('socket.io-client');
    const port = server.address().port;
    const sockets = [];
    const connect = (token) =>
      new Promise((resolve, reject) => {
        const s = ioClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
        sockets.push(s);
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
      });
    const nextEvent = (socket, event, ms = 3000) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout menunggu ${event}`)), ms);
        socket.once(event, (payload) => {
          clearTimeout(t);
          resolve(payload);
        });
      });

    try {
      r = await call('GET', '/chat/contacts', { token: admin });
      check('admin tidak punya chat -> 403', r.status === 403);
      r = await call('GET', '/chat/contacts', { token: ahmadOrtu.token });
      check(
        'kontak ortu Ahmad = 2 wali kelas 2 Abu Bakar',
        r.data.map((x) => x.displayName).join() === 'Hasan Basri, S.Pd.,Siti Aminah, S.Pd.' && r.data[0].subtitle === 'Wali Kelas 2 Abu Bakar',
        JSON.stringify(r.data),
      );
      r = await call('GET', '/chat/contacts', { token: siti.token });
      check('kontak guru = orang tua siswa di kelasnya (tampil dengan nama anak)', r.data.length === 1 && r.data[0].displayName === 'Ahmad Fauzan', JSON.stringify(r.data));
      r = await call('GET', '/chat/contacts', { token: aisyahOrtu.token });
      check('ortu Aisyah (kelas tanpa wali) tidak punya kontak', r.data.length === 0);

      // Kunci
      const sitiBundle = await c.createKeyBundle('passwordbaru1');
      r = await call('POST', '/chat/keys', { token: siti.token, json: { ...sitiBundle.upload, publicKey: JSON.stringify({ ...JSON.parse(sitiBundle.upload.publicKey), d: 'rahasia' }) } });
      check('kunci publik berisi komponen privat ditolak', r.status === 400);
      r = await call('POST', '/chat/keys', { token: siti.token, json: { ...sitiBundle.upload, iterations: 1000 } });
      check('iterasi PBKDF2 terlalu rendah ditolak', r.status === 400);
      r = await call('POST', '/chat/keys', { token: siti.token, json: sitiBundle.upload });
      const sitiKeyId = r.data.id;
      check('guru menyimpan kunci chat', r.status === 201);
      r = await call('POST', '/chat/keys', { token: siti.token, json: sitiBundle.upload });
      check('kunci kedua ditolak -> 409', r.status === 409);
      r = await call('GET', '/chat/keys/me', { token: siti.token });
      check('kunci privat yang tersimpan masih terkunci dan bisa dibuka dengan password', !!(await c.unlockPrivateKey(r.data, 'passwordbaru1')));
      r = await call('POST', '/auth/verify-password', { token: siti.token, json: { password: 'salah' } });
      check('verifikasi password salah -> 400', r.status === 400);

      // Percakapan
      r = await call('POST', '/conversations', { token: siti.token, json: { userId: ahmadOrtu.user.id } });
      const conv = r.data;
      check('guru membuka percakapan dengan ortu Ahmad', r.status === 200 && conv.counterpart.activeKey === null && conv.canSend, JSON.stringify(r.data));
      r = await call('POST', `/conversations/${conv.id}/messages`, { token: siti.token, json: { ciphertext: 'AAAA', iv: 'AAAAAAAAAAAAAAAA', senderKeyId: sitiKeyId, recipientKeyId: 0 } });
      check('kirim ke ortu yang belum punya kunci -> 400 dengan pesan jelas', r.status === 400 && /belum mengaktifkan/.test(r.data.message), JSON.stringify(r.data));
      r = await call('POST', '/conversations', { token: aisyahOrtu.token, json: { userId: siti.user.id } });
      check('ortu Aisyah tidak bisa chat Bu Siti -> 403', r.status === 403);
      r = await call('POST', '/conversations', { token: hasan.token, json: { userId: siti.user.id } });
      check('guru tidak bisa chat guru -> 403', r.status === 403);

      const ortuBundle = await c.createKeyBundle('passwordbaru1');
      r = await call('POST', '/chat/keys', { token: ahmadOrtu.token, json: ortuBundle.upload });
      const ortuKeyId = r.data.id;

      // Socket
      let socketRejected = false;
      try {
        await connect(admin);
      } catch {
        socketRejected = true;
      }
      check('admin ditolak di socket chat', socketRejected);
      socketRejected = false;
      try {
        await connect('token-palsu');
      } catch {
        socketRejected = true;
      }
      check('token palsu ditolak di socket', socketRejected);
      const sitiSocket = await connect(siti.token);
      const ortuSocket = await connect(ahmadOrtu.token);

      const shared = await c.deriveSharedKey(sitiBundle.privateKey, await c.importPublicKey(ortuBundle.upload.publicKey));
      const encrypted = await c.encryptMessage(shared, 'Assalamualaikum, Bunda. Ahmad hari ini hebat!', siti.user.id);
      const incoming = nextEvent(ortuSocket, 'message:new');
      r = await call('POST', `/conversations/${conv.id}/messages`, { token: siti.token, json: { ...encrypted, senderKeyId: sitiKeyId, recipientKeyId: ortuKeyId } });
      check('guru mengirim pesan terenkripsi', r.status === 201, JSON.stringify(r.data));
      const received = await incoming;
      const ortuShared = await c.deriveSharedKey(ortuBundle.privateKey, await c.importPublicKey(sitiBundle.upload.publicKey));
      check(
        'ortu menerima real-time dan bisa mendekripsi',
        (await c.decryptMessage(ortuShared, received)) === 'Assalamualaikum, Bunda. Ahmad hari ini hebat!',
      );
      r = await call('POST', `/conversations/${conv.id}/messages`, { token: siti.token, json: { ...encrypted, senderKeyId: sitiKeyId, recipientKeyId: sitiKeyId } });
      check('kunci penerima tidak cocok -> 409', r.status === 409);
      r = await call('POST', `/conversations/${conv.id}/messages`, { token: siti.token, json: { ciphertext: 'bukan base64!', iv: encrypted.iv, senderKeyId: sitiKeyId, recipientKeyId: ortuKeyId } });
      check('ciphertext tidak valid ditolak', r.status === 400);

      r = await call('GET', `/conversations/${conv.id}/messages`, { token: hasan.token });
      check('guru lain tidak bisa membaca percakapan -> 404', r.status === 404);
      r = await call('GET', `/conversations/${conv.id}/messages`, { token: ahmadOrtu.token });
      check('riwayat pesan hanya berisi ciphertext', r.data.items.length === 1 && !JSON.stringify(r.data).includes('Ahmad hari ini'));

      r = await call('GET', '/conversations', { token: ahmadOrtu.token });
      check(
        'daftar percakapan ortu: 1 belum dibaca, guru online, bisa membalas',
        r.data.length === 1 && r.data[0].unreadCount === 1 && r.data[0].counterpart.online === true && r.data[0].canSend && r.data[0].lastMessage?.id,
        JSON.stringify(r.data),
      );
      r = await call('GET', '/chat/unread', { token: ahmadOrtu.token });
      check('badge belum dibaca = 1', r.data.count === 1);

      const typing = nextEvent(sitiSocket, 'typing');
      ortuSocket.emit('typing', { conversationId: conv.id, isTyping: true });
      check('indikator mengetik sampai ke guru', (await typing).isTyping === true);
      ortuSocket.emit('typing', { conversationId: 999999, isTyping: true }); // percakapan orang lain: diabaikan

      const readEvent = nextEvent(sitiSocket, 'messages:read');
      r = await call('POST', `/conversations/${conv.id}/read`, { token: ahmadOrtu.token });
      check('tandai sudah dibaca', r.data.updated === 1 && (await readEvent).conversationId === conv.id);
      r = await call('GET', '/chat/unread', { token: ahmadOrtu.token });
      check('badge kembali 0', r.data.count === 0);

      r = await call('GET', `/chat/keys?ids=${sitiKeyId},${ortuKeyId}`, { token: ahmadOrtu.token });
      check('kunci publik lawan bicara bisa diambil', r.data.length === 2 && r.data.every((k) => !k.wrappedPrivateKey));
      r = await call('GET', `/chat/keys?ids=${sitiKeyId}`, { token: aisyahOrtu.token });
      check('kunci publik orang yang tidak pernah diajak chat tidak diberikan', r.data.length === 0);

      // Ganti password: kunci harus dikunci ulang
      await new Promise((res2) => setTimeout(res2, 1100));
      r = await call('PATCH', '/auth/password', { token: ahmadOrtu.token, json: { currentPassword: 'passwordbaru1', newPassword: 'passwordbaru2' } });
      check('ganti password tanpa mengunci ulang kunci chat ditolak', r.status === 400);
      const mine = (await call('GET', '/chat/keys/me', { token: ahmadOrtu.token })).data;
      const relocked = await c.relockPrivateKey(mine, 'passwordbaru1', 'passwordbaru2');
      r = await call('PATCH', '/auth/password', { token: ahmadOrtu.token, json: { currentPassword: 'passwordbaru1', newPassword: 'passwordbaru2', chatKey: relocked } });
      check('ganti password + kunci ulang', r.status === 200);
      ahmadOrtu.token = r.data.access_token;
      const afterChange = (await call('GET', '/chat/keys/me', { token: ahmadOrtu.token })).data;
      const ortuPriv2 = await c.unlockPrivateKey(afterChange, 'passwordbaru2');
      const shared2 = await c.deriveSharedKey(ortuPriv2, await c.importPublicKey(sitiBundle.upload.publicKey));
      check('pesan lama tetap terbaca setelah ganti password', (await c.decryptMessage(shared2, received)).startsWith('Assalamualaikum'));

      globalThis.__chat = { conv, sitiSocket, ortuSocket, nextEvent };
    } catch (err) {
      failures++;
      console.error('ERROR (chat)', err);
    }

    // ---------- Reset password ----------
    await new Promise((res2) => setTimeout(res2, 1100));
    const sitiDisconnected = globalThis.__chat ? globalThis.__chat.nextEvent(globalThis.__chat.sitiSocket, 'disconnect') : null;
    r = await call('POST', `/admin/users/${siti.user.id}/reset-password`, { token: admin });
    check('admin reset password guru', r.status === 200 && r.data.password?.length === 10);
    r = await call('GET', '/auth/me', { token: siti.token });
    check('sesi guru lama langsung tidak berlaku -> 401', r.status === 401);
    if (globalThis.__chat) {
      check('koneksi chat guru langsung diputus setelah reset', !!(await sitiDisconnected.catch(() => null)));
      r = await call('GET', '/conversations', { token: ahmadOrtu.token });
      check('kunci chat guru dinonaktifkan setelah reset', r.data[0]?.counterpart.activeKey === null, JSON.stringify(r.data[0]?.counterpart));
      sockets.forEach((s) => s.close());
    }
    r = await call('POST', '/admin/users/1/reset-password', { token: admin });
    check('reset password admin ditolak -> 403', r.status === 403);
    r = await call('PATCH', `/admin/users/${hasan.user.id}/status`, { token: admin, json: { isActive: false } });
    r = await call('GET', '/auth/me', { token: hasan.token });
    check('guru nonaktif tidak bisa akses -> 401', r.status === 401);
  } catch (err) {
    failures++;
    console.error('ERROR', err);
  } finally {
    server?.close();
    const { sequelize } = require(path.join(SERVER, 'models'));
    await sequelize.close().catch(() => {});
    await pg.stop();
    console.log(failures ? `\n${failures} tes GAGAL` : '\nSemua tes LULUS');
    process.exit(failures ? 1 : 0);
  }
})();
