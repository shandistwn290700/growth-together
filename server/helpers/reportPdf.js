// Ringkasan laporan dalam PDF (A4) untuk dibaca/dicetak atasan.
const PDFDocument = require('pdfkit');

const INK = '#1e293b';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f8fafc';
const MARGIN = 48;

const number = new Intl.NumberFormat('id-ID');
const n = (value) => number.format(value ?? 0);
const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%');

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function sectionTitle(doc, title, color) {
  ensureSpace(doc, 60);
  doc.moveDown(1.2);
  const y = doc.y;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(title, MARGIN, y);
  doc.rect(MARGIN, doc.y + 3, 28, 2.5).fill(color);
  doc.y += 12;
}

// Tabel sederhana dengan judul kolom yang diulang di halaman baru.
function drawTable(doc, columns, rows, color) {
  const width = doc.page.width - MARGIN * 2;
  const widths = columns.map((c) => c.width * width);
  const pad = 5;

  const drawRow = (cells, { header = false } = {}) => {
    doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    const heights = cells.map((text, i) => doc.heightOfString(String(text), { width: widths[i] - pad * 2 }));
    const height = Math.max(...heights) + pad * 2;
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      if (!header) drawRow(columns.map((c) => c.header), { header: true });
    }
    const y = doc.y;
    if (header) doc.rect(MARGIN, y, width, height).fill(SOFT);
    let x = MARGIN;
    cells.forEach((text, i) => {
      doc
        .fillColor(header ? MUTED : INK)
        .font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(8.5)
        .text(String(text), x + pad, y + pad, { width: widths[i] - pad * 2, align: columns[i].align ?? 'left' });
      x += widths[i];
    });
    doc.moveTo(MARGIN, y + height).lineTo(MARGIN + width, y + height).lineWidth(header ? 1 : 0.5).strokeColor(header ? color : LINE).stroke();
    doc.y = y + height;
  };

  drawRow(columns.map((c) => c.header), { header: true });
  rows.forEach((row) => drawRow(row));
}

