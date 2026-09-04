import type { ParsedStatement, ParsedTransaction } from './types.js';

const MONEY_RE = /[+-]?\d[\d,]*\.\d{2}/g;
const THAI_MONTHS: Record<string, number> = {
  มกราคม: 1,
  กุมภาพันธ์: 2,
  มีนาคม: 3,
  เมษายน: 4,
  พฤษภาคม: 5,
  มิถุนายน: 6,
  กรกฎาคม: 7,
  สิงหาคม: 8,
  กันยายน: 9,
  ตุลาคม: 10,
  พฤศจิกายน: 11,
  ธันวาคม: 12,
};

function moneySatang(value: string): number {
  const match = value.trim().match(/^([+-]?)(\d[\d,]*)\.(\d{2})$/);
  if (!match) throw new Error(`จำนวนเงิน SCB ไม่ถูกต้อง: ${value}`);
  const whole = Number(match[2]!.replaceAll(',', ''));
  const satang = whole * 100 + Number(match[3]);
  return match[1] === '-' ? -satang : satang;
}

function isoDate(day: number, month: number, year: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('วันที่ใน SCB statement ไม่ถูกต้อง');
  }
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function parseDate(value: string): string {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) throw new Error(`วันที่ SCB ไม่ถูกต้อง: ${value}`);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? (rawYear >= 70 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
  return isoDate(Number(match[1]), Number(match[2]), year);
}

function moneyTokens(value: string): RegExpMatchArray[] {
  return [...value.matchAll(MONEY_RE)];
}

function checksum(
  transactions: ParsedTransaction[],
  opening: number,
  closing: number,
  totalDebit: number,
  totalCredit: number,
): boolean {
  let balance = opening;
  let debits = 0;
  let credits = 0;
  let transitionsValid = true;
  for (const txn of transactions) {
    if (txn.direction === 'credit') {
      credits += txn.amountSatang;
      balance += txn.amountSatang;
    } else {
      debits += txn.amountSatang;
      balance -= txn.amountSatang;
    }
    if (balance !== txn.runningBalanceSatang) transitionsValid = false;
  }
  return transitionsValid && debits === totalDebit && credits === totalCredit && balance === closing;
}

