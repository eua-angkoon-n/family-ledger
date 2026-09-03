import { parseScbStatement, type ScbStatement } from './scb.js';

/** registry กลาง — เพิ่มธนาคารใหม่ที่นี่ที่เดียว ไม่ต้องแก้ทั้ง api.ts และ worker.ts */
export const parsers = {
  scb: parseScbStatement,
} satisfies Record<string, (text: string) => ScbStatement>;

export type ParserKey = keyof typeof parsers;

/** ลำดับนี้คือลำดับที่ผู้ใช้เห็นในหน้าแอดมิน */
export const PARSER_KEYS = Object.keys(parsers) as ParserKey[];
