import { useState, useEffect, useCallback } from 'react';
import { activityService, projectService } from '../services';
import { useToast } from '../components/Overlays';
import { Avatar, LoadingSpinner, Empty } from '../components/UI';
import { ago } from '../utils/helpers';

export default function ActivityPage() {
  const toast = useToast();
  const [activities, setActivities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const params = projectFilter ? { project_id: projectFilter } : {};
      const [acts, projs] = await Promise.all([
        activityService.list(params),
        projectService.list()
      ]);
      setActivities(acts);
      setProjects(projs);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Activity Audit Log</h1>
          <p>Chronological history of changes, sprint updates, and task movements</p>
        </div>
      </div>

      <div className="filters">
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {activities.length > 0 ? (
          <ul className="timeline">
            {activities.map((a, i) => (
              <li key={a.activity_id || i}>
                <Avatar name={a.user_name} size="sm" />
                <div>
                  <div className="txt">
                    <b>{a.user_name || 'System'}</b> {a.action}
                  </div>
                  <div className="when">{ago(a.created_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            icon="activity"
            title="No activity recorded"
            text="Team interactions, commits, and workflow updates will show up here."
            sm
          />
        )}
      </div>
    </div>
  );
}
