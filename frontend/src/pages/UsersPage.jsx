import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services';
import { useModal, useConfirm, useToast } from '../components/Overlays';
import { Badge, Person, LoadingSpinner, Empty } from '../components/UI';
import Icon from '../components/Icon';
import { ago } from '../utils/helpers';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { openModal, closeModal } = useModal();

  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const us = await userService.list();
      setUsers(us);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open User Modal (Create or Edit)
  const openUserModal = (targetUser = null) => {
    const isEdit = Boolean(targetUser?.user_id);
    const initial = {
      name: targetUser?.name || '',
      email: targetUser?.email || '',
      password: '',
      role: targetUser?.role || 'Member',
      designation: targetUser?.designation || '',
      active: targetUser ? (targetUser.active ? 1 : 0) : 1,
    };

    function UserForm() {
      const [form, setForm] = useState(initial);
      const [submitting, setSubmitting] = useState(false);

      const handleChange = e => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({
          ...prev,
          [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
        }));
      };

      const handleSubmit = async e => {
        e.preventDefault();
        setSubmitting(true);
        try {
          if (isEdit) {
            const payload = { ...form };
            if (!payload.password) delete payload.password;
            await userService.update(targetUser.user_id, payload);
            toast('User updated successfully');
          } else {
            await userService.create(form);
            toast('User account created');
          }
          closeModal();
          loadData();
        } catch (err) {
          toast(err.message, 'err');
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <form onSubmit={handleSubmit}>
          <h2>{isEdit ? 'Edit user account' : 'Add new user'}</h2>
          <p className="lead">{isEdit ? 'Update profile and privileges' : 'Invite a new team member or administrator.'}</p>
          <div className="form-grid">
            <div className="full">
              <label>Full name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Sarah Connor"
              />
            </div>
            <div>
              <label>Email address *</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label>{isEdit ? 'New Password (leave blank to keep)' : 'Temporary Password *'}</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required={!isEdit}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label>Role</label>
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="Member">Member (View & update assigned tasks)</option>
                <option value="Manager">Manager (Create projects, sprints, tasks)</option>
                <option value="Admin">Admin (Full workspace control)</option>
              </select>
            </div>
            <div>
              <label>Designation / Title</label>
              <input
                name="designation"
                value={form.designation}
                onChange={handleChange}
                placeholder="e.g. Lead Frontend Engineer"
              />
            </div>
            <div className="full" style={{ marginTop: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="active"
                  checked={Boolean(form.active)}
                  onChange={handleChange}
                />
                Active account (allow login)
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      );
    }

    openModal(<UserForm />);
  };

  // Toggle active status
  const handleToggleActive = async (u) => {
    try {
      const nextActive = u.active ? 0 : 1;
      await userService.update(u.user_id, { active: nextActive });
      toast(nextActive ? 'User activated' : 'User deactivated');
      loadData();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  // Delete User
  const handleDelete = async (u) => {
    if (u.user_id === currentUser.user_id) {
      toast('You cannot delete your own account.', 'err');
      return;
    }

    const ok = await confirm('Delete user?', `Are you sure you want to permanently remove "${u.name}"?`);
    if (!ok) return;

    try {
      await userService.delete(u.user_id);
      toast('User deleted');
      loadData();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const filtered = users.filter(u => !roleFilter || u.role === roleFilter);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>User Management</h1>
          <p>{users.length} registered workspace member{users.length === 1 ? '' : 's'}</p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => openUserModal()}>
            <Icon name="plus" /> Add user
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="seg">
          {['', 'Admin', 'Manager', 'Member'].map(r => (
            <button
              key={r}
              className={roleFilter === r ? 'on' : ''}
              onClick={() => setRoleFilter(r)}
            >
              {r || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map(u => (
                  <tr key={u.user_id}>
                    <td>
                      <Person name={u.name} sub={u.email} />
                    </td>
                    <td><Badge value={u.role} /></td>
                    <td>{u.designation || '—'}</td>
                    <td>
                      <button
                        className={`badge b-${u.active ? 'Active' : 'Inactive'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Click to toggle active state"
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.active ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                    <td><small className="muted">{u.last_login ? ago(u.last_login) : 'Never'}</small></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn sm"
                          title="Edit user"
                          onClick={() => openUserModal(u)}
                        >
                          <Icon name="edit" />
                        </button>
                        {u.user_id !== currentUser.user_id && (
                          <button
                            className="btn sm danger"
                            title="Delete user"
                            onClick={() => handleDelete(u)}
                          >
                            <Icon name="trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 32 }}>
                    <Empty icon="users" title="No users found" sm />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
