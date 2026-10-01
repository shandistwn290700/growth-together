// Jeda animasi dihilangkan bagi pengguna yang mengaktifkan "kurangi gerakan" di perangkatnya.
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function motionDelay(ms) {
  return prefersReducedMotion() ? 0 : ms
}
