import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import { authService } from '../../services';
import { apiErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/helpers';

export default function AdminSettings() {
  const user = useSelector((s) => s.auth.user);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  });

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await authService.updateProfile({ name: profile.name, phone: profile.phone });
      toast.success(res?.message || 'Profile updated');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error('Both password fields are required');
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await authService.updateProfile({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success(res?.message || 'Password changed');
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your admin profile and account security.</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink">Account overview</h2>
          <Badge tone="blue">ADMIN</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase text-muted">Email</dt>
            <dd className="font-medium text-ink break-words">{user?.email || '—'}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase text-muted">Registered</dt>
            <dd className="font-medium text-ink">{formatDate(user?.createdAt)}</dd>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase text-muted">Account status</dt>
            <dd className="font-medium text-ink">
              {user?.isActive === false ? 'Disabled' : 'Active'}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-ink">Edit profile</h2>
        <form onSubmit={saveProfile} className="mt-3 max-w-md space-y-3">
          <Input
            label="Name"
            required
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
          <Input
            label="Phone"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          />
          <Button type="submit" disabled={savingProfile} className="w-full sm:w-auto">
            {savingProfile ? <Spinner className="text-white" /> : 'Save profile'}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-ink">Change password</h2>
        <form onSubmit={changePassword} className="mt-3 max-w-md space-y-3">
          <Input
            label="Current password"
            type="password"
            required
            value={passwords.currentPassword}
            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
          />
          <Input
            label="New password"
            type="password"
            required
            value={passwords.newPassword}
            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
          />
          <Input
            label="Confirm new password"
            type="password"
            required
            value={passwords.confirm}
            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
          />
          <Button type="submit" disabled={savingPassword} className="w-full sm:w-auto">
            {savingPassword ? <Spinner className="text-white" /> : 'Change password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
