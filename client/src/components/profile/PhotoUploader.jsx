import { useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { getErrorMessage } from '../../lib/api.js'
import { uploadToCloudinary, validateFile } from '../../lib/upload.js'

// Foto profil besar dengan tombol kamera untuk menggantinya.
// `save(uploaded)` dipanggil setelah file berhasil diunggah ke Cloudinary.
export default function PhotoUploader({ name, photoUrl, canEdit, save }) {
  const input = useRef(null)
  const upload = useMutation({
    mutationFn: async (file) => {
      const error = validateFile(file)
      if (error) throw new Error(error)
      return save(await uploadToCloudinary(file, null, 'avatar'))
    },
    onError: (err) => window.alert(err.message && !err.response ? err.message : getErrorMessage(err)),
  })

  return (
    <div className="relative size-32 shrink-0 sm:size-40">
      {photoUrl ? (
        <img src={photoUrl} alt={`Foto ${name}`} className="size-full rounded-full border-4 border-white object-cover shadow" />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full border-4 border-white bg-brand-100 text-5xl font-extrabold text-brand-700 shadow">
          {name?.trim()?.[0]?.toUpperCase()}
        </div>
      )}
      {upload.isPending && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
          <span className="size-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
        </div>
      )}
      {canEdit && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              if (e.target.files[0]) upload.mutate(e.target.files[0])
              e.target.value = ''
            }}
          />
          <button
            onClick={() => input.current.click()}
            disabled={upload.isPending}
            className="absolute right-1 bottom-1 flex size-10 items-center justify-center rounded-full bg-brand-600 text-white shadow ring-4 ring-white hover:bg-brand-700"
            aria-label="Ganti foto profil"
            title="Ganti foto profil"
          >
            <Camera className="size-5" strokeWidth={2.2} />
          </button>
        </>
      )}
    </div>
  )
}
