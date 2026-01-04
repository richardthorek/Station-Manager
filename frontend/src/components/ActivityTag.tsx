import React from 'react';
import './ActivityTag.css';

interface ActivityTagProps {
  name: string;
  color?: string;
}

export function ActivityTag({ name, color }: ActivityTagProps) {
  const style = {
    backgroundColor: color || '#bcbec0',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    display: 'inline-block',
  } as React.CSSProperties;

  return <span className="activity-tag" style={style}>{name}</span>;
}
