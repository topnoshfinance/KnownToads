import Image from 'next/image';

export function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      gap: 'var(--spacing-lg)',
    }}>
      <Image
        src="/IMG_20260121_143212.png"
        alt="Loading..."
        width={100}
        height={100}
        className="animate-bounce"
      />
      <p style={{ 
        fontSize: 'var(--text-lg)', 
        color: 'var(--deep-blue)',
        fontWeight: 'var(--font-semibold)',
      }}>
        Loading toads...
      </p>
    </div>
  );
}
