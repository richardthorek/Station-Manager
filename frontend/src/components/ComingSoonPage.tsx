/**
 * Coming Soon Page Component
 * 
 * Displayed for features that are not yet available in the MVP launch.
 * Provides clear messaging about future availability.
 */

import { Link } from 'react-router-dom';
import { PageTransition } from './PageTransition';
import './ComingSoonPage.css';

interface ComingSoonPageProps {
  featureName: string;
  description?: string;
  estimatedRelease?: string;
}

export function ComingSoonPage({ 
  featureName, 
  description = 'This feature is currently under development and will be available soon.',
  estimatedRelease = 'Version 1.1'
}: ComingSoonPageProps) {
  return (
    <PageTransition variant="fade">
      <div className="coming-soon-page">
        <div className="coming-soon-container">
          <div className="coming-soon-icon" aria-hidden="true">🚧</div>
          <h1>{featureName}</h1>
          <p className="coming-soon-subtitle">Coming Soon</p>
          <p className="coming-soon-description">{description}</p>
          {estimatedRelease && (
            <p className="coming-soon-release">
              Expected in <strong>{estimatedRelease}</strong>
            </p>
          )}
          <Link to="/" className="coming-soon-back-btn">
            ← Back to Home
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
