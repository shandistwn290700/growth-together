import axios from 'axios'
import api from './api.js'

export const MAX_FILES = 10
const LIMITS = {
  image: { bytes: 10 * 1024 * 1024, label: '10 MB' },
  video: { bytes: 100 * 1024 * 1024, label: '100 MB' },
}

export function mediaTypeOf(file) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

// Kembalikan pesan error jika file tidak bisa diupload, atau null jika aman.
export function validateFile(file) {
  const type = mediaTypeOf(file)
  if (!type) return `${file.name}: hanya foto atau video yang didukung`
  if (file.size > LIMITS[type].bytes) {
    return `${file.name}: ukuran maksimal ${type === 'image' ? 'foto' : 'video'} ${LIMITS[type].label}`
  }
  return null
}

// Upload langsung dari browser ke Cloudinary memakai tanda tangan dari server kita.
// purpose: 'post' (foto/video postingan) atau 'avatar' (foto profil).
export async function uploadToCloudinary(file, onProgress, purpose = 'post') {
  const resourceType = mediaTypeOf(file)
  const { data: signed } = await api.post('/uploads/signature', { resourceType, purpose })

  const form = new FormData()
  Object.entries(signed.params).forEach(([key, value]) => form.append(key, value))
  form.append('file', file)

  // Pakai axios biasa (bukan `api`) agar token login kita tidak ikut terkirim ke Cloudinary.
  const { data } = await axios.post(signed.uploadUrl, form, {
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
  })

  return {
    publicId: data.public_id,
    version: data.version,
    signature: data.signature,
    resourceType: data.resource_type,
    width: data.width,
    height: data.height,
    duration: data.duration,
  }
}
