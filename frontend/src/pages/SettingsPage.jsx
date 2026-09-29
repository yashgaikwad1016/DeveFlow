import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsService } from '../services';
import { useToast } from '../components/Overlays';
import { LoadingSpinner } from '../components/UI';
import Icon from '../components/Icon';

export default function SettingsPage() {
  const { setOrg } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState({
    app_name: 'DevFlow',
    org_name: '',
    hours_per_day: '6',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService.get()
      .then(s => {
        setSettings({
          app_name: s.app_name || 'DevFlow',
          org_name: s.org_name || '',
          hours_per_day: String(s.hours_per_day || '6'),
        });
        setLoading(false);
      })
      .catch(err => {
        toast(err.message, 'err');
        setLoading(false);
      });
  }, [toast]);

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.update(settings);
      setOrg(settings.org_name);
      toast('Workspace settings updated successfully');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ maxWidth: 700 }}>
      <div className="page-head">
        <div>
          <h1>Workspace Settings</h1>
          <p>Configure global agile parameters and organization identity</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="full">
              <label>Application Name</label>
              <input
                value={settings.app_name}
                onChange={e => setSettings(prev => ({ ...prev, app_name: e.target.value }))}
                required
              />
            </div>
            <div className="full">
              <label>Organization / Team Name</label>
              <input
                value={settings.org_name}
                onChange={e => setSettings(prev => ({ ...prev, org_name: e.target.value }))}
                placeholder="e.g. Acme Innovations"
              />
            </div>
            <div className="full">
              <label>Working Hours Per Day (for velocity calculations)</label>
              <input
                type="number"
                min="1"
                max="24"
                value={settings.hours_per_day}
                onChange={e => setSettings(prev => ({ ...prev, hours_per_day: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              <Icon name="check" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
