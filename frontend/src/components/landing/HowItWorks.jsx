export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Create Your Project',
      desc: 'Initialize your project workspace, assign a Project Manager, and enroll team members with role-based access.',
      tag: 'Project Setup',
    },
    {
      num: '02',
      title: 'Plan Your Sprint',
      desc: 'Set sprint goals and duration, estimate story points, and commit backlog items to an active sprint milestone.',
      tag: 'Scrum Planning',
    },
    {
      num: '03',
      title: 'Assign & Execute',
      desc: 'Drag tasks across To Do, In Progress, Review, and Done. Add threaded discussion notes and file attachments in real time.',
      tag: 'Kanban Flow',
    },
    {
      num: '04',
      title: 'Track & Deliver',
      desc: 'Track sprint burndown velocity, resolve linked issues, and review AI delivery predictions to hit release targets.',
      tag: 'Verified Delivery',
    },
  ];

  return (
    <section className="how-section" id="workflow">
      <div className="landing-container">
        <div className="text-center">
          <div className="section-tag">Continuous Agile Execution</div>
          <h2 className="section-title">How DevFlow drives delivery in 4 steps</h2>
          <p className="section-desc">
            A frictionless workflow designed to take your team from sprint ideation to production deployment with
            complete visibility.
          </p>
        </div>

        <div className="how-timeline">
          {steps.map((step, idx) => (
            <div key={idx} className="how-step-card">
              <div className="how-step-number">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              <span className="how-step-tag">{step.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
