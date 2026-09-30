import Icon from '../Icon';

export default function ProblemSection() {
  const problems = [
    {
      icon: 'alert',
      title: 'Scattered Project Context',
      desc: 'Requirements, discussions, and attachments get stranded across disparate tools, breaking developer focus.',
      impact: 'Lost Context & Time',
    },
    {
      icon: 'clock',
      title: 'Sprint Blind Spots',
      desc: 'Teams discover velocity bottlenecks and scope creep only on the last day of the cycle when it is too late.',
      impact: 'Missed Release Dates',
    },
    {
      icon: 'users',
      title: 'Unclear Task Ownership',
      desc: 'Tasks languish without clear assignees, defined story points, or synchronized status updates.',
      impact: 'Workflow Friction',
    },
    {
      icon: 'bug',
      title: 'Isolated Defect Management',
      desc: 'Bug reports live in isolation without direct linkage to active sprints or responsible code owners.',
      impact: 'Regression Loops',
    },
    {
      icon: 'trend',
      title: 'Unmeasured Velocity',
      desc: 'Decisions are made on gut feeling rather than verified burndown charts, lead times, and capacity metrics.',
      impact: 'Unpredictable Delivery',
    },
    {
      icon: 'shield',
      title: 'Security & Role Confusion',
      desc: 'Lack of granular permissions allows unvetted status changes or accidental deletion of critical milestones.',
      impact: 'Governance Risks',
    },
  ];

  return (
    <section className="problem-section" id="problems">
      <div className="landing-container">
        <div className="text-center">
          <div className="section-tag">The Agile Bottleneck</div>
          <h2 className="section-title">Why standard team workflows break down</h2>
          <p className="section-desc">
            Modern development moves fast. When project tracking, sprint planning, and bug tracking live in
            separate silos, software delivery grinds to a halt.
          </p>
        </div>

        <div className="problem-grid">
          {problems.map((prob, idx) => (
            <div key={idx} className="problem-card">
              <div className="problem-card-icon">
                <Icon name={prob.icon} />
              </div>
              <h3>{prob.title}</h3>
              <p>{prob.desc}</p>
              <span className="problem-impact-pill">{prob.impact}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
