import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService, userService } from '../services';
import { useModal, useConfirm, useToast } from '../components/Overlays';
import { Badge, Person, Progress, Empty, LoadingSpinner } from '../components/UI';
import Icon from '../components/Icon';
import { fmtDate, toDateInput } from '../utils/helpers';

export default function ProjectsPage() {
  const { user, isMgr, isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { openModal, closeModal } = useModal();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [projs, us] = await Promise.all([
        projectService.list(),
        isMgr() ? userService.list().catch(() => []) : Promise.resolve([])
      ]);
      setProjects(projs);
      setUsers(us);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [isMgr, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Project Form Modal (Create or Edit)
  const openProjectModal = (proj = null) => {
    const isEdit = Boolean(proj?.project_id);
    const initial = {
      project_name: proj?.project_name || '',
      description: proj?.description || '',
      start_date: toDateInput(proj?.start_date),
      end_date: toDateInput(proj?.end_date),
      manager_id: proj?.manager_id || user.user_id,
      status: proj?.status || 'Active',
    };

    const managers = users.filter(u => u.active && u.role !== 'Member');

    function ProjectForm() {
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
            await projectService.update(proj.project_id, form);
            toast('Project updated successfully');
          } else {
            const res = await projectService.create(form);
            toast('Project created successfully');
            closeModal();
            await loadData();
            if (res.project_id) openMembersModal(res.project_id, form.project_name);
            return;
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
          <h2>{isEdit ? 'Edit project' : 'New project'}</h2>
          <p className="lead">{isEdit ? 'Update project details' : 'Define your project. You can add team members next.'}</p>
          <div className="form-grid">
            <div className="full">
              <label>Project Name *</label>
              <input
                name="project_name"
                value={form.project_name}
                onChange={handleChange}
                required
                placeholder="e.g. Mobile App Redesign"
              />
            </div>
            <div className="full">
              <label>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Scope, objectives, goals..."
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
            {isAdmin() && (
              <div>
                <label>Project Manager</label>
                <select name="manager_id" value={form.manager_id} onChange={handleChange}>
                  {managers.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>
            )}
            {isEdit && (
              <div>
                <label>Status</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      );
    }

    openModal(<ProjectForm />);
  };

  // Open Project Members Modal
  const openMembersModal = async (projectId, projectName) => {
    try {
      const [members, allUsers] = await Promise.all([
        projectService.getMembers(projectId),
        userService.list().catch(() => [])
      ]);

      function MembersView({ initialMembers }) {
        const [mList, setMList] = useState(initialMembers);
        const [selectedUser, setSelectedUser] = useState('');
        const [adding, setAdding] = useState(false);

        const available = allUsers.filter(u => u.active && !mList.some(m => m.user_id === u.user_id));

        const handleAdd = async () => {
          if (!selectedUser) return;
          setAdding(true);
          try {
            await projectService.addMember(projectId, { user_id: selectedUser });
            const updated = await projectService.getMembers(projectId);
            setMList(updated);
            setSelectedUser('');
            toast('Team member added');
            loadData();
          } catch (err) {
            toast(err.message, 'err');
          } finally {
            setAdding(false);
          }
        };

        const handleRemove = async (userId) => {
          try {
            await projectService.removeMember(projectId, userId);
            setMList(prev => prev.filter(m => m.user_id !== userId));
            toast('Member removed');
            loadData();
          } catch (err) {
            toast(err.message, 'err');
          }
        };

        return (
          <div>
            <h2>Team · {projectName}</h2>
            <p className="lead">{mList.length} member{mList.length === 1 ? '' : 's'} assigned to this project</p>

            {isMgr() && (
              <div className="composer" style={{ margin: '18px 0' }}>
                <select
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Select a user to add...</option>
                  {available.map(u => (
                    <option key={u.user_id} value={u.user_id}>{u.name} ({u.designation || u.role})</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!selectedUser || adding}
                  onClick={handleAdd}
                >
                  <Icon name="plus" /> Add Member
                </button>
              </div>
            )}

            <div className="list" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {mList.map(m => (
                <div key={m.user_id} className="list-item">
                  <Person name={m.name} sub={`${m.designation || m.role} · ${m.email}`} />
                  <div className="grow"></div>
                  <Badge value={m.role} />
                  {isMgr() && (
                    <button
                      className="btn sm danger"
                      title="Remove from project"
                      onClick={() => handleRemove(m.user_id)}
                    >
                      <Icon name="x" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button className="btn" onClick={closeModal}>Done</button>
            </div>
          </div>
        );
      }

      openModal(<MembersView initialMembers={members} />);
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  // Delete project
  const handleDelete = async (proj) => {
    const ok = await confirm(
      'Delete project?',
      `"${proj.project_name}" and all associated sprints, tasks, and issues will be permanently deleted.`
    );
    if (!ok) return;

    try {
      await projectService.delete(proj.project_id);
      toast('Project deleted');
      loadData();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const filtered = projects.filter(p => !statusFilter || p.status === statusFilter);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p>{projects.length} project{projects.length === 1 ? '' : 's'} in your workspace</p>
        </div>
        <div className="actions">
          {isMgr() && (
            <button className="btn primary" onClick={() => openProjectModal()}>
              <Icon name="plus" /> New project
            </button>
          )}
        </div>
      </div>

      {/* Filter Segment */}
      {projects.length > 0 && (
        <div className="filters">
          <div className="seg">
            {['', 'Active', 'On Hold', 'Completed'].map(s => (
              <button
                key={s}
                className={statusFilter === s ? 'on' : ''}
                onClick={() => setStatusFilter(s)}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {filtered.length > 0 ? (
        <div className="grid cols-3">
          {filtered.map(p => (
            <div key={p.project_id} className="card proj-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <h3>{p.project_name}</h3>
                <Badge value={p.status} />
              </div>
              <div className="desc">{p.description || 'No description provided.'}</div>
              <div className="facts">
                <span>
                  <Icon name="calendar" /> {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                </span>
                <span>
                  <Icon name="users" /> {p.members || 0} member{p.members === 1 ? '' : 's'}
                </span>
              </div>
              <div>
                <Progress value={p.pct || 0} />
                <div className="small muted" style={{ marginTop: 4 }}>
                  {p.done || 0} of {p.total || 0} tasks completed
                </div>
              </div>
              <div className="foot">
                <Person name={p.manager || '—'} sub="Project manager" />
                <div style={{ display: 'flex', gap: 6 }}>
                  {isAdmin() && (
                    <Link className="btn sm" to={`/tasks?project_id=${p.project_id}`}>
                      <Icon name="kanban" /> Board
                    </Link>
                  )}
                  <button
                    className="btn sm"
                    title="Manage team"
                    onClick={() => openMembersModal(p.project_id, p.project_name)}
                  >
                    <Icon name="users" />
                  </button>
                  {isMgr() && (
                    <>
                      <button
                        className="btn sm"
                        title="Edit project"
                        onClick={() => openProjectModal(p)}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className="btn sm danger"
                        title="Delete project"
                        onClick={() => handleDelete(p)}
                      >
                        <Icon name="trash" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <Empty
            icon="folder"
            title={statusFilter ? `No ${statusFilter.toLowerCase()} projects` : 'No projects yet'}
            text={
              isMgr()
                ? 'Create your first project to start planning sprints and tasks.'
                : "You'll see projects here once a manager adds you to a team."
            }
            action={
              isMgr() && !statusFilter ? (
                <button className="btn primary" onClick={() => openProjectModal()}>
                  <Icon name="plus" /> Create project
                </button>
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}
