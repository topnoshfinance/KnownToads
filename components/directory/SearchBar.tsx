'use client';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search toads...' }: SearchBarProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: 'var(--spacing-sm) var(--spacing-md)',
      width: '100%',
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
        <span style={{
          position: 'absolute',
          left: 'var(--spacing-md)',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--toby-blue)',
          fontSize: 'var(--text-lg)',
          pointerEvents: 'none',
        }}>
          🔍
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="search-bar"
          style={{
            paddingLeft: 'calc(var(--spacing-md) + var(--spacing-xl))',
          }}
        />
      </div>
    </div>
  );
}
