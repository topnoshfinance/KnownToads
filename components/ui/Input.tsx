import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        {label && (
          <label style={{ 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--font-semibold)',
            color: 'var(--deep-blue)',
          }}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`input-primary ${className}`}
          {...props}
        />
        {error && (
          <span style={{ 
            fontSize: 'var(--text-xs)', 
            color: '#ef4444',
          }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
