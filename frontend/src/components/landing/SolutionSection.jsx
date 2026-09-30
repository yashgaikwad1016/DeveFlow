import Icon from '../Icon';

export default function SolutionSection() {
  const solutions = [
    {
      icon: 'zap',
      colorClass: '',
      title: 'Scrum Sprint Planning',
      desc: 'Define sprint commitments, assign total story points, and monitor real-time completion velocity from planning to retro.',
      badge: 'Sprints & Backlog',
    },
    {
      icon: 'kanban',
      colorClass: 'green',
      title: 'Interactive Kanban Boards',
      desc: 'Visualize work-in-progress across To Do, In Progress, Review, and Done columns with instant drag-and-drop status transitions.',
      badge: 'Multi-Status Boards',
    },
    {
      icon: 'sparkles',
      colorClass: 'violet',
      title: 'AI Delivery Intelligence',
      desc: 'Leverage algorithmic analysis to detect schedule risks, evaluate team workload, and auto-recommend task priority adjustments.',
      badge: 'Predictive Insights',
    },
    {
      icon: 'bug',
      colorClass: 'amber',
      title: 'Unified Defect & Issue Tracker',
      desc: 'Capture, categorize, and resolve software bugs with severity classifications (Low to Critical) linked directly to affected tasks.',
      badge: 'Defect Management',
    },
    {
      icon: 'msg',
      colorClass: '',
      title: 'Task Discussions & Attachments',
      desc: 'Keep conversation in context. Slide-over task detail drawers support threaded comments and file uploads directly with your team.',
      badge: 'Contextual Collaboration',
    },
    {
      icon: 'activity',
      colorClass: 'green',
      title: 'Audit Trails & Notifications',
      desc: 'Never miss an update. Stay informed with real-time in-app notification badges and a chronological workspace activity log.',
      badge: 'Live Audit Log',
    },
  ];

  return (
    <section className="solution-section" id="features">
      <div className="landing-container">
        <div className="text-center">
          <div className="section-tag">One Centralized Workspace</div>
          <h2 className="section-title">Engineered to accelerate your entire sprint cycle</h2>
          <p className="section-desc">
            No fragmented tools. No sync delays. DevFlow bridges planning, coding, review, and retrospective in a
            single, unified interface.
          </p>
        </div>

        <div className="solution-grid">
          {solutions.map((item, idx) => (
            <div key={idx} className="solution-card">
              <div className={`solution-icon-box ${item.colorClass}`}>
                <Icon name={item.icon} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <div className="solution-badge">
                <span>{item.badge}</span>
                <Icon name="arrow" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
