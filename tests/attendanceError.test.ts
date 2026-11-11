import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendanceErrorKind } from '../src/utils/attendanceError.ts';

test('attendance conflict messages identify stale, locked and incomplete cases', () => {
  assert.equal(attendanceErrorKind({ message: 'attendance_already_exists' }), 'stale');
  assert.equal(attendanceErrorKind(new Error('attendance_day_changed')), 'stale');
  assert.equal(attendanceErrorKind({ message: 'attendance_day_locked' }), 'locked');
  assert.equal(attendanceErrorKind({ message: 'attendance_day_incomplete' }), 'incomplete');
  assert.equal(attendanceErrorKind({ message: 'network failure' }), 'other');
  assert.equal(attendanceErrorKind(null), 'other');
});
