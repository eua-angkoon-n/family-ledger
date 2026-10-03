// คู่มือระบบ (web/src/guide/guides.ts) อ้าง element ในหน้าเว็บด้วย CSS selector และขั้นที่หา
// element ไม่เจอจะถูก "ข้ามเงียบ ๆ" ตอนรัน — ซึ่งดีต่อผู้ใช้ (tour ไม่พัง) แต่แย่ต่อคนดูแล
// เพราะเปลี่ยนชื่อ id/aria-label แล้วคู่มือจะค่อย ๆ หายไปโดยไม่มีอะไรฟ้อง
//
// environment นี้ไม่มี browser automation จึงตรวจไม่ได้ว่าไฮไลต์ไปตกที่ถูกตัวจริง แต่ตรวจได้ว่า
// selector ที่อ้างถึงยังมีอยู่ใน source — เป็นเทสต์ที่จับ regression คลาสที่เกิดจริงบ่อยที่สุด
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { isPageEnabled, TAX_PAGES_ENABLED } from '../web/src/features.js';
import { GUIDES, HELP_GROUPS, guideForPath, helpSections, highlightSegments } from '../web/src/guide/guides.js';

const WEB_SRC = join(import.meta.dirname, '..', 'web', 'src');

const sources = readdirSync(WEB_SRC, { recursive: true, encoding: 'utf8' })
  .filter((p) => p.endsWith('.tsx'))
  .map((p) => readFileSync(join(WEB_SRC, p), 'utf8'))
  .join('\n');

/** แปลง selector ที่คู่มือใช้ → ข้อความที่ต้องเจอใน JSX (รองรับเฉพาะ 3 รูปแบบที่ guides.ts ใช้จริง) */
function jsxNeedle(selector: string): string {
  const attr = /^\[([a-z-]+)="(.+)"\]$/.exec(selector);
  if (attr) return `${attr[1]}="${attr[2]}"`;
  const id = /^#([\w-]+)$/.exec(selector);
  if (id) return `id="${id[1]}"`;
  throw new Error(`selector รูปแบบใหม่ที่เทสต์นี้ยังไม่รองรับ: ${selector}`);
}

test('คู่มือ: ทุก selector ที่อ้างถึงยังมีอยู่ใน web/src', () => {
  for (const [path, guide] of Object.entries(GUIDES)) {
    for (const step of guide.steps) {
      if (!step.selector) continue;
      assert.ok(
        sources.includes(jsxNeedle(step.selector)),
        `คู่มือของ ${path} ขั้น "${step.title}" ชี้ไปที่ ${step.selector} ซึ่งหาไม่เจอใน web/src แล้ว`,
      );
    }
  }
});

test('คู่มือ: ทุกหน้ามีอย่างน้อยหนึ่งขั้นที่ไม่ต้องพึ่ง selector', () => {
  // กันเคสที่หน้ายังไม่มีข้อมูล (ตารางเป็น EmptyState) แล้วทุกขั้นถูกกรองออกจนไม่เหลืออะไรให้อ่าน
  for (const [path, guide] of Object.entries(GUIDES)) {
    assert.ok(
      guide.steps.some((s) => !s.selector),
      `คู่มือของ ${path} ต้องมีขั้นแบบการ์ดกลางจอ (ไม่มี selector) อย่างน้อยหนึ่งขั้น`,
    );
  }
});

test('คู่มือ: ทุก path มี route จริงใน App.tsx และหน้า /help แสดงครบทุกหน้า', () => {
  const app = readFileSync(join(WEB_SRC, 'App.tsx'), 'utf8');
  for (const path of Object.keys(GUIDES)) {
    assert.ok(app.includes(`path="${path}"`), `GUIDES มี ${path} แต่ App.tsx ไม่มี route นี้`);
  }
  const grouped = HELP_GROUPS.flatMap((g) => g.paths);
  assert.deepEqual(
    [...grouped].sort(),
    Object.keys(GUIDES).sort(),
    'HELP_GROUPS ต้องมีทุก path ของ GUIDES ครบและไม่ซ้ำ ไม่งั้นหน้า /help จะตกคู่มือของบางหน้าไป',
  );
});

const shownPaths = (isAdmin: boolean, query?: string) => helpSections(isAdmin, query).flatMap((g) => g.sections.map((s) => s.path));

