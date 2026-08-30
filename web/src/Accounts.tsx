import { useEffect, useState } from 'react';
import { del, patch, post, req, type Account, type Bank, type EmailAccount } from './api.js';
import Modal from './Modal.js';

const EMPTY = { bank_id: '', email_account_id: '', nickname: '', account_number: '', pdf_password: '', promptpay_id: '' };

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [mailboxes, setMailboxes] = useState<EmailAccount[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const reload = () => {
    req<Account[]>('/api/accounts').then(setAccounts).catch((e: Error) => setError(e.message));
    req<Bank[]>('/api/banks').then(setBanks).catch((e: Error) => setError(e.message));
    req<EmailAccount[]>('/api/email-accounts').then(setMailboxes).catch((e: Error) => setError(e.message));
  };
  useEffect(reload, []);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingId(account.id);
    setForm({
      bank_id: String(account.bank_id),
      email_account_id: String(account.email_account_id),
      nickname: account.nickname,
      account_number: account.account_number,
      pdf_password: '',
      promptpay_id: account.promptpay_id ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <h2>บัญชีธนาคารของฉัน</h2>
          <p className="muted">จัดการบัญชีที่ใช้รับข้อมูลจาก statement</p>
        </div>
        <button type="button" className="compact primary" onClick={openAdd}>+ เพิ่มบัญชี</button>
      </div>
      {error && !modalOpen && <p className="error" role="alert">{error}</p>}

      {accounts.length === 0 ? (
        <p className="empty-state">ยังไม่มีบัญชีธนาคาร กด “เพิ่มบัญชี” เพื่อเริ่มต้น</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ชื่อเล่น</th><th>ธนาคาร</th><th>เลขที่บัญชี</th><th>กล่องอีเมล</th><th>จัดการ</th></tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.nickname}</td>
                  <td>{account.bank_name}</td>
                  <td><code>{account.account_number}</code></td>
                  <td><code>{account.email}</code></td>
                  <td className="actions">
                    <button type="button" className="compact" onClick={() => openEdit(account)}>แก้ไข</button>
                    <button
                      type="button"
                      className="compact danger"
                      onClick={() => confirm(`ลบบัญชี “${account.nickname}” และรายการทั้งหมดของบัญชีนี้?`) && del(`/api/accounts/${account.id}`).then(reload).catch((e: Error) => alert(e.message))}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'}
        onClose={() => setModalOpen(false)}
      >
        <p className="muted">
          ก่อนเพิ่มบัญชี ให้ขอ statement ย้อนหลังจากธนาคารส่งเข้ากล่องอีเมลของคุณ ระบบจะใช้เป็นข้อมูลตั้งต้น
        </p>
        <p className="muted"><a href="/auth/google?add=1">+ ต่อกล่องอีเมลอื่นเพิ่ม</a></p>
        <form
          className="modal-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              if (editingId) await patch(`/api/accounts/${editingId}`, form);
              else await post('/api/accounts', form);
              setModalOpen(false);
              reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
            }
          }}
        >
          <div className="grid">
            <label>
              <span>ธนาคาร</span>
              <select value={form.bank_id} onChange={set('bank_id')} required autoFocus>
                <option value="">— เลือก —</option>
                {banks.filter((bank) => bank.is_active || String(bank.id) === form.bank_id).map((bank) => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>ชื่อเล่น</span>
              <input value={form.nickname} onChange={set('nickname')} required maxLength={60} />
            </label>
            <label>
              <span>กล่องอีเมลที่ให้ระบบเข้าไปอ่าน</span>
              <select value={form.email_account_id} onChange={set('email_account_id')} required>
                <option value="">— เลือก —</option>
                {mailboxes.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.email}</option>)}
              </select>
            </label>
            <label>
              <span>เลขที่บัญชี</span>
              <input value={form.account_number} onChange={set('account_number')} required maxLength={40} />
            </label>
            <label>
              <span>รหัสผ่านเปิดไฟล์ statement</span>
              <input
                type="password"
                value={form.pdf_password}
                onChange={set('pdf_password')}
                required={!editingId}
                placeholder={editingId ? 'เว้นว่างเพื่อใช้รหัสเดิม' : undefined}
                autoComplete="off"
              />
            </label>
            <label>
              <span>พร้อมเพย์ (ไม่บังคับ)</span>
              <input value={form.promptpay_id} onChange={set('promptpay_id')} maxLength={40} />
            </label>
          </div>
          <p className="muted">รหัสผ่านถูกเข้ารหัส AES-256-GCM ก่อนบันทึก และระบบจะไม่ส่งค่ากลับมาแสดงอีก</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" onClick={() => setModalOpen(false)}>ยกเลิก</button>
            <button type="submit" className="primary">{editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบัญชี'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
