import Icon from '../Icon';

export default function SocialProof() {
  const proofItems = [
    {
      icon: 'kanban',
      title: 'Full Agile Lifecycle',
      desc: 'Seamless Scrum sprints, backlogs & interactive Kanban execution',
    },
    {
      icon: 'db',
      title: 'Enterprise Architecture',
      desc: 'High-performance MySQL relational engine + MongoDB auth security',
    },
    {
      icon: 'sparkles',
      title: 'AI Delivery Forecasting',
      desc: 'Algorithmic task priority analysis & milestone velocity prediction',
    },
    {
      icon: 'shield',
      title: '5-Tier Role Governance',
      desc: 'Granular permissions for Admins, Managers, Devs, Testers & Viewers',
    },
  ];

  return (
    <section className="proof-section">
      <div className="landing-container">
        <div className="proof-headline">Engineered for modern high-velocity software engineering teams</div>

        <div className="proof-grid">
          {proofItems.map((item, idx) => (
            <div key={idx} className="proof-card">
              <div className="proof-icon-box">
                <Icon name={item.icon} />
              </div>
              <div>
                <div className="proof-title">{item.title}</div>
                <div className="proof-sub">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
