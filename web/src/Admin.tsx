import { useEffect, useState } from 'react';
import { del, patch, post, req, type Bank, type User } from './api.js';

const EMPTY = {
  name: '',
  sender_email: '',
  sender_domain: '',
  subject_monthly: '',
  subject_ondemand: '',
  attachment_filename_pattern: '\\.pdf$',
  parser_key: 'kbank',
};

function Banks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const reload = () => { req<Bank[]>('/api/banks').then(setBanks); };
  useEffect(reload, []);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <h2>เพิ่มธนาคาร</h2>
      <p className="muted">
        อีเมลผู้ส่งคืออีเมล<strong>ของธนาคาร</strong> ที่ส่ง statement มาให้ ไม่ใช่กล่องของผู้ใช้ —
        โดเมนผู้ส่งใช้ตรวจ DKIM ถ้ากรอกผิด ระบบจะปฏิเสธอีเมลจริงทั้งหมด
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          post('/api/banks', form)
            .then(() => { setForm(EMPTY); reload(); })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <div className="grid">
          <label><span>ชื่อธนาคาร</span><input value={form.name} onChange={set('name')} required /></label>
          <label><span>อีเมลผู้ส่งของธนาคาร</span><input value={form.sender_email} onChange={set('sender_email')} required placeholder="statement@kasikornbank.com" /></label>
          <label><span>โดเมนผู้ส่ง (ตรวจ DKIM)</span><input value={form.sender_domain} onChange={set('sender_domain')} required placeholder="kasikornbank.com" /></label>
          <label><span>หัวข้ออีเมล statement รายเดือน (regex)</span><input value={form.subject_monthly} onChange={set('subject_monthly')} required /></label>
          <label><span>หัวข้ออีเมล statement ที่ผู้ใช้ขอเอง (regex)</span><input value={form.subject_ondemand} onChange={set('subject_ondemand')} required /></label>
          <label><span>ชื่อไฟล์แนบ (regex)</span><input value={form.attachment_filename_pattern} onChange={set('attachment_filename_pattern')} required /></label>
          <label>
            <span>ตัวแกะข้อมูล</span>
            <select value={form.parser_key} onChange={set('parser_key')}>
              <option value="kbank">kbank</option>
            </select>
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit">บันทึก</button>
      </form>

      <h2>ธนาคารที่รองรับ</h2>
      <table>
        <thead>
          <tr><th>ชื่อ</th><th>ผู้ส่ง / โดเมน</th><th>หัวข้อรายเดือน / ขอเอง</th><th>สถานะ</th><th /></tr>
        </thead>
        <tbody>
          {banks.map((b) => (
            <tr key={b.id}>
              <td>{b.name}<br /><code>{b.parser_key}</code></td>
              <td><code>{b.sender_email}</code><br /><code>{b.sender_domain}</code></td>
              <td><code>{b.subject_monthly}</code><br /><code>{b.subject_ondemand}</code></td>
              <td>
                <button onClick={() => patch(`/api/banks/${b.id}`, { is_active: !b.is_active }).then(reload)}>
                  {b.is_active ? 'เปิดใช้' : 'ปิดอยู่'}
                </button>
              </td>
              <td>
                <button className="danger" onClick={() => confirm(`ลบธนาคาร “${b.name}”?`) && del(`/api/banks/${b.id}`).then(reload).catch((e: Error) => alert(e.message))}>
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const reload = () => { req<User[]>('/api/admin/users').then(setUsers); };
  useEffect(reload, []);

  const setStatus = (u: User, status: User['status']) => {
    if (status === 'rejected' && !confirm(`ปฏิเสธ ${u.email}? สิทธิ์เข้าถึง Gmail จะถูกยกเลิกที่ Google และลบทิ้ง`)) return;
    patch(`/api/admin/users/${u.id}`, { status }).then(reload).catch((e: Error) => alert(e.message));
  };

  return (
    <>
      <h2>ผู้ใช้</h2>
      <table>
        <thead><tr><th>อีเมล</th><th>ชื่อ</th><th>สถานะ</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><code>{u.email}</code>{u.is_admin && ' (แอดมิน)'}</td>
              <td>{u.display_name}</td>
              <td>{{ pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ' }[u.status]}</td>
              <td>
                {u.status !== 'approved' && <button onClick={() => setStatus(u, 'approved')}>อนุมัติ</button>}{' '}
                {u.status !== 'rejected' && <button className="danger" onClick={() => setStatus(u, 'rejected')}>ปฏิเสธ</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default { Banks, Users };
