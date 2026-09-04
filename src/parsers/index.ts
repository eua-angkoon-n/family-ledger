import { parseKbankStatement } from './kbank.js';
import { parseScbStatement } from './scb.js';
import type { ParsedStatement } from './types.js';

/** registry กลาง — เพิ่มธนาคารใหม่ที่นี่ที่เดียว ไม่ต้องแก้ทั้ง api.ts และ worker.ts */
export const parsers = {
  scb: parseScbStatement,
  kbank: parseKbankStatement,
} satisfies Record<string, (text: string) => ParsedStatement>;

export type { ParsedStatement, ParsedTransaction } from './types.js';

export type ParserKey = keyof typeof parsers;

/** ลำดับนี้คือลำดับที่ผู้ใช้เห็นในหน้าแอดมิน */
export const PARSER_KEYS = Object.keys(parsers) as ParserKey[];
