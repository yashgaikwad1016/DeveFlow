import { useEffect } from 'react';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import SocialProof from '../components/landing/SocialProof';
import ProblemSection from '../components/landing/ProblemSection';
import SolutionSection from '../components/landing/SolutionSection';
import HowItWorks from '../components/landing/HowItWorks';
import FAQSection from '../components/landing/FAQSection';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';
import '../components/landing/LandingPage.css';

export default function LandingPage() {
  // Update document title for SEO & branding
  useEffect(() => {
    document.title = 'DevFlow — Modern Agile Workspace & Sprint Management';
  }, []);

  return (
    <div className="landing-wrapper">
      {/* Background Atmosphere Light Glows */}
      <div className="landing-ambient-glow" aria-hidden="true">
        <div className="landing-glow-1"></div>
        <div className="landing-glow-2"></div>
        <div className="landing-glow-3"></div>
      </div>

      {/* 1. Header Navigation */}
      <Navbar />

      <main>
        {/* 2. Hero Section with Interactive 3D Agile Workspace */}
        <HeroSection />

        {/* 3. Social Proof & Technical Credibility */}
        <SocialProof />

        {/* 4. Problem Statement: The Agile Bottleneck */}
        <ProblemSection />

        {/* 5. Solution / Value Section: One Centralized Workspace */}
        <SolutionSection />

        {/* 6. How It Works: 4-Step Agile Lifecycle */}
        <HowItWorks />

        {/* 7. FAQ Section: Expandable Accordion */}
        <FAQSection />

        {/* 8. Final CTA Section */}
        <FinalCTA />
      </main>

      {/* 9. Professional Footer */}
      <Footer />
    </div>
  );
}
