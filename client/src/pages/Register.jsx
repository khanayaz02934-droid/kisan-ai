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

export default function Register() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (form.password !== form.confirm) {
        toast.error(t('auth.passwordMismatch'));
        return;
      }
      const data = await authService.register(form);
      dispatch(setCredentials(data));
      toast.success(t('auth.registerOk'));
      navigate('/');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-extrabold text-ink">{t('auth.registerTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.registerSub')}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Input label={t('auth.name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('auth.email')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <PasswordInput label={t('auth.password')} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <PasswordInput label={t('auth.confirmPassword')} required minLength={6} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          <Input label={t('auth.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t('common.loading') : t('auth.registerBtn')}
          </Button>
        </form>
        <Link to="/login" className="mt-4 block text-center text-sm font-semibold text-primary">
          {t('auth.hasAccount')}
        </Link>
      </Card>
    </div>
  );
}
