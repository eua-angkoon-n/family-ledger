import { useEffect, useState } from 'react';
import { del, post, req, type Account, type Bank, type EmailAccount } from './api.js';

const EMPTY = { bank_id: '', email_account_id: '', nickname: '', account_number: '', pdf_password: '', promptpay_id: '' };

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [mailboxes, setMailboxes] = useState<EmailAccount[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const reload = () => {
    req<Account[]>('/api/accounts').then(setAccounts).catch((e: Error) => setError(e.message));
    req<Bank[]>('/api/banks').then((b) => setBanks(b.filter((x) => x.is_active)));
    req<EmailAccount[]>('/api/email-accounts').then(setMailboxes);
  };
  useEffect(reload, []);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <h2>เพิ่มบัญชีธนาคาร</h2>
      <p className="muted">
        ก่อนเพิ่ม: ไปขอ statement ย้อนหลังจากธนาคารให้ส่งเข้าอีเมลของคุณก่อน ระบบจะอ่านฉบับที่ขอไว้มาเป็นข้อมูลตั้งต้น
      </p>
      {/* นอกฟอร์ม — ลิงก์นี้พาออกไป OAuth ถ้าอยู่ในฟอร์มจะทำให้ที่กรอกไว้หายหมด */}
      <p className="muted"><a href="/auth/google?add=1">+ ต่อกล่องอีเมลอื่นเพิ่ม</a></p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          post('/api/accounts', form)
            .then(() => { setForm(EMPTY); reload(); })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <div className="grid">
          <label>
            <span>ธนาคาร</span>
            <select value={form.bank_id} onChange={set('bank_id')} required>
              <option value="">— เลือก —</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
              {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
            </select>
          </label>
          <label>
            <span>เลขที่บัญชี</span>
            <input value={form.account_number} onChange={set('account_number')} required maxLength={40} />
          </label>
          <label>
            <span>รหัสผ่านเปิดไฟล์ statement</span>
            <input type="password" value={form.pdf_password} onChange={set('pdf_password')} required autoComplete="off" />
          </label>
          <label>
            <span>พร้อมเพย์ (ไม่บังคับ — ใช้จับคู่การโอนภายในครอบครัว)</span>
            <input value={form.promptpay_id} onChange={set('promptpay_id')} maxLength={40} />
          </label>
        </div>
        <p className="muted">รหัสผ่านถูกเข้ารหัส AES-256-GCM ก่อนบันทึก และไม่เคยถูกส่งกลับออกมาจากเซิร์ฟเวอร์อีก</p>
        {error && <p className="error">{error}</p>}
        <button type="submit">บันทึก</button>
      </form>

      <h2>บัญชีที่ผูกไว้</h2>
      {accounts.length === 0 ? (
        <p className="muted">ยังไม่มีบัญชี</p>
      ) : (
        <table>
          <thead>
            <tr><th>ชื่อเล่น</th><th>ธนาคาร</th><th>เลขที่บัญชี</th><th>กล่องอีเมล</th><th /></tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.nickname}</td>
                <td>{a.bank_name}</td>
                <td><code>{a.account_number}</code></td>
                <td><code>{a.email}</code></td>
                <td>
                  <button
                    className="danger"
                    onClick={() => confirm(`ลบบัญชี “${a.nickname}” และรายการทั้งหมดของบัญชีนี้?`) && del(`/api/accounts/${a.id}`).then(reload)}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
