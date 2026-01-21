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
      padding: 'var(--spacing-xl)',
      width: '100%',
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="search-bar"
        />
        <span style={{
          position: 'absolute',
          right: 'var(--spacing-lg)',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--toby-blue)',
          fontSize: 'var(--text-xl)',
        }}>
          🔍
        </span>
      </div>
    </div>
  );
}
