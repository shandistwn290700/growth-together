import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { getErrorMessage } from '../../lib/api.js'
import { useMe } from '../../lib/auth.js'
import { classLabel, useClassrooms } from '../../lib/queries.js'
import { MAX_FILES, mediaTypeOf, uploadToCloudinary, validateFile } from '../../lib/upload.js'
import { addNewPost } from '../../lib/feedCache.js'
import { Image, Star, Tag, X } from 'lucide-react'
import { Alert, Avatar, Button, Card, Select } from '../ui.jsx'
import GlassDialog from '../GlassDialog.jsx'

let nextFileId = 1

// Tambahkan file pilihan ke daftar: buang yang tidak valid/terlalu besar dan batasi jumlahnya.
function withNewFiles(existing, list) {
  const picked = [...list]
  const errors = picked.map(validateFile).filter(Boolean)
  const valid = picked.filter((f) => !validateFile(f))
  const room = MAX_FILES - existing.length
  if (valid.length > room) errors.push(`Maksimal ${MAX_FILES} foto/video per postingan`)
  const added = valid.slice(0, room).map((file) => ({
    id: nextFileId++,
    file,
    type: mediaTypeOf(file),
    previewUrl: URL.createObjectURL(file),
    progress: 0,
  }))
  return { files: [...existing, ...added], error: errors.join('. ') }
}

export default function PostComposer() {
  const { data: me } = useMe()
  // false = tertutup; { files } = terbuka (files berisi foto/video yang langsung dipilih, jika ada)
  const [open, setOpen] = useState(false)
  const quickPicker = useRef(null)

  if (me.role === 'parent' && me.student?.status !== 'active') {
    return (
      <Card className="text-sm text-slate-600">
        Ananda sudah {me.student?.status === 'graduated' ? 'lulus' : 'tidak aktif'}. Timeline tetap bisa dilihat sebagai
        arsip kenangan.
      </Card>
    )
  }

  const action =
    'flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100'
  // Kotak ringkas tetap tampil di feed; formulir lengkap terbuka sebagai jendela kaca di atasnya.
  return (
    <>
      <Card padding="px-4 pt-3 pb-1">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <Avatar name={me.displayName} src={me.avatarUrl} />
          <button
            onClick={() => setOpen({ files: [] })}
            className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-left text-slate-500 hover:bg-slate-200"
          >
            {me.role === 'parent' ? `Bagikan momen ${me.student?.nickname || me.displayName}…` : 'Bagikan kegiatan kelas…'}
          </button>
        </div>
        <div className="flex py-1">
          <input
            ref={quickPicker}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files.length) setOpen({ files: [...e.target.files] })
              e.target.value = ''
            }}
          />
          <button onClick={() => quickPicker.current.click()} className={action}>
            <Image className="size-5 text-brand-600" strokeWidth={2.2} /> Foto/Video
          </button>
          <button onClick={() => setOpen({ files: [] })} className={action}>
            {me.role === 'parent' ? (
              <Star className="size-5 text-brand-600" strokeWidth={2.2} />
            ) : (
              <Tag className="size-5 text-brand-600" strokeWidth={2.2} />
            )}
            {me.role === 'parent' ? 'Pencapaian' : 'Tandai siswa'}
          </button>
        </div>
      </Card>
      {open && <ComposerForm me={me} initialFiles={open.files} onClose={() => setOpen(false)} />}
    </>
  )
}

