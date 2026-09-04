import type { ParsedStatement, ParsedTransaction } from './types.js';

const MONEY_RE = /[+-]?\d[\d,]*\.\d{2}/g;
const TRANSACTION_RE = /^\s*(\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.*)$/;
const CARRY_RE = /^\s*(\d{2}-\d{2}-\d{2})\s+ยอดยกมา\s+([+-]?\d[\d,]*\.\d{2})\s*$/;

type Summary = { count: number; amountSatang: number };
type DraftTransaction = Omit<ParsedTransaction, 'direction' | 'description' | 'channel'> & {
  item: string;
  detailParts: string[];
  channelParts: string[];
};

function moneySatang(value: string): number {
  const match = value.trim().match(/^([+-]?)(\d[\d,]*)\.(\d{2})$/);
  if (!match) throw new Error(`จำนวนเงิน KBank ไม่ถูกต้อง: ${value}`);
  const amount = Number(match[2]!.replaceAll(',', '')) * 100 + Number(match[3]);
  if (!Number.isSafeInteger(amount)) throw new Error(`จำนวนเงิน KBank ใหญ่เกินรองรับ: ${value}`);
  return match[1] === '-' ? -amount : amount;
}

function isoDate(day: number, month: number, year: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('วันที่ใน KBank statement ไม่ถูกต้อง');
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function parseFullDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) throw new Error(`วันที่ KBank ไม่ถูกต้อง: ${value}`);
  return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

function parseRowDate(value: string, periodStart: string, periodEnd: string): string {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`วันที่รายการ KBank ไม่ถูกต้อง: ${value}`);
  const century = Math.floor(Number(periodStart.slice(0, 4)) / 100) * 100;
  const years = [century - 100, century, century + 100].map((base) => base + Number(match[3]));
  const candidates = years.map((year) => isoDate(Number(match[1]), Number(match[2]), year));
  const inPeriod = candidates.filter((date) => date >= periodStart && date <= periodEnd);
  if (inPeriod.length !== 1) throw new Error(`วันที่รายการ KBank อยู่นอกช่วง statement: ${value}`);
  return inPeriod[0]!;
}

function parseSummary(text: string, label: string): Summary {
  const match = text.match(new RegExp(`${label}\\s+(\\d+)\\s+รายการ\\s+([+-]?\\d[\\d,]*\\.\\d{2})`));
  if (!match) throw new Error(`ไม่พบสรุป ${label} ใน KBank statement`);
  return { count: Number(match[1]), amountSatang: Math.abs(moneySatang(match[2]!)) };
}

function isBoilerplate(value: string): boolean {
  return /^(?:KBPDF|ออกโดย|สอบถามข้อมูลเพิ่มเติม|www\.|หน้าที่ \(PAGE\/OF\))/.test(value);
}