test('/help: แอดมินเห็นทุกหน้าที่เปิดอยู่ คนอื่นไม่เห็นหน้าตั้งค่าและขั้นของแอดมิน', () => {
  assert.deepEqual(shownPaths(true).sort(), Object.keys(GUIDES).filter(isPageEnabled).sort());
  assert.deepEqual(shownPaths(false).sort(), Object.keys(GUIDES).filter((p) => isPageEnabled(p) && p !== '/settings').sort());
  assert.ok(!helpSections(false).some((g) => g.id === 'admin'), 'กลุ่ม "ผู้ดูแล" ต้องไม่ขึ้นให้คนที่ไม่ใช่แอดมิน');
  const steps = (isAdmin: boolean) => helpSections(isAdmin).flatMap((g) => g.sections.flatMap((s) => s.steps));
  assert.ok(steps(true).some((s) => s.adminOnly));
  assert.ok(!steps(false).some((s) => s.adminOnly));
  // tour ไม่รู้ว่าใครเป็นแอดมิน — ขั้น adminOnly ถูกข้ามได้เพราะชี้ element ที่ขึ้นเฉพาะแอดมินเท่านั้น ไม่มี selector = รั่วให้ทุกคน
  for (const [path, guide] of Object.entries(GUIDES)) {
    for (const step of guide.steps) assert.ok(!step.adminOnly || step.selector, `${path} ขั้น "${step.title}" เป็น adminOnly แต่ไม่มี selector`);
  }
});

test('/help: ค้นหาไม่สนตัวพิมพ์ ค้นข้าม ** ได้ และไม่พบ = ว่าง', () => {
  // ชื่อหน้าตรง = ทุกขั้นของหน้านั้น
  const planning = helpSections(true, 'วางแผนรายเดือน').flatMap((g) => g.sections).find((s) => s.path === '/planning');
  assert.equal(planning?.steps.length, GUIDES['/planning']!.steps.length);
  // ตรงเฉพาะในเนื้อหาขั้น = เหลือเฉพาะขั้นนั้น · "กับ**เดือนอนาคต**" ใน guides.ts
  const rule = helpSections(true, 'กับเดือนอนาคต').flatMap((g) => g.sections);
  assert.deepEqual(rule.map((s) => [s.path, s.steps.length]), [['/planning', 1]]);
  assert.ok(shownPaths(false, 'gmail').includes('/accounts'), 'ค้น "gmail" ต้องเจอ "Gmail"');
  // คำที่มีเฉพาะในหน้าตั้งค่า: แอดมินเจอ คนอื่นไม่เจอ
  assert.deepEqual(shownPaths(true, 'DKIM'), ['/settings']);
  assert.deepEqual(shownPaths(false, 'DKIM'), []);
  assert.deepEqual(helpSections(true, 'ไม่มีคำนี้ในคู่มือแน่นอน'), []);
});

test('คู่มือ: guideForPath ตัดเหลือ segment แรกเหมือน activeNavPath', () => {
  assert.equal(guideForPath('/installments/12'), GUIDES['/installments']);
  assert.equal(guideForPath('/transactions'), GUIDES['/transactions']);
  // /help ตั้งใจไม่มีคู่มือของตัวเอง (มันคือคู่มืออยู่แล้ว) ปุ่มคู่มือจึงไม่ขึ้นที่นั่น
  assert.equal(guideForPath('/help'), undefined);
  assert.equal(guideForPath('/'), undefined);
});

test('features: ปิดหน้าภาษีแล้วต้องหายจาก /help และหน้าอื่นยังอยู่ครบ', () => {
  const shown = shownPaths(true);
  for (const path of ['/tax', '/tax-documents']) {
    assert.equal(shown.includes(path), TAX_PAGES_ENABLED, `${path} ต้องขึ้นใน /help ก็ต่อเมื่อ TAX_PAGES_ENABLED`);
  }
  assert.ok(shown.includes('/dashboard') && shown.includes('/student-loan'));
});

test('/help: ไฮไลต์คำค้นเทียบแบบเดียวกับการค้น — ไม่สนตัวพิมพ์ คร่อมขอบ ** ได้ ตัวหนายังอยู่', () => {
  const show = (text: string, q: string) =>
    highlightSegments(text, q).map((s) => `${s.bold ? 'B' : ''}${s.hit ? 'H' : ''}:${s.text}`);
  assert.deepEqual(show('ต่อ Gmail ใหม่', 'gmail'), [':ต่อ ', 'H:Gmail', ': ใหม่']);
  assert.deepEqual(show('ใช้กับ**เดือนอนาคต**เท่านั้น', 'กับเดือน'), [':ใช้', 'H:กับ', 'BH:เดือน', 'B:อนาคต', ':เท่านั้น']);
  assert.deepEqual(show('a**b**a', 'a'), ['H:a', 'B:b', 'H:a']);
  // ไม่มีคำค้น = เหมือน Emphasis
  assert.deepEqual(show('กด **บันทึก**', ''), [':กด ', 'B:บันทึก']);
});
