import { useState } from 'react';

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      q: 'What is DevFlow Agile Workspace?',
      a: 'DevFlow is a full-stack Agile project management platform that combines Scrum sprint planning, multi-status Kanban boards, issue defect tracking, and AI-driven delivery forecasting into a unified workspace.',
    },
    {
      q: 'Who is DevFlow built for?',
      a: 'DevFlow is engineered for software development teams, tech leads, Scrum Masters, product managers, and QA engineers who need frictionless visibility across project roadmaps, sprints, and code deliverables.',
    },
    {
      q: 'How does sprint and task management work in the application?',
      a: 'You can create projects, enroll team members, and schedule timeboxed sprints. Backlog tasks are assigned story points, priority ratings, and assignees, and moved seamlessly across Kanban columns (To Do, In Progress, Review, and Done).',
    },
    {
      q: 'How does the AI Insights feature assist our team?',
      a: 'DevFlow evaluates your sprint velocity history, overdue commitments, and workload balance to calculate delivery confidence percentages, highlight schedule risks, and suggest task priority rebalancing that you can apply with one click.',
    },
    {
      q: 'Can team members have different permission roles?',
      a: 'Yes. DevFlow provides 5 granular role tiers: Admin (system settings and user management), Manager (project and sprint creation), Developer (task execution), Tester (issue reporting), and Viewer (read-only monitoring).',
    },
    {
      q: 'How does authentication and session security work?',
      a: 'Accounts are verified with a 6-digit email OTP sent via Google OAuth2. Authenticated sessions use 15-minute JWT access tokens kept securely in session storage, backed by secure httpOnly refresh token cookies with automatic rotation.',
    },
    {
      q: 'Can teams collaborate with comments and attachments?',
      a: 'Yes. Every task includes an interactive slide-over drawer with contextual discussion threads, author stamps, and multipart file upload support for screenshots and architectural specifications.',
    },
  ];

  const toggle = (idx) => {
    setOpenIdx((current) => (current === idx ? -1 : idx));
  };

  return (
    <section className="faq-section" id="faq">
      <div className="landing-container">
        <div className="text-center">
          <div className="section-tag">Frequently Asked Questions</div>
          <h2 className="section-title">Everything you need to know about DevFlow</h2>
          <p className="section-desc">
            Direct, transparent answers regarding features, security, role management, and sprint workflows.
          </p>
        </div>

        <div className="faq-container">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className={`faq-item${isOpen ? ' open' : ''}`}>
                <button
                  className="faq-trigger"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.q}</span>
                  <svg className="faq-icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div className="faq-answer">
                  <div className="faq-answer-inner">
                    <p>{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
