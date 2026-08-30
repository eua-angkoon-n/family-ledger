import { useEffect, useState } from 'react';
import { post, req, type User } from './api.js';
import Accounts from './Accounts.js';
import Admin from './Admin.js';

type Tab = 'accounts' | 'banks' | 'users';

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [signupInviteRequired, setSignupInviteRequired] = useState(false);
  const [tab, setTab] = useState<Tab>('accounts');
  const [invite, setInvite] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [submittingInvite, setSubmittingInvite] = useState(false);

  useEffect(() => {
    req<{ user: User | null; signupInviteRequired: boolean }>('/api/me')
      .then((r) => {
        setUser(r.user);
        setSignupInviteRequired(r.signupInviteRequired);
      })
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return <main>กำลังโหลด…</main>;

  if (!user) {
    if (signupInviteRequired) {
      return (
        <main className="auth-shell">
          <form
            className="auth-card"
            onSubmit={async (e) => {
              e.preventDefault();
              setInviteError('');
              setSubmittingInvite(true);
              try {
                await post('/auth/signup', { inviteCode: invite });
                location.reload();
              } catch (error) {
                setInviteError(error instanceof Error ? error.message : 'สมัครสมาชิกไม่สำเร็จ');
                setSubmittingInvite(false);
              }
            }}
          >
            <h1>สมัครสมาชิก</h1>
            <p className="muted">ยืนยันบัญชี Google สำเร็จแล้ว กรุณากรอกรหัสเชิญเพื่อเริ่มใช้งาน</p>
            <label>
              <span>รหัสเชิญ</span>
              <input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </label>
            {inviteError && <p className="error" role="alert">{inviteError}</p>}
            <button type="submit" disabled={submittingInvite} aria-busy={submittingInvite}>
              {submittingInvite ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
            </button>
          </form>
        </main>
      );
    }

    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>บัญชีครอบครัว</h1>
          <p className="muted">เข้าสู่ระบบเพื่อจัดการบัญชีและรายรับรายจ่ายของครอบครัว</p>
          <button type="button" onClick={() => { location.href = '/auth/google'; }}>
            เข้าสู่ระบบด้วย Google
          </button>
        </section>
      </main>
    );
  }

  if (user.status !== 'approved') {
    return (
      <main>
        <h1>รอการอนุมัติ</h1>
        <p className="muted">
          บัญชี {user.email} สถานะ “{user.status === 'pending' ? 'รออนุมัติ' : 'ถูกปฏิเสธ'}” — ให้แอดมินอนุมัติก่อนจึงจะใช้งานได้
        </p>
        <button onClick={() => req('/auth/logout', { method: 'POST' }).then(() => location.reload())}>ออกจากระบบ</button>
      </main>
    );
  }

  return (
    <main>
      <h1>บัญชีครอบครัว</h1>
      <nav>
        <button aria-current={tab === 'accounts'} onClick={() => setTab('accounts')}>บัญชีธนาคารของฉัน</button>
        {user.is_admin && (
          <>
            <button aria-current={tab === 'banks'} onClick={() => setTab('banks')}>ธนาคาร (แอดมิน)</button>
            <button aria-current={tab === 'users'} onClick={() => setTab('users')}>ผู้ใช้ (แอดมิน)</button>
          </>
        )}
        <button onClick={() => req('/auth/logout', { method: 'POST' }).then(() => location.reload())}>
          ออกจากระบบ
        </button>
      </nav>

      {tab === 'accounts' && <Accounts />}
      {tab === 'banks' && <Admin.Banks />}
      {tab === 'users' && <Admin.Users currentUserId={user.id} />}
    </main>
  );
}
