export type ParsedTransaction = {
  txnDate: string;
  txnTime: string | null;
  description: string;
  channel: string;
  amountSatang: number;
  direction: 'credit' | 'debit';
  runningBalanceSatang: number;
};

export type ParsedStatement = {
  layout: 'monthly' | 'ondemand';
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  openingBalanceSatang: number;
  closingBalanceSatang: number;
  transactions: ParsedTransaction[];
  checksumValid: boolean;
  // ไม่ผ่าน gate เพราะไฟล์ว่าง (ไม่มีรายการ ยอดรวม 0 และไม่พิมพ์ยอดยกมา) — ไม่มีอะไรให้นำเข้าหรือให้ใครแก้
  checksumReason?: 'no_data';
};
