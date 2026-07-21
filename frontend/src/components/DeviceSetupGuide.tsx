/**
 * Device Setup Guide Component
 *
 * Step-by-step guide to help users set up a device for station access.
 * Covers: creating a device token, saving as PWA, and scanning QR code.
 */

import { useState } from 'react';
import { ChevronRight, Check, X, Smartphone, QrCode, Download, Zap } from 'lucide-react';
import './DeviceSetupGuide.css';

interface DeviceSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceTokenRequest?: () => void;
}

const steps = [
  {
    id: 'intro',
    title: 'Welcome to Device Setup',
    description: 'Let\'s get your device ready for station sign-in',
    icon: Smartphone,
    content: (
      <div className="guide-step-content">
        <p>This guide will show you how to:</p>
        <ul>
          <li>Create a device token on your station's admin console</li>
          <li>Save StationKit as an app on your device</li>
          <li>Scan the QR code to activate your device</li>
        </ul>
        <p className="guide-note">Estimated time: 3-5 minutes</p>
      </div>
    ),
  },
  {
    id: 'token',
    title: 'Step 1: Create a Device Token',
    description: 'Generate a QR code from the admin console',
    icon: QrCode,
    content: (
      <div className="guide-step-content">
        <p><strong>On the admin dashboard:</strong></p>
        <ol>
          <li>Sign in with your admin account</li>
          <li>Go to <strong>Station Management</strong></li>
          <li>Select your station</li>
          <li>Click <strong>"Add Device"</strong></li>
          <li>Choose a device name (e.g., "Front desk tablet")</li>
          <li>Select device type (tablet, kiosk, phone, etc.)</li>
          <li>Click <strong>"Generate Device QR Code"</strong></li>
        </ol>
        <p className="guide-note">💡 You can create multiple devices for different stations or locations</p>
      </div>
    ),
  },
  {
    id: 'pwa',
    title: 'Step 2: Save as App',
    description: 'Install StationKit on your device',
    icon: Download,
    content: (
      <div className="guide-step-content">
        <p><strong>iOS (iPhone/iPad):</strong></p>
        <ol>
          <li>Open Safari and go to your station's sign-in page</li>
          <li>Tap the <strong>Share button</strong> (arrow pointing up)</li>
          <li>Scroll and tap <strong>"Add to Home Screen"</strong></li>
          <li>Name it (e.g., "Station Sign-In")</li>
          <li>Tap <strong>"Add"</strong></li>
        </ol>
        <p><strong>Android:</strong></p>
        <ol>
          <li>Open Chrome and go to your station's sign-in page</li>
          <li>Tap the <strong>menu icon</strong> (three dots)</li>
          <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
          <li>Confirm the installation</li>
        </ol>
        <p className="guide-note">💡 The app will be saved as a full-screen shortcut on your home screen</p>
      </div>
    ),
  },
  {
    id: 'scan',
    title: 'Step 3: Scan the QR Code',
    description: 'Activate your device',
    icon: Zap,
    content: (
      <div className="guide-step-content">
        <p><strong>Using the app on your device:</strong></p>
        <ol>
          <li>Open the StationKit app from your home screen</li>
          <li>You'll see the <strong>Sign In</strong> screen</li>
          <li>Look for the <strong>"Scan Device QR Code"</strong> button</li>
          <li>Tap it to open the camera scanner</li>
          <li>Point your device's camera at the QR code from Step 1</li>
          <li>Wait a moment while it scans</li>
          <li>Your device will be activated automatically</li>
        </ol>
        <p className="guide-note">💡 Make sure you have camera permissions enabled</p>
      </div>
    ),
  },
  {
    id: 'ready',
    title: 'You\'re All Set!',
    description: 'Your device is ready to use',
    icon: Check,
    content: (
      <div className="guide-step-content">
        <div className="success-message">
          <Check size={48} strokeWidth={2} aria-hidden />
          <p>Your device has been activated and is ready for station sign-in.</p>
        </div>
        <p><strong>What happens next:</strong></p>
        <ul>
          <li>You can now use the quick sign-in screen</li>
          <li>Members can check in and out instantly</li>
          <li>All data syncs across devices in real-time</li>
        </ul>
        <p className="guide-note">Need help? Contact your station administrator</p>
      </div>
    ),
  },
];

export function DeviceSetupGuide({ isOpen, onClose, onDeviceTokenRequest }: DeviceSetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const StepIcon = step.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  if (!isOpen) return null;

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="setup-guide-overlay" role="presentation">
      <div className="setup-guide-modal" role="dialog" aria-modal="true" aria-labelledby="setup-guide-title">
        <div className="setup-guide-header">
          <h1 id="setup-guide-title">{step.title}</h1>
          <button
            onClick={handleClose}
            className="setup-guide-close"
            aria-label="Close guide"
            title="Close setup guide"
          >
            <X size={24} strokeWidth={2} />
          </button>
        </div>

        <div className="setup-guide-progress">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`progress-dot ${index <= currentStep ? 'completed' : ''} ${
                index === currentStep ? 'active' : ''
              }`}
              aria-label={`Step ${index + 1} of ${steps.length}`}
            />
          ))}
        </div>

        <div className="setup-guide-content">
          <div className="setup-guide-icon">
            <StepIcon size={48} strokeWidth={1.5} aria-hidden />
          </div>

          <p className="setup-guide-description">{step.description}</p>

          <div className="setup-guide-body">{step.content}</div>
        </div>

        <div className="setup-guide-actions">
          <button
            onClick={handlePrevious}
            className="btn-secondary setup-guide-button"
            disabled={currentStep === 0}
            aria-label="Go to previous step"
          >
            ← Back
          </button>

          <div className="setup-guide-step-counter">
            Step {currentStep + 1} of {steps.length}
          </div>

          <button
            onClick={handleNext}
            className="btn-primary setup-guide-button"
            aria-label={isLastStep ? 'Close guide' : 'Go to next step'}
          >
            {isLastStep ? 'Done' : 'Next'} <ChevronRight size={20} strokeWidth={2} />
          </button>
        </div>

        {currentStep === 1 && onDeviceTokenRequest && (
          <div className="setup-guide-cta">
            <button
              onClick={onDeviceTokenRequest}
              className="btn-accent setup-guide-cta-button"
              title="Open admin console to create device token"
            >
              Open Admin Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
