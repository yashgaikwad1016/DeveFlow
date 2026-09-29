import { useState, useEffect, useCallback } from 'react';
import { reportService, projectService, sprintService } from '../services';
import { useToast } from '../components/Overlays';
import { Donut, HBars, ColChart } from '../components/Charts';
import { Badge, LoadingSpinner, Empty } from '../components/UI';
import Icon from '../components/Icon';
import { fmtDate, STATUSES, STATUS_COLOR } from '../utils/helpers';

export default function ReportsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [selectedProj, setSelectedProj] = useState('');
  const [reportType, setReportType] = useState('project'); // 'project' | 'sprint'

  // Sprints for selected project
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('');

  // Report data
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load projects list
  useEffect(() => {
    projectService.list().then(pr => {
      setProjects(pr);
      if (pr.length > 0) setSelectedProj(pr[0].project_id);
    }).catch(err => toast(err.message, 'err'));
  }, [toast]);

  // Load sprints when project changes
  useEffect(() => {
    if (selectedProj) {
      sprintService.list({ project_id: selectedProj }).then(sp => {
        setSprints(sp);
        if (sp.length > 0) setSelectedSprint(sp[0].sprint_id);
        else setSelectedSprint('');
      }).catch(() => {});
    }
  }, [selectedProj]);

  // Load Report
  const loadReport = useCallback(async () => {
    if (!selectedProj) return;
    setLoading(true);
    try {
      if (reportType === 'project') {
        const rep = await reportService.getProject(selectedProj);
        setData(rep);
      } else if (reportType === 'sprint' && selectedSprint) {
        const rep = await reportService.getSprint(selectedSprint);
        setData(rep);
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [selectedProj, selectedSprint, reportType, toast]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handlePrint = () => {
    window.print();
  };

  if (!projects.length && !loading) {
    return <div className="card"><Empty icon="file" title="No projects to report on" text="Create a project to generate velocity and progress analytics." /></div>;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics & Reports</h1>
          <p>Velocity tracking, workload balance, and completion burndown</p>
        </div>
        <div className="actions">
          <div className="seg">
            <button
              className={reportType === 'project' ? 'on' : ''}
              onClick={() => setReportType('project')}
            >
              Project Overview
            </button>
            <button
              className={reportType === 'sprint' ? 'on' : ''}
              onClick={() => setReportType('sprint')}
            >
              Sprint Report
            </button>
          </div>
          <button className="btn" onClick={handlePrint}>
            <Icon name="file" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="filters">
        <select
          value={selectedProj}
          onChange={e => setSelectedProj(e.target.value)}
        >
          {projects.map(p => (
            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
          ))}
        </select>

        {reportType === 'sprint' && (
          <select
            value={selectedSprint}
            onChange={e => setSelectedSprint(e.target.value)}
          >
            {sprints.map(s => (
              <option key={s.sprint_id} value={s.sprint_id}>{s.sprint_name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <LoadingSpinner />}

      {!loading && data && reportType === 'project' && (
        <div>
          {/* Stat Strip */}
          <div className="stat-strip">
            <div>
              <b>{data.total_tasks || 0}</b>
              <small>Total tasks</small>
            </div>
            <div>
              <b style={{ color: 'var(--green)' }}>{data.done_tasks || 0}</b>
              <small>Completed</small>
            </div>
            <div>
              <b style={{ color: 'var(--amber)' }}>{data.in_progress_tasks || 0}</b>
              <small>In progress</small>
            </div>
            <div>
              <b style={{ color: 'var(--red)' }}>{data.blocked_tasks || 0}</b>
              <small>Blocked</small>
            </div>
            <div>
              <b>{data.completion_rate || 0}%</b>
              <small>Progress</small>
            </div>
            <div>
              <b style={{ color: 'var(--red)' }}>{data.overdue_tasks || 0}</b>
              <small>Overdue</small>
            </div>
          </div>

          <div className="grid cols-2">
            {/* Task Status Donut */}
            <div className="card">
              <div className="card-head">
                <h3><Icon name="target" /> Status Breakdown</h3>
              </div>
              <Donut
                segments={STATUSES.map(s => ({
                  label: s,
                  value: data.status_counts?.[s] || 0,
                  color: STATUS_COLOR[s]
                }))}
                centerVal={data.total_tasks || 0}
                centerLbl="tasks"
              />
            </div>

            {/* Team Workload HBars */}
            <div className="card">
              <div className="card-head">
                <h3><Icon name="users" /> Team Workload Distribution</h3>
              </div>
              {data.member_workload && data.member_workload.length > 0 ? (
                <HBars
                  items={data.member_workload.map(m => ({
                    label: m.name,
                    v: m.tasks_count || 0,
                    g: m.completed_count || 0
                  }))}
                  fmt={(v, i) => `${v} tasks (${i.g || 0} done)`}
                />
              ) : (
                <Empty icon="users" title="No team members assigned" sm />
              )}
            </div>

            {/* Sprint Velocity Column Chart */}
            <div className="card span-2">
              <div className="card-head">
                <h3><Icon name="zap" /> Sprint Velocity & Completion History</h3>
              </div>
              {data.sprint_history && data.sprint_history.length > 0 ? (
                <ColChart
                  items={data.sprint_history.map(s => ({
                    label: s.sprint_name,
                    v: s.done_count || 0,
                    g: s.total_count || 0
                  }))}
                />
              ) : (
                <Empty icon="zap" title="No sprint history recorded" text="Sprint velocity will appear once iterations are completed." sm />
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && data && reportType === 'sprint' && (
        <div>
          <div className="report-head">
            <div>
              <h2>{data.sprint?.sprint_name}</h2>
              <p className="muted">
                {data.sprint?.project_name} · {fmtDate(data.sprint?.start_date)} → {fmtDate(data.sprint?.end_date)}
              </p>
            </div>
            <Badge value={data.state} />
          </div>

          <div className="stat-strip">
            <div>
              <b>{data.total_tasks}</b>
              <small>Total tasks</small>
            </div>
            <div>
              <b style={{ color: 'var(--green)' }}>{data.done_tasks}</b>
              <small>Completed</small>
            </div>
            <div>
              <b>{data.pct}%</b>
              <small>Completion rate</small>
            </div>
            <div>
              <b>{data.total_hours || 0}h</b>
              <small>Estimated effort</small>
            </div>
            <div>
              <b>{data.spent_hours || 0}h</b>
              <small>Burned effort</small>
            </div>
            <div>
              <b style={{ color: 'var(--amber)' }}>{data.open_issues}</b>
              <small>Open issues</small>
            </div>
          </div>

          <div className="grid cols-2">
            <div className="card">
              <div className="card-head">
                <h3><Icon name="target" /> Sprint Task Completion</h3>
              </div>
              <Donut
                segments={[
                  { label: 'Done', value: data.done_tasks || 0, color: 'var(--green)' },
                  { label: 'Remaining', value: (data.total_tasks - data.done_tasks) || 0, color: 'var(--blue)' }
                ]}
                centerVal={`${data.pct}%`}
                centerLbl="complete"
              />
            </div>

            <div className="card">
              <div className="card-head">
                <h3><Icon name="clock" /> Hours Burndown</h3>
              </div>
              <HBars
                items={[
                  { label: 'Estimated Effort', v: data.total_hours || 0 },
                  { label: 'Actual Burned', v: data.spent_hours || 0 }
                ]}
                fmt={v => `${v} hrs`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
