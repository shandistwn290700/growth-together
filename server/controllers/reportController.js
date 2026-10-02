const { ZipArchive } = require('archiver');
const { parsePeriod } = require('../services/reportPeriod');
const { buildReport } = require('../services/reportData');
const { buildReportExcel } = require('../helpers/reportExcel');
const { buildReportPdf } = require('../helpers/reportPdf');
const { loadAppearance, THEME_COLORS } = require('./settingsController');

const PHOTO_CONCURRENCY = 4;
const AVERAGE_PHOTO_MB = 0.35; // perkiraan ukuran foto arsip (JPG, lebar maks 2000px)

async function fetchPhoto(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function readme(report, schoolName, failedCount) {
  const { period, totals } = report;
  return [
    `${schoolName || 'Growth Together'} — Laporan ${period.label}`,
    `Dibuat: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`,
    '',
    'ISI ARSIP',
    '- Ringkasan.pdf          : ringkasan untuk dibaca/dicetak (angka utama, rekap per kelas, siswa tanpa momen).',
    '- Rekap-aktivitas.xlsx   : rincian per kelas, per siswa, per postingan, dan daftar video beserta tautannya.',
    `- Foto/                  : ${totals.photos} foto, dikelompokkan per kelas.`,
    '    Foto/<Kelas>/<Nama siswa>/      foto yang hanya menandai siswa tersebut',
    '    Foto/<Kelas>/_Kegiatan kelas/   foto yang menandai beberapa siswa sekaligus',
    '    Foto/_Pengumuman/               foto pengumuman admin (kelas tertentu / seluruh sekolah)',
    '    Nama file: <tanggal>_post<nomor>_<urutan>.jpg (nomor postingan sama dengan di sheet "Postingan").',
    '',
    'Video tidak disertakan agar ukuran arsip tetap wajar; tautannya ada di sheet "Video".',
    'Isi chat tidak disertakan karena terenkripsi end-to-end.',
    failedCount ? `\nPERHATIAN: ${failedCount} foto gagal diunduh, lihat foto-gagal-diunduh.txt.` : '',
    '',
    'Arsip ini berisi foto dan data anak-anak. Simpan dengan aman dan jangan disebarkan.',
  ].join('\r\n');
}

class ReportController {
  // GET /admin/reports/preview?type=month&month=2026-10  |  ?type=semester&academicYearId=1&half=ganjil
  static async preview(req, res) {
    const period = await parsePeriod(req.query);
    const report = await buildReport(period);
    res.json({
      label: period.label,
      academicYear: period.academicYear?.name ?? null,
      totals: report.totals,
      classes: report.classRows.length,
      estimatedSizeMB: Math.max(0.1, Math.round((report.photos.length * AVERAGE_PHOTO_MB + 0.2) * 10) / 10),
    });
  }

  // GET /admin/reports/download?... — ZIP dikirim bertahap (streaming), foto diambil dari Cloudinary.
  static async download(req, res) {
    const period = await parsePeriod(req.query);
    const [report, appearance] = await Promise.all([buildReport(period), loadAppearance()]);
    const color = THEME_COLORS[appearance.theme] ?? THEME_COLORS.toska;
    const [pdf, excel] = await Promise.all([
      buildReportPdf(report, { schoolName: appearance.schoolName, color }),
      buildReportExcel(report, appearance.schoolName),
    ]);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    let aborted = false;
    res.on('close', () => {
      if (!res.writableFinished) {
        aborted = true; // pengguna membatalkan unduhan
        archive.abort();
      }
    });
    archive.on('warning', (err) => console.warn('Laporan ZIP:', err.message));
    archive.on('error', (err) => {
      console.error('Laporan ZIP gagal:', err.message);
      res.destroy(err);
    });

    res.attachment(`laporan-${period.slug}.zip`);
    res.set('Cache-Control', 'no-store');
    archive.pipe(res);
    archive.append(pdf, { name: 'Ringkasan.pdf' });
    archive.append(excel, { name: 'Rekap-aktivitas.xlsx' });

    // Foto JPG sudah terkompresi, jadi disimpan apa adanya (store) agar cepat.
    const failed = [];
    for (let i = 0; i < report.photos.length && !aborted; i += PHOTO_CONCURRENCY) {
      const batch = report.photos.slice(i, i + PHOTO_CONCURRENCY);
      const results = await Promise.allSettled(batch.map((photo) => fetchPhoto(photo.url)));
      results.forEach((result, j) => {
        if (result.status === 'fulfilled') archive.append(result.value, { name: batch[j].path, store: true });
        else failed.push(`${batch[j].path} (${result.reason.message})`);
      });
    }
    if (aborted) return;

    if (failed.length) archive.append(failed.join('\r\n'), { name: 'foto-gagal-diunduh.txt' });
    archive.append(readme(report, appearance.schoolName, failed.length), { name: 'BACA-SAYA.txt' });
    await archive.finalize();
  }
}

module.exports = ReportController;
