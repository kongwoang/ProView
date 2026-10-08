import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateInput, dateInputToIso, dateTime } from '../lib/date-time';

test('offering wall-clock conversion is independent of browser zone', () => {
  assert.equal(dateInput('2026-01-15T12:30:00Z', 'Asia/Ho_Chi_Minh'), '2026-01-15T19:30');
  assert.equal(dateInputToIso('2026-01-15T19:30', 'Asia/Ho_Chi_Minh'), '2026-01-15T12:30:00.000Z');
  assert.equal(dateInputToIso('2026-01-15T07:30', 'America/New_York'), '2026-01-15T12:30:00.000Z');
  assert.equal(dateInputToIso('2026-07-15T08:30', 'America/New_York'), '2026-07-15T12:30:00.000Z');
  assert.match(dateTime('2026-01-15T12:30:00Z', 'Asia/Ho_Chi_Minh'), /19:30.*Asia\/Ho_Chi_Minh/);
});
test('DST skipped/repeated hours are rejected instead of silently changing deadlines', () => {
  assert.throws(() => dateInputToIso('2026-03-08T02:30', 'America/New_York'), /unavailable/);
  assert.throws(() => dateInputToIso('2026-11-01T01:30', 'America/New_York'), /ambiguous/);
  assert.equal(dateInputToIso('2026-11-01T03:30', 'America/New_York'), '2026-11-01T08:30:00.000Z');
});
test('invalid calendar dates/zones fail and empty display values remain usable', () => {
  assert.throws(() => dateInputToIso('2026-02-30T12:00', 'UTC'), /valid date/);
  assert.throws(() => dateInputToIso('2026-01-15T12:00', 'Invalid/Zone'));
  assert.equal(dateTime(null, 'UTC'), 'Not set');
  assert.equal(dateInput(null, 'UTC'), '');
});
