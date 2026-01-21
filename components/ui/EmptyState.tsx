import Image from 'next/image';

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = 'No toads found' }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      gap: 'var(--spacing-lg)',
      opacity: 0.7,
    }}>
      <Image
        src="/toby-logo.svg"
        alt="No results"
        width={120}
        height={120}
        style={{ opacity: 0.5 }}
      />
      <p style={{ 
        fontSize: 'var(--text-xl)', 
        color: 'var(--text-secondary)',
        fontWeight: 'var(--font-medium)',
      }}>
        {message}
      </p>
    </div>
  );
}