function normalize(parts: string[]): string {
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function splitMainFields(item: string, tail: string): [channel: string, details: string] {
  const detailPrefix: Record<string, string> = {
    'รับโอนเงิน': 'จาก ',
    'โอนเงิน': 'โอนไป ',
    'หักบัญชี': 'โอนไป ',
    'ชำระเงิน': 'เพื่อชำระ ',
    'ชำระด้วยบัตรเดบิต': 'รหัสอ้างอิง ',
    'รายการแก้ไข': 'รหัสอ้างอิง ',
    'ถอนเงินสด': 'รหัสอ้างอิง ',
  };
  const prefix = detailPrefix[item];
  const detailIndex = prefix ? tail.indexOf(prefix) : -1;
  if (detailIndex > 0) return [tail.slice(0, detailIndex).trim(), tail.slice(detailIndex).trim()];
  const [channel = '', details = ''] = tail.split(/\s{2,}/, 2);
  return [channel, details];
}

export function parseKbankStatement(text: string): ParsedStatement {
  if (!text.includes('KBPDF')) throw new Error('ไม่ใช่ KBank statement บัญชีออมทรัพย์');

  const account = text.match(/เลขที่บัญชีเงินฝาก\s+(\d{3}-\d-\d{5}-\d)\b/);
  const period = text.match(/รอบระหว่างวันที่\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  const closing = text.match(/ยอดยกไป\s+([+-]?\d[\d,]*\.\d{2})/);
  if (!account || !period || !closing) throw new Error('หัว KBank statement ไม่ครบ');

  const periodStart = parseFullDate(period[1]!);
  const periodEnd = parseFullDate(period[2]!);
  if (periodStart > periodEnd) throw new Error('ช่วงวันที่ KBank statement ไม่ถูกต้อง');

  const layout = /ออกโดย\s+PERIODIC/.test(text)
    ? 'monthly'
    : /ออกโดย\s+(?:K PLUS|777)\b/.test(text)
      ? 'ondemand'
      : null;
  if (!layout) throw new Error('ไม่พบชนิด KBank statement');

  const debitSummary = parseSummary(text, 'รวมถอนเงิน');
  const creditSummary = parseSummary(text, 'รวมฝากเงิน');
  const closingBalanceSatang = moneySatang(closing[1]!);
  const transactions: ParsedTransaction[] = [];
  let draft: DraftTransaction | null = null;
  let openingBalanceSatang: number | null = null;
  let previousBalance: number | null = null;
  let debitTotal = 0;
  let creditTotal = 0;
  let debitCount = 0;
  let creditCount = 0;
  let transitionsValid = true;
  let carriesValid = true;
  let carryRequired = true;

  function finishDraft(): void {
    if (!draft) return;
    if (previousBalance === null) throw new Error('ไม่พบยอดยกมาใน KBank statement');
    const delta = draft.runningBalanceSatang - previousBalance;
    const direction = delta > 0 ? 'credit' : 'debit';
    if (delta === 0 || Math.abs(delta) !== draft.amountSatang) transitionsValid = false;
    if (direction === 'credit') {
      creditTotal += draft.amountSatang;
      creditCount++;
    } else {
      debitTotal += draft.amountSatang;
      debitCount++;
    }
    const details = normalize(draft.detailParts);
    transactions.push({
      txnDate: draft.txnDate,
      txnTime: draft.txnTime,
      description: details ? `${draft.item}: ${details}` : draft.item,
      channel: normalize(draft.channelParts),
      amountSatang: draft.amountSatang,
      direction,
      runningBalanceSatang: draft.runningBalanceSatang,
    });
    previousBalance = draft.runningBalanceSatang;
    draft = null;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const pageBreak = rawLine.includes('\f');
    const line = rawLine.replaceAll('\f', '');
    if (pageBreak) {
      finishDraft();
      carryRequired = true;
    }

    const carry = line.match(CARRY_RE);
    if (carry) {
      finishDraft();
      parseRowDate(carry[1]!, periodStart, periodEnd);
      const balance = moneySatang(carry[2]!);
      if (openingBalanceSatang === null) {
        openingBalanceSatang = balance;
        previousBalance = balance;
      } else if (balance !== previousBalance) {
        carriesValid = false;
      }
      carryRequired = false;
      continue;
    }

    const row = line.match(TRANSACTION_RE);
    if (row) {
      finishDraft();
      if (carryRequired) carriesValid = false;
      carryRequired = false;
      const rest = row[3]!;
      const money = [...rest.matchAll(MONEY_RE)];
      if (money.length < 2) throw new Error('แถว KBank มีจำนวนเงินไม่ครบ');
      const amount = money[0]!;
      const balance = money[1]!;
      const item = rest.slice(0, amount.index).trim();
      if (!item) throw new Error('แถว KBank ไม่มีประเภทรายการ');
      const tail = rest.slice(balance.index! + balance[0].length).trim();
      const [channel, details] = splitMainFields(item, tail);
      draft = {
        txnDate: parseRowDate(row[1]!, periodStart, periodEnd),
        txnTime: row[2]!,
        item,
        amountSatang: Math.abs(moneySatang(amount[0])),
        runningBalanceSatang: moneySatang(balance[0]),
        channelParts: channel ? [channel] : [],
        detailParts: details ? [details] : [],
      };
      continue;
    }

    if (!draft) continue;
    const value = line.trim();
    if (!value || isBoilerplate(value)) continue;
    const indent = line.search(/\S/);
    if (indent >= 145) draft.detailParts.push(value);
    else if (indent >= 115) draft.channelParts.push(value);
  }
  finishDraft();

  if (openingBalanceSatang === null) throw new Error('ไม่พบยอดยกมาใน KBank statement');
  const checksumValid =
    transitionsValid &&
    carriesValid &&
    debitCount === debitSummary.count &&
    creditCount === creditSummary.count &&
    debitTotal === debitSummary.amountSatang &&
    creditTotal === creditSummary.amountSatang &&
    previousBalance === closingBalanceSatang &&
    openingBalanceSatang + creditTotal - debitTotal === closingBalanceSatang;

  return {
    layout,
    accountNumber: account[1]!,
    periodStart,
    periodEnd,
    openingBalanceSatang,
    closingBalanceSatang,
    transactions,
    checksumValid,
  };
}
