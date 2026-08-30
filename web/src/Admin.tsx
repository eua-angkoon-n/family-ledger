import { useEffect, useState } from 'react';
import { del, patch, post, req, type Bank, type User } from './api.js';
import Modal from './Modal.js';

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const reload = () => { req<Bank[]>('/api/banks').then(setBanks).catch((e: Error) => setError(e.message)); };
  useEffect(reload, []);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (bank: Bank) => {
    setEditingId(bank.id);
    setForm({
      name: bank.name,
      sender_email: bank.sender_email,
      sender_domain: bank.sender_domain,
      subject_monthly: bank.subject_monthly,
      subject_ondemand: bank.subject_ondemand,
      attachment_filename_pattern: bank.attachment_filename_pattern,
      parser_key: bank.parser_key,
    });
    setError('');
    setModalOpen(true);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h2>ธนาคารที่รองรับ</h2>
          <p className="muted">กำหนดรูปแบบอีเมลและตัวแกะข้อมูลของแต่ละธนาคาร</p>
        </div>
        <button type="button" className="compact primary" onClick={openAdd}>+ เพิ่มธนาคาร</button>
      </div>
      {error && !modalOpen && <p className="error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>ชื่อ</th><th>ผู้ส่ง / โดเมน</th><th>หัวข้อรายเดือน / ขอเอง</th><th>สถานะปัจจุบัน</th><th>จัดการ</th></tr>
          </thead>
          <tbody>
            {banks.map((bank) => (
              <tr key={bank.id}>
                <td>{bank.name}<br /><code>{bank.parser_key}</code></td>
                <td><code>{bank.sender_email}</code><br /><code>{bank.sender_domain}</code></td>
                <td><code>{bank.subject_monthly}</code><br /><code>{bank.subject_ondemand}</code></td>
                <td>
                  <span className={`status-badge ${bank.is_active ? 'status-active' : 'status-inactive'}`}>
                    {bank.is_active ? 'เปิดใช้งานอยู่' : 'ปิดใช้งานอยู่'}
                  </span>
                  <button
                    type="button"
                    className="compact status-action"
                    onClick={() => patch(`/api/banks/${bank.id}`, { is_active: !bank.is_active }).then(reload).catch((e: Error) => alert(e.message))}
                  >
                    {bank.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </td>
                <td className="actions">
                  <button type="button" className="compact" onClick={() => openEdit(bank)}>แก้ไข</button>
                  <button
                    type="button"
                    className="compact danger"
                    onClick={() => confirm(`ลบธนาคาร “${bank.name}”?`) && del(`/api/banks/${bank.id}`).then(reload).catch((e: Error) => alert(e.message))}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? 'แก้ไขข้อมูลธนาคาร' : 'เพิ่มธนาคาร'}
        onClose={() => setModalOpen(false)}
      >
        <p className="muted">
          อีเมลผู้ส่งต้องเป็นอีเมลของธนาคารที่ส่ง statement และโดเมนใช้ตรวจ DKIM
        </p>
        <form
          className="modal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              if (editingId) await patch(`/api/banks/${editingId}`, form);
              else await post('/api/banks', form);
              setModalOpen(false);
              reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
            }
          }}
        >
          <div className="grid">
            <label><span>ชื่อธนาคาร</span><input value={form.name} onChange={set('name')} required autoFocus /></label>
            <label><span>อีเมลผู้ส่งของธนาคาร</span><input value={form.sender_email} onChange={set('sender_email')} required placeholder="statement@kasikornbank.com" /></label>
            <label><span>โดเมนผู้ส่ง (ตรวจ DKIM)</span><input value={form.sender_domain} onChange={set('sender_domain')} required placeholder="kasikornbank.com" /></label>
            <label><span>หัวข้ออีเมล statement รายเดือน (regex)</span><input value={form.subject_monthly} onChange={set('subject_monthly')} required /></label>
            <label><span>หัวข้ออีเมล statement ที่ผู้ใช้ขอเอง (regex)</span><input value={form.subject_ondemand} onChange={set('subject_ondemand')} required /></label>
            <label><span>ชื่อไฟล์แนบ (regex)</span><input value={form.attachment_filename_pattern} onChange={set('attachment_filename_pattern')} required /></label>
            <label>
              <span>ตัวแกะข้อมูล</span>
              <select value={form.parser_key} onChange={set('parser_key')}>
                <option value="kbank">kbank</option>
                <option value="scb">scb</option>
              </select>
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" onClick={() => setModalOpen(false)}>ยกเลิก</button>
            <button type="submit" className="primary">{editingId ? 'บันทึกการแก้ไข' : 'เพิ่มธนาคาร'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Users({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const reload = () => { req<User[]>('/api/admin/users').then(setUsers).catch((e: Error) => alert(e.message)); };
  useEffect(reload, []);

  const setStatus = (user: User, status: User['status']) => {
    if (status === 'rejected' && !confirm(`ปฏิเสธ ${user.email}? สิทธิ์เข้าถึง Gmail จะถูกยกเลิกและลบทิ้ง`)) return;
    patch(`/api/admin/users/${user.id}`, { status }).then(reload).catch((e: Error) => alert(e.message));
  };

  const setRole = (user: User, isAdmin: boolean) => {
    const label = isAdmin ? 'ผู้ดูแล' : 'ผู้ใช้ทั่วไป';
    if (!confirm(`เปลี่ยนบทบาทของ ${user.email} เป็น “${label}”?`)) return;
    patch(`/api/admin/users/${user.id}`, { is_admin: isAdmin }).then(reload).catch((e: Error) => alert(e.message));
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h2>ผู้ใช้งาน</h2>
          <p className="muted">ปรับสถานะการเข้าใช้งานและบทบาทของสมาชิก</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>อีเมล</th><th>ชื่อ</th><th>สถานะ</th><th>บทบาท</th></tr></thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id}>
                  <td><code>{user.email}</code>{isSelf && <span className="self-label">คุณ</span>}</td>
                  <td>{user.display_name}</td>
                  <td>
                    <select
                      className="table-select"
                      aria-label={`สถานะของ ${user.email}`}
                      value={user.status}
                      disabled={isSelf}
                      onChange={(e) => setStatus(user, e.target.value as User['status'])}
                    >
                      <option value="pending">รออนุมัติ</option>
                      <option value="approved">อนุมัติแล้ว</option>
                      <option value="rejected">ปฏิเสธ</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="table-select"
                      aria-label={`บทบาทของ ${user.email}`}
                      value={user.is_admin ? 'admin' : 'user'}
                      disabled={isSelf}
                      onChange={(e) => setRole(user, e.target.value === 'admin')}
                    >
                      <option value="user">ผู้ใช้ทั่วไป</option>
                      <option value="admin">ผู้ดูแล</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default { Banks, Users };
