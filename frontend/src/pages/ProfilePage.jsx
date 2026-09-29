import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services';
import { useToast } from '../components/Overlays';
import { Avatar, Badge } from '../components/UI';
import Icon from '../components/Icon';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    name: user?.name || '',
    designation: user?.designation || '',
    current_password: '',
    new_password: '',
  });

  const [saving, setSaving] = useState(false);

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        designation: form.designation,
      };
      if (form.new_password) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      }
      const res = await authService.updateMe(payload);
      updateUser({ name: form.name, designation: form.designation });
      setForm(prev => ({ ...prev, current_password: '', new_password: '' }));
      toast(res.message || 'Profile updated successfully');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head">
        <div>
          <h1>My Profile</h1>
          <p>Manage your account settings, designation, and password</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={user?.name} size="lg" />
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 2 }}>{user?.name}</h2>
            <div className="muted">{user?.email}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge value={user?.role} />
              {user?.designation && <span className="small muted">· {user.designation}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="full">
              <label>Full Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="full">
              <label>Designation / Role Title</label>
              <input
                name="designation"
                value={form.designation}
                onChange={handleChange}
                placeholder="e.g. Senior Software Architect"
              />
            </div>

            <div className="full" style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <h3>Change Password</h3>
              <p className="small muted">Leave blank if you do not wish to update your password.</p>
            </div>

            <div>
              <label>Current Password</label>
              <input
                type="password"
                name="current_password"
                value={form.current_password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label>New Password</label>
              <input
                type="password"
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              <Icon name="check" /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
