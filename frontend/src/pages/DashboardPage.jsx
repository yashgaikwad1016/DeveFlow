import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardService } from '../services';
import { Kpi, LoadingSpinner, Ring, Badge, Avatar, Person, Empty } from '../components/UI';
import { Donut } from '../components/Charts';
import Icon from '../components/Icon';
import DevFlowLogo from '../components/brand/DevFlowLogo';
import { fmtDate, isLate, STATUSES, STATUS_COLOR, ago } from '../utils/helpers';

export default function DashboardPage() {
  const { user, isMgr, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    dashboardService.get()
      .then(d => { if (mounted) { setData(d); setLoading(false); } })
      .catch(err => { if (mounted) { setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="card"><Empty icon="alert" title="Failed to load dashboard" text="Could not retrieve workspace summary." /></div>;

  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const statusDonutSegments = STATUSES.map(s => ({
    label: s,
    value: data.status_counts?.[s] || 0,
    color: STATUS_COLOR[s]
  }));

  const overdueCount = (data.upcoming || []).filter(isLate).length;

  return (
    <div>
      {/* Hero Welcome Banner */}
      <div className="card hero" style={{ marginBottom: 20 }}>
        <div>
          <div style={{ marginBottom: 12, display: 'inline-flex' }}>
            <DevFlowLogo variant="navbar" priority={true} style={{ height: 32 }} />
          </div>
          <h2>
            {greet}, {firstName}! 👋
            {isAdmin() ? (
              <span className="badge b-Admin" style={{ verticalAlign: 'middle', fontSize: 12, marginLeft: 10, background: 'rgba(255,255,255,0.22)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
                👑 Admin Workspace
              </span>
            ) : (
              <span className="badge" style={{ verticalAlign: 'middle', fontSize: 12, marginLeft: 10, background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
                Member Workspace
              </span>
            )}
          </h2>
          <p>{dateStr} · Here is what is happening across your workspace today.</p>
        </div>
        <div className="hero-actions">
          {isAdmin() && (
            <Link to="/tasks" className="btn sm">
              <Icon name="plus" /> Manage Tasks
            </Link>
          )}
          <Link to="/ai" className="btn sm">
            <Icon name="sparkles" /> AI Insights
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        <Kpi
          icon="target"
          tone="blue"
          val={data.total_tasks || 0}
          lbl="Total tasks"
          sub={`${data.status_counts?.['In Progress'] || 0} active now`}
        />
        <Kpi
          icon="zap"
          tone="violet"
          val={data.sprints?.length || 0}
          lbl="Active sprints"
          sub="Current iterations"
        />
        <Kpi
          icon="check"
          tone="green"
          val={data.status_counts?.['Completed'] || 0}
          lbl="Tasks completed"
          sub={`${data.total_tasks ? Math.round((100 * (data.status_counts?.['Completed'] || 0)) / data.total_tasks) : 0}% completion`}
        />
        <Kpi
          icon="alert"
          tone={overdueCount > 0 ? 'red' : 'slate'}
          val={overdueCount}
          lbl="Overdue tasks"
          sub={overdueCount > 0 ? 'Needs attention' : 'All on track'}
        />
      </div>

      {/* 2-Column Section */}
      <div className="grid cols-2">
        {/* Task Status Donut */}
        <div className="card">
          <div className="card-head">
            <h3><Icon name="target" /> Task distribution</h3>
            {isAdmin() && <Link to="/tasks">View board</Link>}
          </div>
          <Donut
            segments={statusDonutSegments}
            centerVal={data.total_tasks || 0}
            centerLbl="total tasks"
          />
        </div>

        {/* Active Sprints */}
        <div className="card">
          <div className="card-head">
            <h3><Icon name="zap" /> Active sprints</h3>
            <Link to="/sprints">View all</Link>
          </div>
          {data.sprints && data.sprints.length > 0 ? (
            <div className="list">
              {data.sprints.map(s => (
                <div key={s.sprint_id} className="list-item">
                  <Ring pct={s.pct || 0} />
                  <div className="grow">
                    <div className="title">{s.sprint_name}</div>
                    <div className="meta">
                      <span>{s.project_name}</span>
                      <span>· {s.done || 0}/{s.total || 0} tasks done</span>
                    </div>
                  </div>
                  <Badge value={s.days_left <= 2 ? 'High' : 'Active'} />
                  <small className="muted">{s.days_left}d left</small>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon="zap"
              title="No active sprint"
              text={isMgr() ? "Plan a sprint to organize work into time-boxed goals." : "No sprint in progress right now."}
              action={isMgr() ? <Link to="/sprints" className="btn sm"><Icon name="plus" /> Plan sprint</Link> : null}
              sm
            />
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="card">
          <div className="card-head">
            <h3><Icon name="calendar" /> Upcoming deadlines</h3>
            {isAdmin() && <Link to="/tasks">Open board</Link>}
          </div>
          {data.upcoming && data.upcoming.length > 0 ? (
            <div className="list">
              {data.upcoming.map(t => {
                const late = isLate(t);
                const d = t.deadline ? new Date(t.deadline) : null;
                return (
                  <div key={t.task_id} className="list-item">
                    <div className={`date-chip${late ? ' late' : ''}`}>
                      <b>{d ? d.getDate() : '—'}</b>
                      <small>{d ? d.toLocaleString('en-US', { month: 'short' }) : ''}</small>
                    </div>
                    <div className="grow">
                      <div className="title">{t.title}</div>
                      <div className="meta">
                        <span>{t.project_name}</span>
                        {t.assignee && <span>· {t.assignee}</span>}
                      </div>
                    </div>
                    <Badge value={t.priority} />
                    <Badge value={t.status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              icon="calendar"
              title="No upcoming deadlines"
              text="Tasks with scheduled dates will appear here."
              sm
            />
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-head">
            <h3><Icon name="activity" /> Recent activity</h3>
            <Link to="/activity">View all</Link>
          </div>
          {data.activity && data.activity.length > 0 ? (
            <ul className="timeline">
              {data.activity.slice(0, 6).map((a, i) => (
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
              title="No recent activity"
              text="Actions taken by your team will appear here."
              sm
            />
          )}
        </div>
      </div>
    </div>
  );
}
