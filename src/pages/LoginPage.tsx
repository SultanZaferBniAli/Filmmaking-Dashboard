import { useState } from 'react';
import { useAuth } from '../state/AuthContext';

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-main-text outline-none text-right';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الدخول. تأكد من تشغيل الخادم الخلفي ثم أعد المحاولة.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-bg bg-cover bg-center bg-no-repeat bg-fixed px-6"
      style={{ backgroundImage: "url('/assets/bg-cinematic.svg')" }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl">
        <div className="mb-8 flex items-center justify-center gap-3">
          <img src="/assets/logo-program.png" alt="برنامج صناع الأفلام" className="h-10 w-auto object-contain" />
          <img src="/assets/logo-film-commission.png" alt="هيئة الأفلام" className="size-14 object-contain" />
        </div>

        <h1 className="mb-6 text-center text-lg font-bold text-main-text">تسجيل الدخول</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-right">
            <span className="text-xs font-medium text-subtle-blue">اسم المستخدم</span>
            <input
              dir="ltr"
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-right">
            <span className="text-xs font-medium text-subtle-blue">كلمة المرور</span>
            <input
              dir="ltr"
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <p className="text-right text-xs text-notif-red">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-burgundy px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'جارٍ الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
