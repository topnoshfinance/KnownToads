import React from 'react';

interface WarningIconProps {
  className?: string;
  title?: string;
}

export function WarningIcon({ className = '', title = 'Warning' }: WarningIconProps) {
  return (
    <span
      className={`inline-block text-yellow-500 ${className}`}
      title={title}
      role="img"
      aria-label="warning"
    >
      ⚠️
    </span>
  );
}
