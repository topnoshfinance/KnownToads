import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
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
        <textarea
          ref={ref}
          className={`input-primary ${className}`}
          style={{
            minHeight: '120px',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: '1.5',
          }}
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

Textarea.displayName = 'Textarea';
