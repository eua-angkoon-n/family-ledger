import assert from 'node:assert/strict';
import test from 'node:test';
import { PARSER_KEYS, parsers } from '../src/parsers/index.js';

test('parser registry เปิดใช้ SCB และ KBank', () => {
  assert.deepEqual(PARSER_KEYS, ['scb', 'kbank']);
  assert.equal(typeof parsers.scb, 'function');
  assert.equal(typeof parsers.kbank, 'function');
});
