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
};
