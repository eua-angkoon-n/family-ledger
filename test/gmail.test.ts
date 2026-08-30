import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dkimPasses,
  fromAddress,
  hasPdfMagic,
  pickPdfAttachments,
  type GmailHeader,
  type GmailPayload,
} from '../src/gmail.js';

const DOMAIN = 'kasikornbank.com';

function h(name: string, value: string): GmailHeader {
  return { name, value };
}

const REAL_AR = h(
  'Authentication-Results',
  'mx.google.com;\n       dkim=pass header.i=@kasikornbank.com header.s=selector1 header.b=AbCdEf123;\n' +
    '       spf=pass (google.com: domain of noreply@kasikornbank.com designates 1.2.3.4 as permitted sender) smtp.mailfrom=noreply@kasikornbank.com;\n' +
    '       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=kasikornbank.com',
);

test('AR ของ Gmail จริง 1 อัน dkim=pass header.i ตรงโดเมน → ผ่าน', () => {
  assert.equal(dkimPasses([REAL_AR], DOMAIN), true);
});

test('ผู้ส่งใส่ Authentication-Results ปลอมมาเอง กลายเป็น 2 อันที่อ้าง mx.google.com → ไม่ผ่าน', () => {
  const fakeAR = h('Authentication-Results', 'mx.google.com; dkim=pass header.i=@kasikornbank.com header.s=x header.b=y');
  assert.equal(dkimPasses([REAL_AR, fakeAR], DOMAIN), false);
});

test('AR ปลอม authserv-id evil.com ที่มี (mx.google.com) ในคอมเมนต์ + AR จริง 1 อัน → ผ่าน (นับผิดไม่ได้)', () => {
  const spoofAR = h(
    'Authentication-Results',
    'evil.com (mx.google.com); dkim=pass header.i=@kasikornbank.com header.s=x header.b=y',
  );
  assert.equal(dkimPasses([spoofAR, REAL_AR], DOMAIN), true);
});

test('มีแต่ ARC-Authentication-Results → ไม่ผ่าน', () => {
  const arc = h('ARC-Authentication-Results', 'i=1; mx.google.com; dkim=pass header.i=@kasikornbank.com');
  assert.equal(dkimPasses([arc], DOMAIN), false);
});

test('dkim=fail → ไม่ผ่าน', () => {
  const fail = h('Authentication-Results', 'mx.google.com; dkim=fail header.i=@kasikornbank.com header.s=x header.b=y');
  assert.equal(dkimPasses([fail], DOMAIN), false);
});

test('header.i โดเมนไม่ตรง (evilkasikornbank.com) → ไม่ผ่าน', () => {
  const spoofDomain = h(
    'Authentication-Results',
    'mx.google.com; dkim=pass header.i=@evilkasikornbank.com header.s=x header.b=y',
  );
  assert.equal(dkimPasses([spoofDomain], DOMAIN), false);
});

test('header.i มี local part นำหน้า (noreply@kasikornbank.com) โดเมนถูก → ผ่าน', () => {
  const localPart = h(
    'Authentication-Results',
    'mx.google.com; dkim=pass header.i=noreply@kasikornbank.com header.s=x header.b=y',
  );
  assert.equal(dkimPasses([localPart], DOMAIN), true);
});

test('dkim= หลายอันในหัวเดียว อันแรก fail โดเมนผิด อันหลัง pass โดเมนถูก → ผ่าน', () => {
  const multi = h(
    'Authentication-Results',
    'mx.google.com; dkim=fail header.i=@evil.com header.s=a header.b=b; dkim=pass header.i=@kasikornbank.com header.s=c header.b=d',
  );
  assert.equal(dkimPasses([multi], DOMAIN), true);
});

test('fromAddress ดึง addr-spec ออกจาก display name แล้ว lowercase', () => {
  assert.equal(fromAddress('"KPLUS" <KPLUS@kasikornbank.com>'), 'kplus@kasikornbank.com');
});

const PDF_PATTERN = '\\.pdf$';

test('pickPdfAttachments: SCB ส่ง PDF เป็น application/octet-stream → รับทุกไฟล์ที่ชื่อตรง', () => {
  const payload: GmailPayload = {
    parts: [
      { mimeType: 'image/x-png', filename: 'logo.png', body: { attachmentId: 'logo' } },
      { mimeType: 'application/octet-stream', filename: 'AcctSt_Jan26.pdf', body: { attachmentId: 'jan' } },
      { mimeType: 'application/octet-stream', filename: 'AcctSt_Feb26.pdf', body: { attachmentId: 'feb' } },
    ],
  };

  assert.deepEqual(pickPdfAttachments(payload, '^AcctSt_[A-Za-z]{3}\\d{2}\\.pdf$'), [
    { attachmentId: 'jan', filename: 'AcctSt_Jan26.pdf' },
    { attachmentId: 'feb', filename: 'AcctSt_Feb26.pdf' },
  ]);
});

test('hasPdfMagic: octet-stream ต้องมีลายเซ็น PDF ก่อนบันทึก', () => {
  assert.equal(hasPdfMagic(Buffer.from('%PDF-1.5\n')), true);
  assert.equal(hasPdfMagic(Buffer.from('<html>not a pdf</html>')), false);
});

test('pickPdfAttachments: โลโก้ inline มาก่อน PDF → ได้เฉพาะ PDF', () => {
  const payload: GmailPayload = {
    parts: [
      { mimeType: 'image/gif', filename: 'logo.gif', body: { attachmentId: 'a1' } },
      { mimeType: 'application/pdf', filename: 'statement_202601.pdf', body: { attachmentId: 'a2' } },
    ],
  };
  assert.deepEqual(pickPdfAttachments(payload, PDF_PATTERN), [{ attachmentId: 'a2', filename: 'statement_202601.pdf' }]);
});

test('pickPdfAttachments: ชื่อไฟล์ไม่ตรง pattern → ไม่ได้', () => {
  const payload: GmailPayload = {
    parts: [{ mimeType: 'application/pdf', filename: 'random.pdf', body: { attachmentId: 'a1' } }],
  };
  assert.deepEqual(pickPdfAttachments(payload, '^statement_\\d+\\.pdf$'), []);
});

test('pickPdfAttachments: multipart ซ้อนกันหลายชั้น → เจอไฟล์ข้างใน', () => {
  const payload: GmailPayload = {
    parts: [
      {
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/plain', filename: '' },
          { mimeType: 'application/pdf', filename: 'statement.pdf', body: { attachmentId: 'nested1' } },
        ],
      },
    ],
  };
  assert.deepEqual(pickPdfAttachments(payload, PDF_PATTERN), [{ attachmentId: 'nested1', filename: 'statement.pdf' }]);
});
