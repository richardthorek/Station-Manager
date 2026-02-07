/**
 * Onboarding Wizard Component
 *
 * Interactive 5-step guided tour for new users to understand Station Manager.
 * Features progress indicator, skip functionality, and plain language explanations.
 *
 * Steps:
 * 0. Welcome - "Welcome to Station Manager"
 * 1. Station Selection - "Choose your station or demo"
 * 2. Sign-In System - "Track who's at the station"
 * 3. Events - "Organize incidents, training, meetings"
 * 4. You're Ready - "Explore at your own pace"
 */

import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { markOnboardingComplete } from '../utils/onboardingUtils';
import './OnboardingWizard.css';

interface OnboardingWizardProps {
  onClose: () => void;
}

interface Step {
  title: string;
  icon: string;
  description: string;
  details: string[];
  actionLabel?: string;
  actionPath?: string;
}

const ONBOARDING_STEPS: Step[] = [
  {
    title: 'Welcome to Station Manager',
    icon: '👋',
    description: 'Your complete digital management solution for fire stations',
    details: [
      'Track member presence in real-time',
      'Manage station activities and events',
      'Coordinate vehicle maintenance',
      'Sync instantly across all devices'
    ]
  },
  {
    title: 'Choose Your Station',
    icon: '🚒',
    description: 'Select your station or try the demo',
    details: [
      'Use the station selector in the header',
      'Try the demo station with sample data',
      'Create your own station when ready',
      'Switch stations anytime'
    ]
  },
  {
    title: 'Track Member Presence',
    icon: '✅',
    description: 'Quick check-in and check-out for all members',
    details: [
      'Members sign in with one tap',
      'Track who\'s at the station right now',
      'Select activities (Training, Maintenance, etc.)',
      'View history and attendance reports'
    ],
    actionLabel: 'Go to Sign-In',
    actionPath: '/signin'
  },
  {
    title: 'Organize Events',
    icon: '📅',
    description: 'Manage incidents, training sessions, and meetings',
    details: [
      'Create events for incidents and activities',
      'Track participants in real-time',
      'View active and past events',
      'Generate attendance reports'
    ]
  },
  {
    title: 'You\'re Ready!',
    icon: '🎉',
    description: 'Explore Station Manager at your own pace',
    details: [
      'Check out Reports & Analytics',
      'Set up Truck Checks for vehicles',
      'Invite your team members',
      'Access this guide anytime from the landing page'
    ],
    actionLabel: 'Get Started',
    actionPath: '/'
  }
];

export function OnboardingWizard({ onClose }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const totalSteps = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSkip = () => {
    markOnboardingComplete();
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleComplete = () => {
    markOnboardingComplete();
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      if (step.actionPath) {
        navigate(step.actionPath);
      }
    }, 300);
  };

  const handleActionClick = () => {
    if (step.actionPath) {
      markOnboardingComplete();
      setIsClosing(true);
      setTimeout(() => {
        onClose();
        navigate(step.actionPath!);
      }, 300);
    }
  };

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSkip();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleSkip();
    }
  };

  return (
    <div
      className={`onboarding-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close onboarding overlay"
    >
      <div
        className={`onboarding-dialog ${isClosing ? 'closing' : ''}`}
      >
        {/* Close/Skip Button */}
        <button
          className="onboarding-close"
          onClick={handleSkip}
          aria-label="Skip onboarding"
          title="Skip tour"
        >
          ×
        </button>

        {/* Progress Indicator */}
        <div className="onboarding-progress">
          <div className="progress-dots">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                className={`progress-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                onClick={() => setCurrentStep(index)}
                aria-label={`Go to step ${index + 1}`}
                title={ONBOARDING_STEPS[index].title}
              />
            ))}
          </div>
          <div className="progress-text">
            Step {currentStep + 1} of {totalSteps}
          </div>
        </div>

        {/* Content */}
        <div className="onboarding-content">
          <div className="onboarding-icon">{step.icon}</div>
          <h1 className="onboarding-title">{step.title}</h1>
          <p className="onboarding-description">{step.description}</p>

          <div className="onboarding-details">
            {step.details.map((detail, index) => (
              <div key={index} className="detail-item">
                <span className="detail-bullet">✓</span>
                <span className="detail-text">{detail}</span>
              </div>
            ))}
          </div>

          {step.actionLabel && step.actionPath && !isLastStep && (
            <button
              className="onboarding-action-btn"
              onClick={handleActionClick}
            >
              {step.actionLabel} →
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="onboarding-footer">
          <button
            className="btn-secondary"
            onClick={handleBack}
            disabled={isFirstStep}
          >
            ← Back
          </button>

          <button
            className="btn-skip"
            onClick={handleSkip}
          >
            Skip Tour
          </button>

          <button
            className="btn-primary"
            onClick={handleNext}
          >
            {isLastStep ? 'Get Started' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
