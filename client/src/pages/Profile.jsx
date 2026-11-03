import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { User as UserIcon, Lock, LogOut } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import { authService } from '../services';
import { apiErrorMessage } from '../services/api';
import { setUser, logout } from '../redux/slices/authSlice';
import { clearCartCount } from '../redux/slices/cartSlice';

export default function Profile() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const user = useSelector((s) => s.auth.user);

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    state: user?.state || '',
    district: user?.district || '',
    village: user?.village || '',
    preferredLang: user?.preferredLang || 'en',
  });
  const [saving, setSaving] = useState(false);

  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [changingPwd, setChangingPwd] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authService.updateProfile(form);
      dispatch(setUser(updated.user || updated));
      toast.success(t('profile.savedToast'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setChangingPwd(true);
    try {
      await authService.updateProfile(pwd);
      setPwd({ currentPassword: '', newPassword: '' });
      toast.success(t('profile.passwordChangedToast'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setChangingPwd(false);
    }
  };

  const doLogout = () => {
    dispatch(logout());
    dispatch(clearCartCount());
    queryClient.clear();
    toast.success(t('profile.logoutToast'));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-light text-primary">
            <UserIcon size={30} />
          </span>
          <div>
            <h1 className="text-xl font-extrabold text-ink">{user?.name}</h1>
            <p className="text-sm text-muted">{user?.email}</p>
            {user?.userType === 'ADMIN' && <Badge tone="blue" className="mt-1">ADMIN</Badge>}
          </div>
        </div>
      </Card>

      {/* Edit profile */}
      <Card>
        <h2 className="text-base font-bold text-ink">{t('profile.editTitle')}</h2>
        <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            label={t('auth.name')}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label={t('auth.phone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label={t('auth.state')}
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />
          <Input
            label={t('auth.district')}
            value={form.district}
            onChange={(e) => setForm({ ...form, district: e.target.value })}
          />
          <Input
            label={t('auth.village')}
            value={form.village}
            onChange={(e) => setForm({ ...form, village: e.target.value })}
          />
          <Select
            label={t('profile.language')}
            value={form.preferredLang}
            onChange={(e) => setForm({ ...form, preferredLang: e.target.value })}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </Select>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="text-white" /> : t('profile.saveProfile')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Change password */}
      <Card>
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Lock size={18} /> {t('profile.changePassword')}
        </h2>
        <form onSubmit={changePassword} className="mt-4 grid gap-3 sm:grid-cols-2">
          <PasswordInput
            label={t('profile.currentPassword')}
            required
            minLength={6}
            value={pwd.currentPassword}
            onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })}
          />
          <PasswordInput
            label={t('profile.newPassword')}
            required
            minLength={6}
            value={pwd.newPassword}
            onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={changingPwd}>
              {changingPwd ? (
                <Spinner className="text-white" />
              ) : (
                t('profile.changePasswordBtn')
              )}
            </Button>
          </div>
        </form>
      </Card>

      <Button variant="danger" onClick={doLogout} className="w-full">
        <LogOut size={18} /> {t('nav.logout')}
      </Button>
    </div>
  );
}
