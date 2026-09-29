import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationService, dashboardService } from '../services';

import Icon from '../components/Icon';
import { Avatar } from '../components/UI';
import { ago } from '../utils/helpers';

const NAV = [
  ['Overview', [
    ['dashboard', 'Dashboard', 'grid'],
  ]],
  ['Work', [
    ['projects', 'Projects', 'folder'],
    ['sprints', 'Sprints', 'zap'],
    ['tasks', 'Task Board', 'kanban', 'admin'],
    ['issues', 'Issues', 'bug'],
  ]],
  ['Insights', [
    ['reports', 'Reports', 'file', 'mgr'],
    ['ai', 'AI Insights', 'sparkles'],
    ['activity', 'Activity', 'activity'],
  ]],
  ['Administration', [
    ['users', 'Users', 'users', 'admin'],
    ['settings', 'Settings', 'settings', 'admin'],
  ]],
];

export default function AppLayout({ org }) {
  const { user, logout, isAdmin, isMgr } = useAuth();
  const navigate = useNavigate();
  const [sideOpen, setSideOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('df_theme') || 'light');
  const [notes, setNotes] = useState([]);
  const [popover, setPopover] = useState(null); // 'bell' | 'me' | null
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const searchRef = useRef(null);
  const pollRef = useRef(null);

  // Theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('df_theme', theme);
  }, [theme]);

  // Notification polling
  useEffect(() => {
    let isMounted = true;
    const poll = async () => {
      const currentToken =
        sessionStorage.getItem('df_token') || sessionStorage.getItem('accessToken');
      if (!isMounted || !currentToken) return;

      try {
        const n = await notificationService.list();
        if (isMounted && Array.isArray(n)) {
          setNotes(n);
        }
      } catch (e) {
        // Polling errors handled silently by axios interceptors
      }
      if (isMounted) {
        pollRef.current = setTimeout(poll, 20000);
      }
    };

    poll();
    return () => {
      isMounted = false;
      if (pollRef.current) {
        clearTimeout(pollRef.current);
      }
    };
  }, []);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('#popover') && !e.target.closest('#bellBtn') && !e.target.closest('#avatarBtn')) {
        setPopover(null);
      }
      if (!e.target.closest('.search')) setSearchResults(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setPopover(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Search debounce
  useEffect(() => {
    if (!searchQ || searchQ.length < 2) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await dashboardService.search(searchQ);
        setSearchResults(r);
      } catch (e) {}
    }, 250);
    return () => clearTimeout(t);
  }, [searchQ]);

  const unreadCount = notes.filter(n => n.status === 'Unread').length;

  const allowed = (r) => !r || (r === 'mgr' && isMgr()) || (r === 'admin' && isAdmin());

  const markAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotes(prev => prev.map(n => ({ ...n, status: 'Read' })));
    } catch (e) {}
  };

  const handleSignOut = async () => {
    setPopover(null);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar${sideOpen ? ' open' : ''}`} id="sidebar">
        <div className="brand">
          <span className="brand-logo"></span>
          <span className="app-name">DevFlow</span>
        </div>
        <div className="org-chip" title={org || 'My organization'}>
          <span className="org-badge-icon">
            <Icon name="folder" />
          </span>
          <span className="org-name">{org || 'My organization'}</span>
        </div>
        <nav>
          {NAV.map(([group, items]) => {
            const vis = items.filter(i => allowed(i[3]));
            if (!vis.length) return null;
            return (
              <div key={group}>
                <div className="nav-group">{group}</div>
                {vis.map(([path, label, icon]) => (
                  <NavLink key={path} to={`/${path}`} className={({ isActive }) => isActive ? 'active' : ''}
                    onClick={() => setSideOpen(false)}>
                    <Icon name={icon} /><span>{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="side-foot">
          <button className="btn" onClick={handleSignOut}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
      </aside>

      {/* Scrim */}
      {sideOpen && <div className="scrim show" onClick={() => setSideOpen(false)}></div>}

      <main className="main">
        {/* Topbar */}
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setSideOpen(true)}>
            <Icon name="menu" />
          </button>

          {/* Search */}
          <div className="search" ref={searchRef}>
            <span className="search-ico"><Icon name="search" /></span>
            <input
              id="searchBox"
              placeholder="Search projects and tasks…"
              autoComplete="off"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            {searchResults && (
              <div className="search-results">
                {searchResults.projects?.length > 0 && (
                  <>
                    <div className="sr-h">Projects</div>
                    {searchResults.projects.map(p => (
                      <a key={p.project_id} href="#" onClick={e => {
                        e.preventDefault();
                        setSearchQ(''); setSearchResults(null);
                        navigate(isAdmin() ? '/tasks' : '/projects', { state: { projectId: p.project_id } });
                      }}>
                        {p.project_name} <Icon name="arrow" />
                      </a>
                    ))}
                  </>
                )}
                {isAdmin() && searchResults.tasks?.length > 0 && (
                  <>
                    <div className="sr-h">Tasks</div>
                    {searchResults.tasks.map(t => (
                      <a key={t.task_id} href="#" onClick={e => {
                        e.preventDefault();
                        setSearchQ(''); setSearchResults(null);
                        navigate(`/task/${t.task_id}`);
                      }}>
                        {t.title} <span className={`badge b-${t.status?.replace(/\s+/g, '-')}`}>{t.status}</span>
                      </a>
                    ))}
                  </>
                )}
                {!searchResults.projects?.length && (!isAdmin() || !searchResults.tasks?.length) && (
                  <div className="sr-h">No results for "{searchQ}"</div>
                )}
              </div>
            )}
          </div>

          <div className="top-actions">
            {/* Theme toggle */}
            <button className="icon-btn" title="Toggle theme" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>

            {/* Notifications */}
            <button className="icon-btn" id="bellBtn" title="Notifications"
              onClick={() => setPopover(p => p === 'bell' ? null : 'bell')}>
              <Icon name="bell" />
              {unreadCount > 0 && (
                <span className="dot-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {/* Avatar */}
            <button className="avatar-btn" id="avatarBtn"
              onClick={() => setPopover(p => p === 'me' ? null : 'me')}>
              <Avatar name={user?.name} />
            </button>
          </div>
        </header>

        {/* Popover */}
        {popover && (
          <div className="popover" id="popover">
            {popover === 'bell' && (
              <div>
                <div className="pop-head">
                  Notifications{' '}
                  <a className="small" style={{ cursor: 'pointer' }} onClick={markAllRead}>Mark all read</a>
                </div>
                {notes.length === 0 ? (
                  <div className="empty sm">
                    <h3>You're all caught up</h3>
                  </div>
                ) : notes.map(n => (
                  <div key={n.notification_id} className={`note ${n.status}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setPopover(null); if (n.link) navigate('/' + n.link); }}>
                    <Icon name="bell" />
                    <div>{n.message}<small>{ago(n.created_at)}</small></div>
                  </div>
                ))}
              </div>
            )}
            {popover === 'me' && (
              <div>
                <div className="pop-head">
                  <div className="person">
                    <Avatar name={user?.name} />
                    <div><b>{user?.name}</b><small>{user?.email}</small></div>
                  </div>
                </div>
                <div className="menu">
                  <a onClick={() => { setPopover(null); navigate('/profile'); }}><Icon name="user" /> My profile</a>
                  <a onClick={() => { setPopover(null); navigate('/profile'); }}><Icon name="key" /> Change password</a>
                  <a onClick={handleSignOut}><Icon name="logout" /> Sign out</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Page content */}
        <section className="view">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
