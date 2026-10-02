import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import {
  dkimPasses,
  fromAddress,
  GmailReauthRequiredError,
  hasPdfMagic,
  listMessagesFromSender,
  pickPdfAttachments,
  refreshAccessToken,
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

test('pickPdfAttachments: KBank รับ statement หลักและตัดคู่มือ channel_bankuse.pdf', () => {
  const payload: GmailPayload = {
    parts: [
      { mimeType: 'application/pdf', filename: 'STM_SA2319_01AUG26_31AUG26.pdf', body: { attachmentId: 'statement' } },
      { mimeType: 'application/pdf', filename: 'channel_bankuse.pdf', body: { attachmentId: 'guide' } },
    ],
  };

  assert.deepEqual(
    pickPdfAttachments(payload, '^STM_SA\\d{4}_\\d{2}[A-Z]{3}\\d{2}_\\d{2}[A-Z]{3}\\d{2}\\.pdf$'),
    [{ attachmentId: 'statement', filename: 'STM_SA2319_01AUG26_31AUG26.pdf' }],
  );
});

process.env.GOOGLE_CLIENT_ID ??= 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-client-secret';

/** แทน fetch ทั้งเทสต์แล้วคืนของจริงตอนจบ — คืน array ของ URL ที่ถูกเรียก */
function stubFetch(t: TestContext, respond: () => Response): string[] {
  const real = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    urls.push(String(input instanceof Request ? input.url : input));
    return respond();
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = real;
  });
  return urls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('refreshAccessToken: 400 invalid_grant → GmailReauthRequiredError', async (t) => {
  stubFetch(t, () => json(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }));
  await assert.rejects(refreshAccessToken('rt'), GmailReauthRequiredError);
});

for (const status of [500, 503]) {
  test(`refreshAccessToken: ${status} → Error ธรรมดา ไม่ใช่ reauth (ชั่วคราว)`, async (t) => {
    stubFetch(t, () => new Response('<html>Service Unavailable</html>', { status }));
    await assert.rejects(refreshAccessToken('rt'), (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.ok(!(e instanceof GmailReauthRequiredError));
      assert.match(e.message, new RegExp(String(status)));
      return true;
    });
  });
}

test('refreshAccessToken: 400 invalid_client → ไม่ใช่ reauth แต่บอกรหัส error ของ Google', async (t) => {
  stubFetch(t, () => json(400, { error: 'invalid_client' }));
  await assert.rejects(refreshAccessToken('secret-rt'), (e: unknown) => {
    assert.ok(e instanceof Error);
    assert.ok(!(e instanceof GmailReauthRequiredError));
    assert.match(e.message, /400 invalid_client/);
    assert.doesNotMatch(e.message, /secret-rt|test-client-secret/);
    return true;
  });
});

test('refreshAccessToken: สำเร็จ → คืน access_token', async (t) => {
  stubFetch(t, () => json(200, { access_token: 'at-123', expires_in: 3599 }));
  assert.equal(await refreshAccessToken('rt'), 'at-123');
});

test('refreshAccessToken: refresh ผ่านแต่ scope ไม่มี gmail.readonly (token เก่า) → GmailReauthRequiredError', async (t) => {
  stubFetch(t, () => json(200, { access_token: 'at-123', scope: 'openid https://www.googleapis.com/auth/userinfo.email' }));
  await assert.rejects(refreshAccessToken('rt'), GmailReauthRequiredError);
});

test('refreshAccessToken: scope มี gmail.readonly → คืน access_token', async (t) => {
  stubFetch(t, () => json(200, { access_token: 'at-123', scope: 'openid https://www.googleapis.com/auth/gmail.readonly' }));
  assert.equal(await refreshAccessToken('rt'), 'at-123');
});

test('listMessagesFromSender: มี after → q = from:x after:<epoch วินาที>', async (t) => {
  const urls = stubFetch(t, () => json(200, { messages: [{ id: 'm1' }] }));
  const after = new Date('2026-09-01T12:34:56.789Z');
  assert.deepEqual(await listMessagesFromSender('at', 'x@bank.com', after), ['m1']);
  assert.equal(new URL(urls[0]!).searchParams.get('q'), 'from:x@bank.com after:1788266096');
});

test('listMessagesFromSender: ไม่มี after → q = from:x อย่างเดียว', async (t) => {
  const urls = stubFetch(t, () => json(200, {}));
  assert.deepEqual(await listMessagesFromSender('at', 'x@bank.com'), []);
  assert.equal(new URL(urls[0]!).searchParams.get('q'), 'from:x@bank.com');
});