function buildReportPdf(report, { schoolName, color }) {
  const { period, totals, classRows } = report;
  const title = schoolName || 'Growth Together';
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: 56, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: `Laporan ${period.label}`, Author: title },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const width = doc.page.width - MARGIN * 2;

  // ---------- Kop ----------
  doc.rect(0, 0, doc.page.width, 112).fill(color);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(title, MARGIN, 28, { width });
  doc.font('Helvetica').fontSize(10.5).fillOpacity(0.9).text('Laporan Aktivitas & Perkembangan Siswa', { width });
  doc.fillOpacity(1).font('Helvetica-Bold').fontSize(13).text(period.label, { width });
  doc.y = 128;
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8.5)
    .text(
      `Tahun ajaran ${period.academicYear?.name ?? '-'}  ·  Dibuat ${new Date().toLocaleString('id-ID', {
        dateStyle: 'long',
        timeStyle: 'short',
      })}`,
      MARGIN,
    );

  // ---------- Angka utama ----------
  const kpis = [
    ['Postingan', n(totals.posts), `Guru ${n(totals.postsByTeacher)} · Orang tua ${n(totals.postsByParent)}`],
    ['Foto', n(totals.photos), 'Ada di folder Foto/ pada ZIP'],
    ['Video', n(totals.videos), 'Tautan di sheet "Video" (Excel)'],
    ['Komentar & reaksi', `${n(totals.comments)} · ${n(totals.reactions)}`, 'Interaksi guru & orang tua'],
    ['Siswa dengan momen', `${n(totals.studentsWithMoments)} / ${n(totals.students)}`, percent(totals.studentsWithMoments, totals.students)],
    ['Akun orang tua aktif', `${n(totals.parentsActive)} / ${n(totals.parents)}`, percent(totals.parentsActive, totals.parents)],
  ];
  const gap = 10;
  const boxW = (width - gap * 2) / 3;
  const boxH = 62;
  const top = doc.y + 14;
  kpis.forEach(([label, value, hint], i) => {
    const x = MARGIN + (i % 3) * (boxW + gap);
    const y = top + Math.floor(i / 3) * (boxH + gap);
    doc.roundedRect(x, y, boxW, boxH, 6).fillAndStroke(SOFT, LINE);
    doc.rect(x, y + 10, 3, boxH - 20).fill(color);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(label, x + 12, y + 9, { width: boxW - 20 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(17).text(value, x + 12, y + 22, { width: boxW - 20 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(hint, x + 12, y + 45, { width: boxW - 20, lineBreak: false, ellipsis: true });
  });
  doc.y = top + boxH * 2 + gap;

  // ---------- Grafik: postingan per kelas ----------
  sectionTitle(doc, 'Postingan per kelas', color);
  if (classRows.length === 0) {
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Belum ada kelas pada tahun ajaran ini.', MARGIN);
  } else {
    const max = Math.max(1, ...classRows.map((c) => c.posts));
    const labelW = 150;
    const barMax = width - labelW - 40;
    classRows.forEach((c) => {
      ensureSpace(doc, 20);
      const y = doc.y;
      doc.fillColor(INK).font('Helvetica').fontSize(8.5).text(c.label, MARGIN, y + 2, { width: labelW - 8, lineBreak: false, ellipsis: true });
      const barW = (c.posts / max) * barMax;
      if (c.posts > 0) doc.roundedRect(MARGIN + labelW, y, Math.max(barW, 3), 12, 2).fill(color);
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5).text(n(c.posts), MARGIN + labelW + barW + 6, y + 2);
      doc.y = y + 19;
    });
  }

  // ---------- Tabel per kelas ----------
  sectionTitle(doc, 'Rekap per kelas', color);
  drawTable(
    doc,
    [
      { header: 'Kelas', width: 0.24 },
      { header: 'Wali kelas', width: 0.26 },
      { header: 'Siswa', width: 0.09, align: 'right' },
      { header: 'Postingan', width: 0.11, align: 'right' },
      { header: 'Foto', width: 0.09, align: 'right' },
      { header: 'Video', width: 0.09, align: 'right' },
      { header: 'Tanpa momen', width: 0.12, align: 'right' },
    ],
    classRows.map((c) => [c.label, c.teachers, n(c.students), n(c.posts), n(c.photos), n(c.videos), n(c.withoutMoments.length)]),
    color,
  );

  // ---------- Siswa tanpa momen ----------
  sectionTitle(doc, 'Siswa yang belum memiliki momen', color);
  const missing = classRows.filter((c) => c.withoutMoments.length);
  if (missing.length === 0) {
    doc.fillColor(INK).font('Helvetica').fontSize(9).text('Semua siswa memiliki setidaknya satu momen pada periode ini.', MARGIN, doc.y, { width });
  } else {
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8.5)
      .text('Perlu perhatian: belum ada postingan yang menandai siswa berikut pada periode ini.', MARGIN, doc.y, { width });
    missing.forEach((c) => {
      ensureSpace(doc, 30);
      doc.moveDown(0.6);
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(`${c.label} (${c.withoutMoments.length})`, MARGIN, doc.y, { width });
      doc.font('Helvetica').fontSize(9).text(c.withoutMoments.join(', '), MARGIN, doc.y + 2, { width });
    });
  }

  // ---------- Catatan ----------
  ensureSpace(doc, 50);
  doc.moveDown(1.5);
  doc
    .fillColor(MUTED)
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text(
      `Catatan: isi chat guru dan orang tua terenkripsi end-to-end sehingga tidak termasuk dalam laporan; ` +
        `yang dicatat hanya jumlahnya (${n(totals.chatMessages)} pesan). Status akun orang tua sesuai keadaan saat laporan dibuat. ` +
        `Rincian lengkap ada di file Rekap-aktivitas.xlsx.`,
      MARGIN,
      doc.y,
      { width },
    );

  // ---------- Nomor halaman ----------
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // agar teks footer tidak memicu halaman baru
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`${title} · ${period.label} · Halaman ${i + 1} dari ${pages.count}`, MARGIN, doc.page.height - 36, {
        width,
        align: 'center',
      });
  }

  doc.end();
  return done;
}

module.exports = { buildReportPdf };
