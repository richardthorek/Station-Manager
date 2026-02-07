import React from 'react';
import './ActivityTag.css';

interface ActivityTagProps {
  name: string;
  color?: string;
}

// Map activity names to icons for better accessibility (not just color)
const activityIcons: Record<string, string> = {
  'Training': '📚',
  'Maintenance': '🔧',
  'Meeting': '💬',
  'Incident': '🚨',
  'Drill': '🎯',
  'Community Event': '👥',
  'Admin': '📋',
};

export function ActivityTag({ name, color }: ActivityTagProps) {
  const style = {
    backgroundColor: color || '#bcbec0',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  } as React.CSSProperties;

  // Get icon for activity, use default if not found
  const icon = activityIcons[name] || '📌';

  return (
    <span className="activity-tag" style={style}>
      <span aria-hidden="true">{icon}</span>
      <span>{name}</span>
    </span>
  );
}
