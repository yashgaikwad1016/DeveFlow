import { useState, useEffect, useCallback } from 'react';
import { aiService, projectService } from '../services';
import { useToast } from '../components/Overlays';
import { Badge, LoadingSpinner, Empty, Person } from '../components/UI';
import Icon from '../components/Icon';
import { fmtDate } from '../utils/helpers';

export default function AiInsightsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [selectedProj, setSelectedProj] = useState('');
  const [tab, setTab] = useState('priority'); // 'priority' | 'predict' | 'perf'

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [applyingId, setApplyingId] = useState(null);

  useEffect(() => {
    projectService.list().then(pr => {
      setProjects(pr);
      if (pr.length > 0) setSelectedProj(pr[0].project_id);
    }).catch(err => toast(err.message, 'err'));
  }, [toast]);

  const loadAiData = useCallback(async () => {
    if (!selectedProj) return;
    setLoading(true);
    try {
      if (tab === 'priority') {
        const res = await aiService.getPriority({ project_id: selectedProj });
        setData(res);
      } else if (tab === 'predict') {
        const res = await aiService.getPredict({ project_id: selectedProj });
        setData(res);
      } else if (tab === 'perf') {
        const res = await aiService.getPerformance({ project_id: selectedProj });
        setData(res);
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [selectedProj, tab, toast]);

  useEffect(() => {
    loadAiData();
  }, [loadAiData]);

  const handleApplyPriority = async (taskId) => {
    setApplyingId(taskId);
    try {
      await aiService.applyPriority(taskId);
      toast('Applied AI recommended priority!');
      loadAiData();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>AI Agile Insights</h1>
          <p>Predictive scheduling, automated priority scoring, and workload optimization</p>
        </div>
        <div className="actions">
          <div className="seg">
            <button
              className={tab === 'priority' ? 'on' : ''}
              onClick={() => setTab('priority')}
            >
              <Icon name="sparkles" /> Smart Priority
            </button>
            <button
              className={tab === 'predict' ? 'on' : ''}
              onClick={() => setTab('predict')}
            >
              <Icon name="clock" /> Completion Forecast
            </button>
            <button
              className={tab === 'perf' ? 'on' : ''}
              onClick={() => setTab('perf')}
            >
              <Icon name="users" /> Team Workload & Risk
            </button>
          </div>
        </div>
      </div>

      {/* Project Selector */}
      <div className="filters">
        <select
          value={selectedProj}
          onChange={e => setSelectedProj(e.target.value)}
        >
          {projects.map(p => (
            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
          ))}
        </select>
      </div>

      {loading && <LoadingSpinner />}

      {/* Tab 1: Smart Priority */}
      {!loading && tab === 'priority' && (() => {
        const priorityTasks = Array.isArray(data) ? data : (data?.tasks || []);
        return (
          <div className="grid">
            {priorityTasks.length > 0 ? (
              priorityTasks.map(t => {
                const score = t.ai_score ?? t.score ?? 50;
                const recPriority = t.ai_priority ?? t.recommended ?? 'Medium';
                const reasons = t.rationale ?? t.reasons ?? [];
                return (
                  <div key={t.task_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ fontSize: 16 }}>{t.title}</h3>
                        <Badge value={t.priority} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                          AI Score: {score}/100
                        </span>
                        {t.priority !== recPriority && (
                          <button
                            className="btn sm primary"
                            disabled={applyingId === t.task_id}
                            onClick={() => handleApplyPriority(t.task_id)}
                          >
                            Apply {recPriority}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="ai-box">
                      <h4><Icon name="sparkles" /> AI Recommendation · Recommended: <b>{recPriority}</b></h4>
                      <ul>
                        {(reasons.length ? reasons : [
                          `Deadline: ${fmtDate(t.deadline)}`,
                          `Complexity rating: ${t.complexity}/5`,
                          `Estimated effort: ${t.estimated_hours || 4} hours`
                        ]).map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="facts" style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      <span><Icon name="users" /> {t.assignee || 'Unassigned'}</span>
                      <span><Icon name="calendar" /> Deadline: {fmtDate(t.deadline)}</span>
                      <span><Icon name="clock" /> {t.estimated_hours || 0} hrs estimated</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card">
                <Empty
                  icon="sparkles"
                  title="All tasks prioritized"
                  text="No active backlog tasks require automated reprioritization."
                  sm
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab 2: Completion Forecast */}
      {!loading && tab === 'predict' && (
        <div className="grid cols-2">
          {data?.sprints && data.sprints.length > 0 ? (
            data.sprints.map(s => {
              const atRisk = s.risk_level === 'High' || s.risk_level === 'Critical';
              return (
                <div key={s.sprint_id} className="card">
                  <div className="card-head">
                    <h3><Icon name="zap" /> {s.sprint_name}</h3>
                    <Badge value={s.risk_level || 'On Track'} />
                  </div>
                  <p className="muted" style={{ marginBottom: 12 }}>
                    Target End: {fmtDate(s.end_date)} · Predicted: <b>{fmtDate(s.predicted_end_date)}</b>
                  </p>

                  <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
                    <div>
                      <b>{s.total_tasks}</b>
                      <small>Tasks</small>
                    </div>
                    <div>
                      <b>{s.velocity || 0}h/d</b>
                      <small>Pace</small>
                    </div>
                    <div>
                      <b style={{ color: atRisk ? 'var(--red)' : 'var(--green)' }}>
                        {s.confidence || 85}%
                      </b>
                      <small>Confidence</small>
                    </div>
                  </div>

                  <div className="ai-box">
                    <h4><Icon name="sparkles" /> AI Forecast Analysis</h4>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      {s.analysis || `Based on historical team velocity and estimated remaining hours, this sprint is projected to finish with ${s.confidence || 85}% probability within deadline.`}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="card span-2">
              <Empty icon="clock" title="No active sprints to forecast" text="Active sprints with tasks will receive automated completion forecasts." sm />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Team Workload & Risk */}
      {!loading && tab === 'perf' && (
        <div className="grid cols-2">
          {data?.members && data.members.length > 0 ? (
            data.members.map(m => {
              const overloaded = m.overloaded || m.active_tasks > 5;
              return (
                <div key={m.user_id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Person name={m.name} sub={`${m.designation || 'Team Member'} · ${m.email}`} />
                    <Badge value={overloaded ? 'High' : 'Low'} extra={overloaded ? ' Workload' : ' Balanced'} />
                  </div>

                  <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 12 }}>
                    <div>
                      <b>{m.active_tasks || 0}</b>
                      <small>Active tasks</small>
                    </div>
                    <div>
                      <b>{m.total_hours || 0}h</b>
                      <small>Total hours</small>
                    </div>
                    <div>
                      <b style={{ color: 'var(--green)' }}>{m.completed_tasks || 0}</b>
                      <small>Completed</small>
                    </div>
                  </div>

                  {overloaded ? (
                    <div className="ai-box" style={{ background: 'var(--red-soft)', borderColor: 'var(--red)' }}>
                      <h4 style={{ color: 'var(--red)' }}>
                        <Icon name="alert" /> Workload Alert
                      </h4>
                      <p style={{ fontSize: 13, color: 'var(--text)' }}>
                        {m.name} has {m.active_tasks} active tasks totaling {m.total_hours}h. Consider reassigning upcoming tasks to avoid delivery bottlenecks.
                      </p>
                    </div>
                  ) : (
                    <div className="ai-box">
                      <h4><Icon name="check" /> Healthy Capacity</h4>
                      <p style={{ fontSize: 13 }}>
                        Workload is well-balanced within the standard capacity limits.
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="card span-2">
              <Empty icon="users" title="No team members assigned" sm />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