function ComposerForm({ me, initialFiles, onClose }) {
  const queryClient = useQueryClient()
  const dialog = useRef(null)
  const fileInput = useRef(null)
  const isStaff = me.role !== 'parent'
  const [caption, setCaption] = useState('')
  // File yang sudah dipilih lewat tombol "Foto/Video" di kotak tertutup langsung ditampilkan.
  const [initial] = useState(() => withNewFiles([], initialFiles ?? []))
  const [files, setFiles] = useState(initial.files)
  const [fileError, setFileError] = useState(initial.error)
  const [target, setTarget] = useState({ classroomId: null, studentIds: [] })

  // Bersihkan URL pratinjau saat komponen ditutup.
  const filesRef = useRef(files)
  useEffect(() => {
    filesRef.current = files
  }, [files])
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl)), [])

  const addFiles = (list) => {
    const result = withNewFiles(files, list)
    setFiles(result.files)
    setFileError(result.error)
  }

  const removeFile = (id) => {
    const item = files.find((f) => f.id === id)
    if (item) URL.revokeObjectURL(item.previewUrl)
    setFiles(files.filter((f) => f.id !== id))
  }

  const setProgress = (id, progress) => setFiles((current) => current.map((f) => (f.id === id ? { ...f, progress } : f)))

  const submit = useMutation({
    mutationFn: async () => {
      const media = []
      // Upload satu per satu agar tidak membebani koneksi HP.
      for (const item of files) {
        media.push(await uploadToCloudinary(item.file, (p) => setProgress(item.id, p)))
      }
      const { data } = await api.post('/posts', { caption, media, ...target })
      return data
    },
    onSuccess: (post) => {
      addNewPost(queryClient, post)
      dialog.current.close()
    },
  })

  const uploadError = submit.error?.response?.data?.error?.message // error dari Cloudinary
  const canSubmit = (caption.trim() || files.length) && (!isStaff || target.studentIds.length > 0) && !submit.isPending

  const dirty = caption.trim() !== '' || files.length > 0
  const uploaded = files.filter((f) => f.progress >= 100).length

  return (
    <GlassDialog
      ref={dialog}
      title="Buat postingan"
      onClose={onClose}
      locked={submit.isPending}
      confirmClose={dirty ? 'Buang postingan ini? Tulisan dan foto yang dipilih akan hilang.' : null}
      footer={
        <Button onClick={() => submit.mutate()} disabled={!canSubmit} className="w-full py-2.5 text-base">
          {submit.isPending ? (files.length ? `Mengunggah ${uploaded}/${files.length}…` : 'Memposting…') : 'Posting'}
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={me.displayName} src={me.avatarUrl} />
          <div className="leading-tight">
            <div className="font-bold">{me.displayName}</div>
            <div className="text-xs text-slate-600">
              {isStaff ? 'Terlihat oleh orang tua siswa yang ditandai' : 'Terlihat oleh Anda dan guru ananda'}
            </div>
          </div>
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={files.length ? 3 : 5}
          maxLength={5000}
          autoFocus
          disabled={submit.isPending}
          placeholder={isStaff ? 'Ceritakan kegiatan hari ini…' : 'Ceritakan perkembangan ananda…'}
          aria-label="Isi postingan"
          className={`w-full resize-none bg-transparent px-1 outline-none placeholder:text-slate-500 ${caption.length > 120 || files.length ? 'text-base' : 'text-xl'}`}
        />

        {files.length > 0 && (
          <div className="glass-field grid grid-cols-3 gap-2 rounded-xl p-2 sm:grid-cols-4">
            {files.map((f) => (
              <div key={f.id} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                {f.type === 'image' ? (
                  <img src={f.previewUrl} alt="" className="size-full object-cover" />
                ) : (
                  <video src={f.previewUrl} className="size-full object-cover" muted />
                )}
                {f.type === 'video' && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">Video</span>
                )}
                {submit.isPending ? (
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
                    <div className="h-full bg-brand-500 transition-all" style={{ width: `${f.progress}%` }} />
                  </div>
                ) : (
                  <button
                    onClick={() => removeFile(f.id)}
                    className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Hapus file"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {fileError && <Alert variant="warning">{fileError}</Alert>}
        {submit.isError && <Alert>{uploadError ? `Upload gagal: ${uploadError}` : getErrorMessage(submit.error)}</Alert>}

        {isStaff && <TagPicker me={me} value={target} onChange={setTarget} disabled={submit.isPending} />}

        {/* "Tambahkan ke postingan" seperti di Facebook */}
        <div className="glass-field flex items-center gap-2 rounded-xl py-2 pr-2 pl-4">
          <span className="text-sm font-semibold text-slate-700">Tambahkan ke postingan</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current.click()}
            disabled={files.length >= MAX_FILES || submit.isPending}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white/70 disabled:opacity-50"
          >
            <Image className="size-5 text-brand-600" strokeWidth={2.2} /> Foto/Video
            <span className="text-slate-500">
              {files.length}/{MAX_FILES}
            </span>
          </button>
        </div>
      </div>
    </GlassDialog>
  )
}

// Guru: pilih kelas yang diampu lalu siswa yang ditandai. Admin: bisa memilih kelas mana saja.
function TagPicker({ me, value, onChange, disabled }) {
  const classrooms = useClassrooms()
  const options = (classrooms.data ?? []).filter((c) => me.role === 'admin' || c.teachers.some((t) => t.id === me.id))
  const classroomId = value.classroomId ?? options[0]?.id

  const detail = useQuery({
    queryKey: ['classroom', String(classroomId)],
    queryFn: () => api.get(`/classrooms/${classroomId}`).then((res) => res.data),
    enabled: Boolean(classroomId),
  })
  const students = (detail.data?.students ?? []).filter((s) => s.status === 'active')
  const allSelected = students.length > 0 && students.every((s) => value.studentIds.includes(s.id))

  const toggle = (id) =>
    onChange({
      classroomId,
      studentIds: value.studentIds.includes(id) ? value.studentIds.filter((s) => s !== id) : [...value.studentIds, id],
    })

  if (classrooms.isSuccess && options.length === 0) {
    return <Alert variant="warning">Anda belum terdaftar sebagai wali kelas di tahun ajaran aktif.</Alert>
  }

  return (
    <fieldset disabled={disabled} className="glass-field space-y-2 rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-bold">Tandai siswa</legend>
        <div className="w-48">
          <Select
            value={classroomId ?? ''}
            onChange={(e) => onChange({ classroomId: Number(e.target.value), studentIds: [] })}
            aria-label="Kelas"
          >
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {students.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => onChange({ classroomId, studentIds: allSelected ? [] : students.map((s) => s.id) })}
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {allSelected ? 'Batalkan semua' : `Pilih semua (${students.length} siswa)`}
          </button>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {students.map((s) => {
              const selected = value.studentIds.includes(s.id)
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  aria-pressed={selected}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    selected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white/80 text-slate-700 hover:border-brand-600'
                  }`}
                >
                  {s.nickname || s.fullName}
                </button>
              )
            })}
          </div>
        </>
      )}
      {detail.isSuccess && students.length === 0 && <p className="text-sm text-slate-500">Belum ada siswa aktif.</p>}
      <p className="text-xs text-slate-600">
        Postingan hanya terlihat oleh orang tua siswa yang ditandai. Setiap orang tua hanya melihat nama anaknya sendiri.
      </p>
    </fieldset>
  )
}
