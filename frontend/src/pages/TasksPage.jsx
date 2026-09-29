import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { taskService, projectService, sprintService, userService } from '../services';
import { useModal, useConfirm, useToast } from '../components/Overlays';
import { Badge, Avatar, Person, Empty, LoadingSpinner } from '../components/UI';
import Icon from '../components/Icon';
import {
  fmtDate,
  toDateInput,
  isLate,
  STATUSES,
  STATUS_COLOR,
  downloadCSV,
  ago
} from '../utils/helpers';

export default function TasksPage() {
  const { user, isMgr } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { openModal, closeModal, openDrawer, closeDrawer } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);

  // Filters
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project_id') || '');
  const [sprintFilter, setSprintFilter] = useState(searchParams.get('sprint_id') || '');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [loading, setLoading] = useState(true);

  // Dragging state
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (projectFilter) params.project_id = projectFilter;
      if (sprintFilter) params.sprint_id = sprintFilter;
      if (assigneeFilter) params.assigned_to = assigneeFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const [ts, pr, us] = await Promise.all([
        taskService.list(params),
        projectService.list(),
        userService.list().catch(() => [])
      ]);
      setTasks(ts);
      setProjects(pr);
      setTeamUsers(us);

      if (projectFilter) {
        const sp = await sprintService.list({ project_id: projectFilter });
        setSprints(sp);
      } else {
        const sp = await sprintService.list({});
        setSprints(sp);
      }
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [projectFilter, sprintFilter, assigneeFilter, priorityFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Project Filter Change
  const handleProjectChange = (pid) => {
    setProjectFilter(pid);
    setSprintFilter('');
    const p = {};
    if (pid) p.project_id = pid;
    setSearchParams(p);
  };

  // Open Task Detail Drawer
  const openTaskDrawer = async (taskId) => {
    try {
      const task = await taskService.get(taskId);

      function TaskDetail() {
        const [t, setT] = useState(task);
        const [commentMsg, setCommentMsg] = useState('');
        const [file, setFile] = useState(null);
        const [postingComment, setPostingComment] = useState(false);
        const [uploadingFile, setUploadingFile] = useState(false);

        const handleStatusChange = async (newStatus) => {
          try {
            await taskService.update(t.task_id, { status: newStatus });
            setT(prev => ({ ...prev, status: newStatus }));
            toast(`Status set to ${newStatus}`);
            loadData();
          } catch (err) {
            toast(err.message, 'err');
          }
        };

        const handleAddComment = async (e) => {
          e.preventDefault();
          if (!commentMsg.trim()) return;
          setPostingComment(true);
          try {
            await taskService.addComment(t.task_id, { message: commentMsg.trim() });
            const updated = await taskService.get(t.task_id);
            setT(updated);
            setCommentMsg('');
            toast('Comment added');
          } catch (err) {
            toast(err.message, 'err');
          } finally {
            setPostingComment(false);
          }
        };

        const handleUploadAttachment = async (e) => {
          e.preventDefault();
          if (!file) return;
          setUploadingFile(true);
          try {
            const formData = new FormData();
            formData.append('file', file);
            await taskService.addAttachment(t.task_id, formData);
            const updated = await taskService.get(t.task_id);
            setT(updated);
            setFile(null);
            toast('Attachment uploaded');
          } catch (err) {
            toast(err.message, 'err');
          } finally {
            setUploadingFile(false);
          }
        };

        const late = isLate(t);

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <span className="proj">{t.project_name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn sm"
                  onClick={() => { closeDrawer(); openTaskModal(t); }}
                >
                  <Icon name="edit" /> Edit
                </button>
                {isMgr() && (
                  <button
                    className="btn sm danger"
                    onClick={async () => {
                      const ok = await confirm('Delete task?', `"${t.title}" will be permanently removed.`);
                      if (ok) {
                        await taskService.delete(t.task_id);
                        closeDrawer();
                        toast('Task deleted');
                        loadData();
                      }
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </div>
            </div>

            <h2 style={{ marginTop: 12, marginBottom: 8 }}>{t.title}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge value={t.priority} />
              <Badge value={t.status} />
              {late && <span className="badge b-High">Overdue</span>}
              {t.sprint_name && <span className="small muted">Sprint: <b>{t.sprint_name}</b></span>}
            </div>

            {t.description && (
              <div style={{ margin: '18px 0', padding: 14, background: 'var(--surface-2)', borderRadius: 10, lineHeight: 1.6 }}>
                <p>{t.description}</p>
              </div>
            )}

            {/* Quick Status Select */}
            <div style={{ margin: '16px 0' }}>
              <label>Update Status</label>
              <select
                value={t.status}
                onChange={e => handleStatusChange(e.target.value)}
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Facts Grid */}
            <div className="facts-grid">
              <div className="fact">
                <small>Assignee</small>
                <Person name={t.assignee || 'Unassigned'} />
              </div>
              <div className="fact">
                <small>Deadline</small>
                <b className={late ? 'late-txt' : ''}>{fmtDate(t.deadline)}</b>
              </div>
              <div className="fact">
                <small>Estimated Hours</small>
                <b>{t.estimated_hours || 0} hrs</b>
              </div>
              <div className="fact">
                <small>Complexity (1-5)</small>
                <b>{'★'.repeat(t.complexity || 3)} ({t.complexity || 3}/5)</b>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="section">
              <h4><Icon name="file" /> Attachments ({(t.attachments || []).length})</h4>
              {t.attachments && t.attachments.length > 0 ? (
                <div style={{ marginBottom: 12 }}>
                  {t.attachments.map(att => (
                    <div key={att.attachment_id} className="file-row">
                      <Icon name="file" />
                      <div className="grow">
                        <a href={`http://localhost:5000${att.file_path}`} target="_blank" rel="noreferrer" download>
                          {att.file_name}
                        </a>
                        <div className="small muted">Uploaded {ago(att.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted" style={{ marginBottom: 10 }}>No files attached yet.</p>
              )}

              <form onSubmit={handleUploadAttachment} className="composer">
                <input
                  type="file"
                  onChange={e => setFile(e.target.files[0])}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn sm primary" disabled={!file || uploadingFile}>
                  <Icon name="plus" /> Upload
                </button>
              </form>
            </div>

            {/* Comments Section */}
            <div className="section">
              <h4><Icon name="list" /> Activity & Discussion ({(t.comments || []).length})</h4>
              <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
                {t.comments && t.comments.length > 0 ? (
                  t.comments.map(c => (
                    <div key={c.comment_id} className="comment">
                      <Avatar name={c.user_name} size="sm" />
                      <div className="bubble">
                        <b>{c.user_name || 'Team member'}</b>
                        <small>{ago(c.created_at)}</small>
                        <p>{c.message}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="small muted">No comments yet. Start a discussion below.</p>
                )}
              </div>

              <form onSubmit={handleAddComment} className="composer">
                <input
                  placeholder="Write a comment..."
                  value={commentMsg}
                  onChange={e => setCommentMsg(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn sm primary" disabled={!commentMsg.trim() || postingComment}>
                  Post
                </button>
              </form>
            </div>
          </div>
        );
      }

      openDrawer(<TaskDetail />);
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  // Open Task Modal (Create or Edit)
  const openTaskModal = (task = null) => {
    const isEdit = Boolean(task?.task_id);
    const initial = {
      project_id: task?.project_id || (projectFilter ? Number(projectFilter) : (projects[0]?.project_id || '')),
      sprint_id: task?.sprint_id || (sprintFilter ? Number(sprintFilter) : ''),
      title: task?.title || '',
      description: task?.description || '',
      priority: task?.priority || 'Medium',
      status: task?.status || 'Pending',
      assigned_to: task?.assigned_to || user.user_id,
      deadline: toDateInput(task?.deadline),
      estimated_hours: task?.estimated_hours || 4,
      complexity: task?.complexity || 3,
    };

    function TaskForm() {
      const [form, setForm] = useState(initial);
      const [submitting, setSubmitting] = useState(false);
      const [modalSprints, setModalSprints] = useState(sprints);

      useEffect(() => {
        if (form.project_id) {
          sprintService.list({ project_id: form.project_id }).then(setModalSprints).catch(() => {});
        }
      }, [form.project_id]);

      const handleChange = e => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
      };

      const handleSubmit = async e => {
        e.preventDefault();
        setSubmitting(true);
        try {
          if (isEdit) {
            await taskService.update(task.task_id, form);
            toast('Task updated successfully');
          } else {
            await taskService.create(form);
            toast('Task created successfully');
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
          <h2>{isEdit ? 'Edit task' : 'Create new task'}</h2>
          <p className="lead">{isEdit ? 'Update task details' : 'Add a task to your project backlog or current sprint.'}</p>
          <div className="form-grid">
            <div className="full">
              <label>Task title *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="e.g. Implement OAuth login and session renewal"
              />
            </div>
            <div className="full">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Requirements, acceptance criteria, notes..."
              />
            </div>
            <div>
              <label>Project *</label>
              <select name="project_id" value={form.project_id} onChange={handleChange} required>
                {projects.map(p => (
                  <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Sprint</label>
              <select name="sprint_id" value={form.sprint_id || ''} onChange={handleChange}>
                <option value="">(Backlog / No Sprint)</option>
                {modalSprints.map(s => (
                  <option key={s.sprint_id} value={s.sprint_id}>{s.sprint_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Assignee</label>
              <select name="assigned_to" value={form.assigned_to || ''} onChange={handleChange}>
                <option value="">Unassigned</option>
                {teamUsers.filter(u => u.active).map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.name} ({u.designation || u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label>Deadline</label>
              <input type="date" name="deadline" value={form.deadline} onChange={handleChange} />
            </div>
            <div>
              <label>Estimated Hours</label>
              <input type="number" step="0.5" name="estimated_hours" value={form.estimated_hours} onChange={handleChange} />
            </div>
            <div>
              <label>Complexity (1-5)</label>
              <select name="complexity" value={form.complexity} onChange={handleChange}>
                <option value="1">1 - Trivial</option>
                <option value="2">2 - Easy</option>
                <option value="3">3 - Moderate</option>
                <option value="4">4 - Complex</option>
                <option value="5">5 - Critical</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      );
    }

    openModal(<TaskForm />);
  };

  // Drag-and-drop Handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    // Optimistically update
    setTasks(prev => prev.map(t => t.task_id === Number(taskId) ? { ...t, status: targetStatus } : t));
    try {
      await taskService.update(taskId, { status: targetStatus });
      toast(`Moved to ${targetStatus}`);
    } catch (err) {
      toast(err.message, 'err');
      loadData();
    } finally {
      setDraggedTaskId(null);
    }
  };

  // Filter tasks locally by search text
  const filtered = tasks.filter(t => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      const match = (t.title && t.title.toLowerCase().includes(q)) ||
                    (t.project_name && t.project_name.toLowerCase().includes(q)) ||
                    (t.assignee && t.assignee.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const exportCSV = () => {
    downloadCSV(`tasks_export_${new Date().toISOString().slice(0, 10)}.csv`, filtered);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Task Board</h1>
          <p>{filtered.length} task{filtered.length === 1 ? '' : 's'} displayed</p>
        </div>
        <div className="actions">
          <div className="seg">
            <button
              className={viewMode === 'kanban' ? 'on' : ''}
              onClick={() => setViewMode('kanban')}
            >
              <Icon name="kanban" /> Board
            </button>
            <button
              className={viewMode === 'table' ? 'on' : ''}
              onClick={() => setViewMode('table')}
            >
              <Icon name="list" /> List
            </button>
          </div>
          <button className="btn" onClick={exportCSV} title="Export tasks to CSV">
            <Icon name="file" /> Export CSV
          </button>
          <button className="btn primary" onClick={() => openTaskModal()}>
            <Icon name="plus" /> New task
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="filters">
        <select
          value={projectFilter}
          onChange={e => handleProjectChange(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
          ))}
        </select>

        <select
          value={sprintFilter}
          onChange={e => setSprintFilter(e.target.value)}
        >
          <option value="">All sprints</option>
          {sprints.map(s => (
            <option key={s.sprint_id} value={s.sprint_id}>{s.sprint_name}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="">All priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
        >
          <option value="">All assignees</option>
          <option value={user.user_id}>Assigned to me</option>
          {teamUsers.filter(u => u.active && u.user_id !== user.user_id).map(u => (
            <option key={u.user_id} value={u.user_id}>{u.name}</option>
          ))}
        </select>

        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            placeholder="Search tasks..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="board">
          {STATUSES.map(statusCol => {
            const colTasks = filtered.filter(t => t.status === statusCol);
            return (
              <div
                key={statusCol}
                className="col"
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, statusCol)}
              >
                <div className="col-head">
                  <span
                    className="dot"
                    style={{ background: STATUS_COLOR[statusCol] }}
                  ></span>
                  <span>{statusCol}</span>
                  <span className="n">{colTasks.length}</span>
                </div>

                {colTasks.length > 0 ? (
                  colTasks.map(t => {
                    const late = isLate(t);
                    return (
                      <div
                        key={t.task_id}
                        className={`tcard p-${t.priority}${draggedTaskId === t.task_id ? ' dragging' : ''}`}
                        draggable
                        onDragStart={e => handleDragStart(e, t.task_id)}
                        onClick={() => openTaskDrawer(t.task_id)}
                      >
                        <div className="row">
                          <span className="proj">{t.project_name}</span>
                          <Badge value={t.priority} />
                        </div>
                        <div className="t">{t.title}</div>
                        <div className="row">
                          <Avatar name={t.assignee} size="sm" />
                          {t.deadline && (
                            <span className={late ? 'late-txt' : ''}>
                              <Icon name="calendar" /> {fmtDate(t.deadline)}
                            </span>
                          )}
                          <span>{t.estimated_hours || 0}h</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-empty">Drop tasks here</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="card table-card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th>Project</th>
                  <th>Sprint</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Deadline</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map(t => {
                    const late = isLate(t);
                    return (
                      <tr
                        key={t.task_id}
                        className="click"
                        onClick={() => openTaskDrawer(t.task_id)}
                      >
                        <td>
                          <b>{t.title}</b>
                        </td>
                        <td>{t.project_name}</td>
                        <td>{t.sprint_name || '—'}</td>
                        <td><Badge value={t.status} /></td>
                        <td><Badge value={t.priority} /></td>
                        <td><Person name={t.assignee} /></td>
                        <td className={late ? 'late-txt' : ''}>{fmtDate(t.deadline)}</td>
                        <td>{t.estimated_hours || 0}h</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: 32 }}>
                      <Empty icon="kanban" title="No tasks found" text="Try clearing search filters or add a new task." sm />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
