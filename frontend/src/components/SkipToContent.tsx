/**
 * Skip to Content Link
 * 
 * Accessibility feature allowing keyboard users to skip navigation and jump to main content.
 * - Hidden by default
 * - Visible when focused (Tab key)
 * - Positioned at top of page
 * 
 * Usage: Place at the very start of the page layout
 */

import './SkipToContent.css';

export function SkipToContent() {
  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a 
      href="#main-content" 
      className="skip-to-content"
      onClick={handleSkip}
    >
      Skip to main content
    </a>
  );
}
