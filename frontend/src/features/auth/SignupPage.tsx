/**
 * Sign-up Page Component
 *
 * Self-service brigade onboarding, as a two-step wizard:
 *  1. Account details (organisation name, contact email, billing email,
 *     username, password).
 *  2. Find your station — claim a Digital Atlas emergency-services facility
 *     (first-come-first-served) or record a custom/unlisted unit.
 *
 * Creates an Organization (free Community plan) and its first owner account,
 * then redirects into the app. Upgrades to paid plans (and the AI add-on)
 * happen later from the Organization screen. Reuses the login page styling.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import type { FacilitySelection } from '../../services/api';
import { PageTransition } from '../../components/PageTransition';
import { PageHeader } from '../../components/PageHeader';
import { FacilitySearch } from '../../components/FacilitySearch';
import { useToast } from '../../hooks/useToast';
import { TruckCheckOnboardingWizard } from './TruckCheckOnboardingWizard';
import { hasCompletedTruckCheckOnboarding } from '../../utils/onboardingUtils';
import './LoginPage.css';
import './SignupPage.css';

const FACILITY_CLAIMED_CODE = 'FACILITY_ALREADY_CLAIMED';

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup } = useAuth();
  const { showSuccess } = useToast();

  // A paid plan can be pre-selected from the marketing page
  // (e.g. /signup?plan=basic&interval=annual). After the account is created we
  // send the owner straight into Stripe Checkout for that plan.
  const planParam = searchParams.get('plan');
  const selectedPlan = planParam === 'basic' || planParam === 'ai' ? planParam : null;
  const selectedInterval = searchParams.get('interval') === 'annual' ? 'annual' : 'monthly';

  const [step, setStep] = useState<1 | 2>(1);

  const [organizationName, setOrganizationName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [billingSameAsContact, setBillingSameAsContact] = useState(true);
  const [billingEmail, setBillingEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [facility, setFacility] = useState<FacilitySelection | null>(null);
  const [facilityLabel, setFacilityLabel] = useState('');

  const [error, setError] = useState('');
  const [isClaimConflict, setIsClaimConflict] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  const handleStepOneSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setStep(2);
  };

  const handleFacilitySelect = (selection: FacilitySelection, label: string) => {
    setFacility(selection);
    setFacilityLabel(label);
    setError('');
    setIsClaimConflict(false);
    // Offer the facility's name as the org name if the founder hasn't typed one.
    if (!organizationName.trim()) {
      setOrganizationName(label.split(' — ')[0]);
    }
  };

  const handleFinalSubmit = async () => {
    if (!facility) {
      setError("Choose your unit, or select \"My unit isn't listed\"");
      return;
    }
    setError('');
    setIsClaimConflict(false);
    setIsLoading(true);
    try {
      await signup({
        organizationName,
        billingEmail: billingSameAsContact ? contactEmail : billingEmail,
        username,
        password,
        email: contactEmail,
        facility,
      });
      setSignupComplete(true);

      // If the visitor picked a paid plan on the marketing page, take them
      // straight to Stripe Checkout. If billing isn't available, fall back to
      // the Organization screen where they can upgrade manually.
      if (selectedPlan) {
        try {
          const { checkoutUrl } = await api.createCheckoutSession(selectedPlan, selectedInterval);
          window.location.href = checkoutUrl;
          return;
        } catch {
          navigate('/admin/organization?billing=unavailable', { replace: true });
          return;
        }
      }

      // Show truck check onboarding if not already completed
      if (!hasCompletedTruckCheckOnboarding()) {
        // Stay on this page but show the wizard via conditional render
        return;
      }

      // No billing intent and onboarding complete — drop them at the app picker
      showSuccess('Account created — welcome to StationKit!');
      navigate('/', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-up failed';
      setError(message);
      setIsClaimConflict(message.includes(FACILITY_CLAIMED_CODE) || /already been claimed/i.test(message));
    } finally {
      setIsLoading(false);
    }
  };

  // Show truck check onboarding wizard if signup just completed
  if (signupComplete && !hasCompletedTruckCheckOnboarding() && !selectedPlan) {
    return <TruckCheckOnboardingWizard />;
  }

  return (
    <PageTransition variant="fade">
      <div className="login-page">
        <PageHeader title="Create your account" backTo="/" backLabel="Home" />

        <main className="login-main">
          <div className="login-container">
            <div className="login-card">
              <div className="login-icon"><UserPlus size={32} strokeWidth={2} aria-hidden /></div>
              <h2>Sign Up</h2>
              <p className="signup-step-indicator">Step {step} of 2</p>
              <p className="login-description">
                {step === 1 && (selectedPlan === 'basic'
                  ? 'Create your account, then add your payment details for the Basic plan. 14-day free trial — cancel any time.'
                  : selectedPlan === 'ai'
                    ? 'Create your account, then add your payment details for the AI Pro plan. 14-day free trial — cancel any time.'
                    : 'Start free on the Community plan — sign-in book and basic vehicle checks. Add reports and the AI maintenance agent any time.')}
                {step === 2 && 'Find your brigade or unit so we can set things up — first to claim it becomes the owner.'}
              </p>

              {error && (
                <div className="error-message" role="alert">
                  {error}
                  {isClaimConflict && (
                    <div className="signup-conflict-actions">
                      <button type="button" className="signup-conflict-link" onClick={() => setFacility(null)}>
                        Choose a different facility
                      </button>
                      <a className="signup-conflict-link" href="mailto:support@stationkit.com.au">
                        Contact support
                      </a>
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <form onSubmit={handleStepOneSubmit} className="login-form">
                  <div className="form-group">
                    <label htmlFor="organizationName">Brigade / organisation name</label>
                    <input
                      id="organizationName"
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      required
                      disabled={isLoading}
                      placeholder="e.g. Riverside Fire Brigade or Coastal SES Unit"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="contactEmail">Your email</label>
                    <input
                      id="contactEmail"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group signup-checkbox-group">
                    <label htmlFor="billingSameAsContact">
                      <input
                        id="billingSameAsContact"
                        type="checkbox"
                        checked={billingSameAsContact}
                        onChange={(e) => setBillingSameAsContact(e.target.checked)}
                        disabled={isLoading}
                      />
                      Billing email is the same as my email
                    </label>
                  </div>

                  {!billingSameAsContact && (
                    <div className="form-group">
                      <label htmlFor="billingEmail">Billing email</label>
                      <input
                        id="billingEmail"
                        type="email"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        required
                        autoComplete="email"
                        disabled={isLoading}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="username">Owner username</label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="password">Password (min 8 characters)</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      disabled={isLoading}
                    />
                  </div>

                  <button type="submit" className="login-button">
                    Next: Find your station
                  </button>

                  <p className="login-description" style={{ marginTop: '1rem' }}>
                    Already have an account? <Link to="/login">Sign in</Link>
                  </p>
                </form>
              )}

              {step === 2 && (
                <div className="login-form">
                  <FacilitySearch onSelect={handleFacilitySelect} />

                  {facility && (
                    <p className="signup-selected-facility">
                      Selected: <strong>{facilityLabel}</strong>
                    </p>
                  )}

                  <div className="signup-step-actions">
                    <button type="button" className="signup-back-button" onClick={() => setStep(1)} disabled={isLoading}>
                      Back
                    </button>
                    <button
                      type="button"
                      className="login-button"
                      onClick={handleFinalSubmit}
                      disabled={isLoading || !facility}
                    >
                      {isLoading
                        ? 'Creating account…'
                        : selectedPlan
                          ? 'Create account & continue to payment'
                          : 'Create account'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
}
