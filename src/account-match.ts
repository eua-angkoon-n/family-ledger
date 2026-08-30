/**
 * จับคู่เลขบัญชีที่ statement ปิดบังไว้ กับเลขเต็มที่ผู้ใช้กรอก
 *
 * K PLUS ปิดบังแบบ `xxx-x-x6231-x` — **หลักท้ายก็ถูกปิด** ดังนั้นเทียบแบบ suffix ใช้ไม่ได้
 * (ตัวเลขที่เห็น `6231` ไม่ใช่ท้ายของ `1234562317`) ต้องเทียบตามตำแหน่ง
 */
function visible(masked: string): string {
  return masked.replace(/[^0-9xX*]/g, '').toLowerCase().replace(/\*/g, 'x');
}

function digitsOnly(full: string): string {
  return full.replace(/\D/g, '');
}

export function accountMatches(fullAccountNumber: string, maskedFromPdf: string): boolean {
  const full = digitsOnly(fullAccountNumber);
  const mask = visible(maskedFromPdf);
  if (!full || !mask) return false;

  if (mask.length === full.length) {
    // เทียบตำแหน่งต่อตำแหน่ง เฉพาะหลักที่ statement เปิดให้เห็น
    for (let i = 0; i < mask.length; i++) {
      const m = mask[i]!;
      if (m !== 'x' && m !== full[i]) return false;
    }
    return true;
  }

  // ความยาวไม่เท่ากัน (เช่น `****1234`) — ตกมาที่เทียบท้าย
  const tail = mask.replace(/x/g, '');
  return tail.length >= 4 && full.endsWith(tail);
}

/** กำกวมคือปฏิเสธ — บน money path การเดาว่าเป็นบัญชีไหนแพงกว่าการไม่ import */
export function resolveAccount<T extends { account_number: string }>(
  accounts: readonly T[],
  maskedFromPdf: string,
): T | null {
  const hits = accounts.filter((a) => accountMatches(a.account_number, maskedFromPdf));
  return hits.length === 1 ? hits[0]! : null;
}

/** เดาโทเค็นที่หน้าตาเหมือนเลขบัญชีที่ถูกปิดบัง (มีทั้งเลขและ x/X/*) จากข้อความ statement ที่สกัดมา */
export function findMaskedAccountCandidates(text: string): string[] {
  const tokens = text.match(/[0-9xX*][0-9xX*-]{4,}[0-9xX*]/g) ?? [];
  return tokens.filter((t) => /[xX*]/.test(t) && /\d/.test(t));
}
