import Swal from 'sweetalert2'

// Pengganti window.confirm / window.alert dengan jendela SweetAlert2 bergaya aplikasi
// (efek kaca, warna tema sekolah). Tampilannya diatur di index.css (class gt-swal-* dan gt-toast-*).
// Teks selalu dimasukkan sebagai teks biasa (bukan HTML), jadi nama siswa dll. aman ditampilkan.

const svg = (paths) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

// Ikon lucide (sama dengan ikon di seluruh aplikasi).
const ICONS = {
  success: svg('<path d="M20 6 9 17l-5-5"/>'),
  error: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  warning: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  danger: svg(
    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  ),
  question: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'),
}
const SWAL_ICON = { success: 'success', error: 'error', warning: 'warning', danger: 'error', question: 'question' }

// customClass dari SweetAlert2 tidak digabung antar-mixin, jadi selalu disusun lengkap di sini.
const dialogClasses = (tone, confirmClass = 'gt-swal-confirm') => ({
  container: 'gt-swal-container',
  popup: 'gt-swal',
  icon: `gt-swal-icon gt-tone-${tone}`,
  title: 'gt-swal-title',
  htmlContainer: 'gt-swal-text',
  actions: 'gt-swal-actions',
  confirmButton: `gt-swal-btn ${confirmClass}`,
  cancelButton: 'gt-swal-btn gt-swal-cancel',
})

const Dialog = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true, // Batal di kiri, tombol utama di kanan
  heightAuto: false, // jangan ubah tinggi <body>: tata letak aplikasi memakai 100dvh
})

const Toast = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 2800,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  },
})

/**
 * Minta konfirmasi. Mengembalikan Promise<boolean>.
 * tone: 'danger' (hapus/tindakan permanen, tombol merah), 'warning', atau 'question'.
 */
export async function confirmAction({ title, text, confirmText = 'Ya, lanjutkan', cancelText = 'Batal', tone = 'question' }) {
  const danger = tone === 'danger'
  const { isConfirmed } = await Dialog.fire({
    icon: SWAL_ICON[tone],
    iconHtml: ICONS[tone],
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    // Untuk tindakan berbahaya, fokus awal di "Batal" agar Enter tidak langsung menghapus.
    focusCancel: danger,
    customClass: dialogClasses(tone, danger ? 'gt-swal-danger' : 'gt-swal-confirm'),
  })
  return isConfirmed
}

// Dipakai di beranda dan halaman Moderasi admin.
export const confirmDeletePost = () =>
  confirmAction({
    title: 'Hapus postingan ini?',
    text: 'Foto dan video di dalamnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.',
    confirmText: 'Hapus',
    tone: 'danger',
  })

// Dipakai di halaman Guru, Siswa & Orang Tua, dan detail kelas.
export const confirmResetPassword = (accountLabel) =>
  confirmAction({
    title: `Reset password ${accountLabel}?`,
    text: 'Password baru akan dibuat otomatis. Riwayat chat terenkripsi akun ini tidak bisa dibuka lagi setelah reset.',
    confirmText: 'Reset password',
    tone: 'warning',
  })

// Pesan kesalahan yang perlu dibaca (pengganti window.alert).
export function showError(text, title = 'Gagal') {
  return Dialog.fire({
    icon: 'error',
    iconHtml: ICONS.error,
    title,
    text,
    confirmButtonText: 'Mengerti',
    customClass: dialogClasses('error'),
  })
}

// Notifikasi singkat di atas layar setelah tindakan berhasil (hilang sendiri).
export function notify(title, tone = 'success') {
  return Toast.fire({
    icon: SWAL_ICON[tone],
    iconHtml: ICONS[tone],
    title,
    customClass: {
      container: 'gt-toast-container',
      popup: 'gt-toast',
      icon: `gt-swal-icon gt-tone-${tone}`,
      title: 'gt-toast-title',
      timerProgressBar: 'gt-toast-bar',
    },
  })
}
