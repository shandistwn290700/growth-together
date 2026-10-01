import { useQuery } from '@tanstack/react-query'
import api from './api.js'

const get = (url, params) => api.get(url, { params }).then((res) => res.data)

export function useAcademicYears() {
  return useQuery({ queryKey: ['academic-years'], queryFn: () => get('/academic-years') })
}

export function useClassrooms(academicYearId, options = {}) {
  return useQuery({
    queryKey: ['classrooms', academicYearId ?? 'active'],
    queryFn: () => get('/classrooms', academicYearId ? { academicYearId } : undefined),
    ...options,
  })
}

export function useTeachers(options = {}) {
  return useQuery({ queryKey: ['teachers'], queryFn: () => get('/admin/teachers'), ...options })
}

export const classLabel = (classroom) => `Kelas ${classroom.grade} ${classroom.name}`

export const ENROLLMENT_STATUS = {
  active: { label: 'Aktif', variant: 'green' },
  promoted: { label: 'Naik kelas', variant: 'blue' },
  retained: { label: 'Tinggal kelas', variant: 'amber' },
  graduated: { label: 'Lulus', variant: 'blue' },
  moved: { label: 'Pindah sekolah', variant: 'gray' },
}
