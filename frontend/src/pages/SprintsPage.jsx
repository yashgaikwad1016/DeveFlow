import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sprintService, projectService } from '../services';
import { useModal, useConfirm, useToast } from '../components/Overlays';
import { Badge, Ring, Empty, LoadingSpinner } from '../components/UI';
import Icon from '../components/Icon';
import { fmtDate, toDateInput, sprintState } from '../utils/helpers';

export default function SprintsPage() {
  const { isMgr, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { openModal, closeModal } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sprints, setSprints] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProj, setSelectedProj] = useState(searchParams.get('project_id') || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [sp, pr] = await Promise.all([
        sprintService.list(selectedProj ? { project_id: selectedProj } : {}),
        projectService.list()
      ]);
      setSprints(sp);
      setProjects(pr);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [selectedProj, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProjectFilter = (pid) => {
    setSelectedProj(pid);
    if (pid) setSearchParams({ project_id: pid });
    else setSearchParams({});
  };

  // Open Sprint Form Modal (Create or Edit)
  const openSprintModal = (sprint = null) => {
    const isEdit = Boolean(sprint?.sprint_id);
    const initial = {
      project_id: sprint?.project_id || (selectedProj ? Number(selectedProj) : (projects[0]?.project_id || '')),
      sprint_name: sprint?.sprint_name || '',
      goal: sprint?.goal || '',
      start_date: toDateInput(sprint?.start_date),
      end_date: toDateInput(sprint?.end_date),
    };

    function SprintForm() {
      const [form, setForm] = useState(initial);
      const [submitting, setSubmitting] = useState(false);

      const handleChange = e => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
      };

      const handleSubmit = async e => {
        e.preventDefault();
        setSubmitting(true);
        try {
          if (isEdit) {
            await sprintService.update(sprint.sprint_id, form);
            toast('Sprint updated successfully');
          } else {
            await sprintService.create(form);
            toast('Sprint created successfully');
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
          <h2>{isEdit ? 'Edit sprint' : 'Plan a new sprint'}</h2>
          <p className="lead">{isEdit ? 'Update sprint timing and goals' : 'Create a focused, time-boxed iteration for your team.'}</p>
          <div className="form-grid">
            <div className="full">
              <label>Project *</label>
              <select
                name="project_id"
                value={form.project_id}
                onChange={handleChange}
                required
                disabled={isEdit}
              >
                {projects.map(p => (
                  <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div className="full">
              <label>Sprint name *</label>
              <input
                name="sprint_name"
                value={form.sprint_name}
                onChange={handleChange}
                required
                placeholder="e.g. Sprint 14 · Auth & Payments"
              />
            </div>
            <div className="full">
              <label>Sprint goal</label>
              <textarea
                name="goal"
                value={form.goal}
                onChange={handleChange}
                placeholder="What is the team committing to deliver in this sprint?"
              />
            </div>
            <div>
              <label>Start date</label>
              <input type="date" name="start_date" value={form.start_date} onChange={handleChange} />
            </div>
            <div>
              <label>End date</label>
              <input type="date" name="end_date" value={form.end_date} onChange={handleChange} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Sprint'}
            </button>
          </div>
        </form>
      );
    }

    openModal(<SprintForm />);
  };

  // Open Sprint Report Modal
  const openReportModal = async (sprintId) => {
    try {
      const rep = await sprintService.getReport(sprintId);

      openModal(
        <div style={{ minWidth: 480 }}>
          <div className="report-head">
            <div>
              <h2>{rep.sprint?.sprint_name}</h2>
              <p className="muted">{rep.sprint?.project_name} · {fmtDate(rep.sprint?.start_date)} → {fmtDate(rep.sprint?.end_date)}</p>
            </div>
            <Badge value={rep.state} />
          </div>

          {rep.sprint?.goal && (
            <div style={{ margin: '14px 0', padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
              <small className="muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Goal</small>
              <p style={{ marginTop: 4 }}>{rep.sprint.goal}</p>
            </div>
          )}

          <div className="stat-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div>
              <b>{rep.total_tasks}</b>
              <small>Total tasks</small>
            </div>
            <div>
              <b style={{ color: 'var(--green)' }}>{rep.done_tasks}</b>
              <small>Completed</small>
            </div>
            <div>
              <b>{rep.pct}%</b>
              <small>Completion rate</small>
            </div>
            <div>
              <b>{rep.total_hours || 0}h</b>
              <small>Estimated work</small>
            </div>
            <div>
              <b>{rep.spent_hours || 0}h</b>
              <small>Logged effort</small>
            </div>
            <div>
              <b style={{ color: 'var(--amber)' }}>{rep.open_issues}</b>
              <small>Open issues</small>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" onClick={closeModal}>Close</button>
            {isAdmin() && (
              <Link className="btn primary" to={`/tasks?sprint_id=${sprintId}`} onClick={closeModal}>
                <Icon name="kanban" /> Open board
              </Link>
            )}
          </div>
        </div>,
        true
      );
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  // Delete Sprint
  const handleDelete = async (sprint) => {
    const ok = await confirm(
      'Delete sprint?',
      `"${sprint.sprint_name}" will be deleted. Tasks belonging to this sprint will be moved to the backlog.`
    );
    if (!ok) return;

    try {
      await sprintService.delete(sprint.sprint_id);
      toast('Sprint deleted');
      loadData();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const filtered = sprints.filter(s => {
    if (statusFilter && sprintState(s) !== statusFilter) return false;
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sprints</h1>
          <p>{sprints.length} sprint{sprints.length === 1 ? '' : 's'} across your projects</p>
        </div>
        <div className="actions">
          {isMgr() && projects.length > 0 && (
            <button className="btn primary" onClick={() => openSprintModal()}>
              <Icon name="plus" /> Plan sprint
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <select
          value={selectedProj}
          onChange={e => handleProjectFilter(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
          ))}
        </select>

        <div className="seg">
          {['', 'Active', 'Upcoming', 'Ended'].map(st => (
            <button
              key={st}
              className={statusFilter === st ? 'on' : ''}
              onClick={() => setStatusFilter(st)}
            >
              {st || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Sprint Cards List */}
      {filtered.length > 0 ? (
        <div className="grid cols-2">
          {filtered.map(s => {
            const st = sprintState(s);
            return (
              <div key={s.sprint_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Ring pct={s.pct || 0} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: 16 }}>{s.sprint_name}</h3>
                      <Badge value={st} />
                    </div>
                    <div className="small muted" style={{ marginTop: 2 }}>{s.project_name}</div>
                  </div>
                </div>

                {s.goal && (
                  <p className="small muted" style={{ fontStyle: 'italic' }}>
                    "{s.goal}"
                  </p>
                )}

                <div className="facts" style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)' }}>
                  <span>
                    <Icon name="calendar" /> {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
                  </span>
                  <span>
                    <Icon name="check" /> {s.done || 0} of {s.total || 0} tasks done
                  </span>
                </div>

                <div className="foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 'auto' }}>
                  <button className="btn sm" onClick={() => openReportModal(s.sprint_id)}>
                    <Icon name="file" /> Report
                  </button>
                  {isAdmin() && (
                    <Link className="btn sm primary" to={`/tasks?sprint_id=${s.sprint_id}`}>
                      <Icon name="kanban" /> Board
                    </Link>
                  )}
                  {isMgr() && (
                    <>
                      <button className="btn sm" onClick={() => openSprintModal(s)}>
                        <Icon name="edit" />
                      </button>
                      <button className="btn sm danger" onClick={() => handleDelete(s)}>
                        <Icon name="trash" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <Empty
            icon="zap"
            title={statusFilter ? `No ${statusFilter.toLowerCase()} sprints` : 'No sprints found'}
            text={
              isMgr()
                ? 'Create a sprint to plan milestones and track team velocity.'
                : 'Sprint iterations will appear here once planned by a manager.'
            }
            action={
              isMgr() && !statusFilter && projects.length > 0 ? (
                <button className="btn primary" onClick={() => openSprintModal()}>
                  <Icon name="plus" /> Plan sprint
                </button>
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}