function parseMonthly(text: string): ParsedStatement {
  const period = text.match(/เดือน\s+(\S+)\s+(\d{4})/);
  const account = text.match(/เลขที่บัญชี\s+([Xx\d-]+)/);
  if (!period || !account) throw new Error('ไม่พบเดือนหรือเลขบัญชีใน SCB รายเดือน');
  const month = THAI_MONTHS[period[1]!];
  if (!month) throw new Error(`เดือนไทยไม่รองรับ: ${period[1]}`);
  const year = Number(period[2]) - 543;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const transactions: ParsedTransaction[] = [];
  let totalDebit: number | null = null;
  let totalCredit: number | null = null;
  for (const line of text.split(/\r?\n/)) {
    const row = line.match(/^\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (row) {
      const tokens = moneyTokens(row[5]!);
      if (tokens.length < 2) throw new Error('แถว SCB รายเดือนมีจำนวนเงินไม่ครบ');
      const amountToken = tokens.at(-2)!;
      const balanceToken = tokens.at(-1)!;
      const signedAmount = moneySatang(amountToken[0]);
      // SCB ใส่ event เช่น ONBOARDING เป็นแถว 0.00 แต่ไม่นับใน TOTAL ITEMS และไม่ใช่ movement
      if (signedAmount === 0) continue;
      transactions.push({
        txnDate: parseDate(row[1]!),
        txnTime: row[2]!,
        description: row[5]!.slice(0, amountToken.index).trim(),
        channel: row[4]!,
        amountSatang: Math.abs(signedAmount),
        direction: signedAmount < 0 ? 'debit' : 'credit',
        runningBalanceSatang: moneySatang(balanceToken[0]),
      });
    } else if (/^\s*รวม\s/.test(line)) {
      const totals = moneyTokens(line);
      if (totals.length >= 2) {
        totalDebit = Math.abs(moneySatang(totals.at(-2)![0]));
        totalCredit = Math.abs(moneySatang(totals.at(-1)![0]));
      } else if (totals.length === 1) {
        const onlyTotal = moneySatang(totals[0]![0]);
        totalDebit = onlyTotal < 0 ? Math.abs(onlyTotal) : 0;
        totalCredit = onlyTotal > 0 ? onlyTotal : 0;
      }
    }
  }
  if (!transactions.length || totalDebit === null || totalCredit === null) throw new Error('ตาราง SCB รายเดือนไม่ครบ');
  const first = transactions[0]!;
  const opening = first.runningBalanceSatang + (first.direction === 'debit' ? first.amountSatang : -first.amountSatang);
  const closing = transactions.at(-1)!.runningBalanceSatang;
  return {
    layout: 'monthly',
    accountNumber: account[1]!,
    periodStart: isoDate(1, month, year),
    periodEnd: isoDate(lastDay, month, year),
    openingBalanceSatang: opening,
    closingBalanceSatang: closing,
    transactions,
    checksumValid: checksum(transactions, opening, closing, totalDebit, totalCredit),
  };
}

function parseOnDemand(text: string): ParsedStatement {
  const period = text.match(/วันที่\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  const account = text.match(/เลขที่บัญชี\s+([\d-]+)/);
  const openingMatch = text.match(/BALANCE BROUGHT FORWARD\)\s+([+-]?\d[\d,]*\.\d{2})/);
  if (!period || !account) throw new Error('หัว SCB ย้อนหลังไม่ครบ');
  const openingKnown = openingMatch != null;
  const opening = openingMatch ? moneySatang(openingMatch[1]!) : 0;
  const transactions: ParsedTransaction[] = [];
  let previousBalance = opening;
  let transitionsValid = true;
  let totalDebit: number | null = null;
  let totalCredit: number | null = null;

  for (const line of text.split(/\r?\n/)) {
    const row = line.match(/^\s*(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (row) {
      const descIndex = row[5]!.search(/\sDESC\s*:/);
      const numericPart = descIndex < 0 ? row[5]! : row[5]!.slice(0, descIndex);
      const tokens = moneyTokens(numericPart);
      if (tokens.length < 2) throw new Error('แถว SCB ย้อนหลังมีจำนวนเงินไม่ครบ');
      const amount = Math.abs(moneySatang(tokens.at(-2)![0]));
      const balance = moneySatang(tokens.at(-1)![0]);
      if (amount === 0 && balance === previousBalance) continue;
      const delta = balance - previousBalance;
      if (Math.abs(delta) !== amount || delta === 0) transitionsValid = false;
      transactions.push({
        txnDate: parseDate(row[1]!),
        txnTime: row[2]!,
        description: descIndex < 0 ? '' : row[5]!.slice(descIndex).replace(/^\s*DESC\s*:\s*/, '').trim(),
        channel: row[4]!,
        amountSatang: amount,
        direction: delta < 0 ? 'debit' : 'credit',
        runningBalanceSatang: balance,
      });
      previousBalance = balance;
    } else {
      const debit = line.match(/TOTAL AMOUNTS \(Debit\)\s+([\d,]+\.\d{2})/);
      const credit = line.match(/TOTAL AMOUNTS \(Credit\)\s+([\d,]+\.\d{2})/);
      if (debit) totalDebit = moneySatang(debit[1]!);
      if (credit) totalCredit = moneySatang(credit[1]!);
    }
  }
  if (totalDebit === null || totalCredit === null) throw new Error('ตาราง SCB ย้อนหลังไม่ครบ');
  const closing = transactions.at(-1)?.runningBalanceSatang ?? opening;
  return {
    layout: 'ondemand',
    accountNumber: account[1]!,
    periodStart: parseDate(period[1]!),
    periodEnd: parseDate(period[2]!),
    openingBalanceSatang: opening,
    closingBalanceSatang: closing,
    transactions,
    checksumValid: openingKnown && transitionsValid && checksum(transactions, opening, closing, totalDebit, totalCredit),
  };
}

function parseLegacyOnDemand(text: string): ParsedStatement {
  const header = text.match(/(\d{3}-\d{6}-\d)\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
  const openingMatch = text.match(/Balance brought forward\)\s+\**([+-]?\d[\d,]*\.\d{2})/i);
  if (!header) throw new Error('หัว SCB ย้อนหลังรุ่นเก่าไม่ครบ');
  const openingKnown = openingMatch != null;
  const opening = openingMatch ? moneySatang(openingMatch[1]!) : 0;
  const transactions: ParsedTransaction[] = [];
  let previousBalance = opening;
  let transitionsValid = true;
  let totalDebit: number | null = null;
  let totalCredit: number | null = null;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const row = line.match(/^\s*(\d{2}\/\d{2}\/\d{2})\s+(\S+\/\S+)\s+(.*)$/);
    if (row) {
      const descIndex = row[3]!.search(/\sDESC\s*:/);
      const numericPart = descIndex < 0 ? row[3]! : row[3]!.slice(0, descIndex);
      const tokens = moneyTokens(numericPart);
      if (tokens.length < 2) throw new Error('แถว SCB ย้อนหลังรุ่นเก่ามีจำนวนเงินไม่ครบ');
      const amount = Math.abs(moneySatang(tokens.at(-2)![0]));
      const balance = moneySatang(tokens.at(-1)![0]);
      if (amount === 0 && balance === previousBalance) continue;
      const delta = balance - previousBalance;
      if (Math.abs(delta) !== amount || delta === 0) transitionsValid = false;
      // เวลาอยู่คนละบรรทัดกับวันที่ในรูปแบบเก่า เช่น "17:42 NOTE : -"
      const timeMatch = lines[i + 1]?.match(/^\s*(\d{2}:\d{2})\s+NOTE\s*:/);
      transactions.push({
        txnDate: parseDate(row[1]!),
        txnTime: timeMatch ? timeMatch[1]! : null,
        description: descIndex < 0 ? '' : row[3]!.slice(descIndex).replace(/^\s*DESC\s*:\s*/, '').trim(),
        channel: row[2]!.split('/').at(-1)!,
        amountSatang: amount,
        direction: delta < 0 ? 'debit' : 'credit',
        runningBalanceSatang: balance,
      });
      previousBalance = balance;
    } else {
      const totals = line.match(/^\s*Total amount\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i);
      if (totals) {
        totalDebit = moneySatang(totals[1]!);
        totalCredit = moneySatang(totals[2]!);
      }
    }
  }
  if (totalDebit === null || totalCredit === null) {
    if (!/No data/i.test(text)) throw new Error('ตาราง SCB ย้อนหลังรุ่นเก่าไม่ครบ');
    totalDebit = 0;
    totalCredit = 0;
  }
  const closing = transactions.at(-1)?.runningBalanceSatang ?? opening;
  return {
    layout: 'ondemand',
    accountNumber: header[1]!,
    periodStart: parseDate(header[2]!),
    periodEnd: parseDate(header[3]!),
    openingBalanceSatang: opening,
    closingBalanceSatang: closing,
    transactions,
    checksumValid: openingKnown && transitionsValid && checksum(transactions, opening, closing, totalDebit, totalCredit),
  };
}

export function parseScbStatement(text: string): ParsedStatement {
  if (text.includes('ACCOUNT STATEMENT WITH NOTES')) return parseLegacyOnDemand(text);
  if (text.includes('STATEMENT OF SAVING ACCOUNT') || text.includes('BALANCE BROUGHT FORWARD')) return parseOnDemand(text);
  return parseMonthly(text);
}
