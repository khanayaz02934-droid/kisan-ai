import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import Button from '../components/ui/Button';
import { authService } from '../services';
import { setCredentials } from '../redux/slices/authSlice';
import { apiErrorMessage } from '../services/api';

export default function Login() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await authService.login(form);
      dispatch(setCredentials(data));
      toast.success(t('auth.loginOk'));
      // Role-based redirect straight from the backend's role field
      // ('ADMIN'; normalised so 'admin'/'Admin' variants still work):
      // ADMIN → Admin Dashboard, USER → the farmer home/dashboard.
      const isAdmin = String(data?.user?.userType || '').toUpperCase() === 'ADMIN';
      navigate(isAdmin ? '/admin/dashboard' : '/');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-extrabold text-ink">{t('auth.loginTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.loginSub')}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Input label={t('auth.email')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <PasswordInput label={t('auth.password')} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t('common.loading') : t('auth.loginBtn')}
          </Button>
        </form>
        <Link to="/register" className="mt-4 block text-center text-sm font-semibold text-primary">
          {t('auth.noAccount')}
        </Link>
      </Card>
    </div>
  );
}
