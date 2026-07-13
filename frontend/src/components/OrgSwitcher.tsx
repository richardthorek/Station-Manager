/**
 * OrgSwitcher — lets a user who belongs to more than one organisation switch
 * their active org (reissues the JWT via AuthContext.switchOrg). Renders
 * nothing for single-org users, which is the overwhelming majority.
 */

import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import './OrgSwitcher.css';

export function OrgSwitcher() {
  const { organization, memberships, switchOrg } = useAuth();
  const { showError } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (memberships.length <= 1) {
    return null;
  }

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === organization?.id) {
      setIsOpen(false);
      return;
    }
    setIsSwitching(true);
    try {
      await switchOrg(organizationId);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to switch organisation');
    } finally {
      setIsSwitching(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="org-switcher" ref={containerRef}>
      <button
        type="button"
        className="org-switcher__trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        disabled={isSwitching}
      >
        <Building2 size={16} strokeWidth={2} aria-hidden="true" />
        <span className="org-switcher__label">{organization?.name ?? 'Select organisation'}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="org-switcher__dropdown" role="menu">
          {memberships.map((membership) => (
            <button
              key={membership.organizationId}
              type="button"
              role="menuitem"
              className={`org-switcher__option${membership.organizationId === organization?.id ? ' org-switcher__option--active' : ''}`}
              onClick={() => handleSwitch(membership.organizationId)}
            >
              <span className="org-switcher__option-name">{membership.organizationName}</span>
              <span className="org-switcher__option-role">{membership.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
