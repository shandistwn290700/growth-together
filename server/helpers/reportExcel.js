const ExcelJS = require('exceljs');
const { styleHeader } = require('./excel');

function addTable(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  styleHeader(sheet);
  sheet.addRows(rows);
  if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

// Rekap aktivitas dalam satu file Excel (5 sheet) untuk diolah lebih lanjut oleh sekolah.
async function buildReportExcel(report, schoolName) {
  const { period, totals, classRows, studentRows, postRows, videos } = report;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Growth Together';

  const summary = workbook.addWorksheet('Ringkasan');
  summary.columns = [
    { key: 'label', width: 42 },
    { key: 'value', width: 18 },
  ];
  summary.addRow([schoolName || 'Growth Together']).font = { bold: true, size: 14 };
  summary.addRow([`Laporan ${period.label}`]).font = { bold: true, size: 12 };
  summary.addRow([`Tahun ajaran: ${period.academicYear?.name ?? '-'}`]);
  summary.addRow([`Dibuat: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`]);
  summary.addRow([]);
  [
    ['Total postingan', totals.posts],
    ['  · dari guru', totals.postsByTeacher],
    ['  · dari orang tua', totals.postsByParent],
    ['  · dari admin', totals.postsByAdmin],
    ['    (di antaranya pengumuman)', totals.announcements],
    ['Foto', totals.photos],
    ['Video', totals.videos],
    ['Komentar', totals.comments],
    ['Reaksi', totals.reactions],
    ['Siswa terdaftar', totals.students],
    ['Siswa yang memiliki momen', totals.studentsWithMoments],
    ['Akun orang tua aktif (saat laporan dibuat)', `${totals.parentsActive} dari ${totals.parents}`],
    ['Pesan chat (jumlah saja; isi terenkripsi)', totals.chatMessages],
  ].forEach((row) => summary.addRow(row));

  addTable(
    workbook,
    'Per kelas',
    [
      { header: 'Kelas', key: 'label', width: 28 },
      { header: 'Wali kelas', key: 'teachers', width: 34 },
      { header: 'Siswa', key: 'students', width: 9 },
      { header: 'Postingan', key: 'posts', width: 11 },
      { header: 'Foto', key: 'photos', width: 9 },
      { header: 'Video', key: 'videos', width: 9 },
      { header: 'Komentar', key: 'comments', width: 11 },
      { header: 'Reaksi', key: 'reactions', width: 9 },
      { header: 'Siswa tanpa momen', key: 'without', width: 18 },
    ],
    classRows.map((c) => ({ ...c, without: c.withoutMoments.length })),
  );

  addTable(
    workbook,
    'Per siswa',
    [
      { header: 'NIS', key: 'nis', width: 12 },
      { header: 'Nama', key: 'fullName', width: 30 },
      { header: 'Kelas', key: 'classLabel', width: 26 },
      { header: 'Momen', key: 'moments', width: 9 },
      { header: 'Dari guru', key: 'fromTeacher', width: 11 },
      { header: 'Dari orang tua', key: 'fromParent', width: 15 },
      { header: 'Foto', key: 'photos', width: 8 },
      { header: 'Video', key: 'videos', width: 8 },
      { header: 'Komentar', key: 'comments', width: 11 },
      { header: 'Akun orang tua', key: 'parentStatus', width: 15 },
    ],
    studentRows,
  );

  addTable(
    workbook,
    'Postingan',
    [
      { header: 'Tanggal', key: 'date', width: 12 },
      { header: 'Penulis', key: 'authorName', width: 28 },
      { header: 'Peran', key: 'authorRole', width: 11 },
      { header: 'Kelas', key: 'classes', width: 26 },
      { header: 'Siswa ditandai / sasaran', key: 'tagged', width: 34 },
      { header: 'Caption', key: 'caption', width: 60 },
      { header: 'Foto', key: 'photos', width: 7 },
      { header: 'Video', key: 'videos', width: 7 },
      { header: 'Reaksi', key: 'reactions', width: 8 },
      { header: 'Komentar', key: 'comments', width: 10 },
    ],
    postRows,
  ).getColumn('caption').alignment = { wrapText: true, vertical: 'top' };

  const videoSheet = addTable(
    workbook,
    'Video',
    [
      { header: 'Tanggal', key: 'date', width: 12 },
      { header: 'Kelas', key: 'classes', width: 26 },
      { header: 'Siswa', key: 'students', width: 30 },
      { header: 'Caption', key: 'caption', width: 50 },
      { header: 'Durasi (detik)', key: 'duration', width: 14 },
      { header: 'Tautan', key: 'url', width: 30 },
    ],
    videos.map((v) => ({ ...v, url: { text: 'Putar video', hyperlink: v.url } })),
  );
  // Gaya tautan hanya untuk sel data, bukan judul kolom.
  videoSheet.getColumn('url').eachCell((cell, row) => {
    if (row > 1) cell.font = { color: { argb: 'FF1D4ED8' }, underline: true };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { buildReportExcel };
