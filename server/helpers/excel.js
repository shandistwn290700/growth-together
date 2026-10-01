// Ambil isi sel sebagai teks, apa pun tipe aslinya (angka, tanggal, rich text, formula).
function cellText(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map((r) => r.text).join('').trim();
    if ('result' in value) return cellText({ value: value.result });
    if (value.text) return String(value.text).trim();
  }
  return String(value).trim();
}

// Terima "2018-07-15", "15/07/2018", atau "15-07-2018". Hasil: "YYYY-MM-DD" atau null jika tidak valid.
function parseDate(text) {
  if (!text) return null;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let [year, month, day] = match ? [match[1], match[2], match[3]] : [];
  if (!match) {
    match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!match) return null;
    [day, month, year] = [match[1], match[2], match[3]];
  }
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

// Baca semua baris data (mulai baris 2), lewati baris yang kosong total.
function readRows(sheet, keys) {
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = Object.fromEntries(keys.map((key, i) => [key, cellText(row.getCell(i + 1))]));
    if (Object.values(values).some(Boolean)) rows.push({ rowNumber, ...values });
  });
  return rows;
}

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

module.exports = { cellText, parseDate, readRows, styleHeader };
