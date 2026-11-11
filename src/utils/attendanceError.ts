/** Database conflict categories are shown without leaking server internals. */
export function attendanceErrorKind(error: unknown): 'stale' | 'locked' | 'incomplete' | 'other' {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (['attendance_changed', 'attendance_child_changed', 'attendance_day_changed', 'attendance_already_exists', 'attendance_not_found'].some(code => message.includes(code))) return 'stale';
  if (message.includes('attendance_day_locked')) return 'locked';
  if (message.includes('attendance_day_incomplete')) return 'incomplete';
  return 'other';
}
