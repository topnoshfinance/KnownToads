import { ToadCard } from './ToadCard';
import type { Profile } from '@/types/profile';
import { EmptyState } from '@/components/ui/EmptyState';

interface ToadGridProps {
  profiles: Profile[];
}

export function ToadGrid({ profiles }: ToadGridProps) {
  if (profiles.length === 0) {
    return <EmptyState message="No toads found in the pond yet!" />;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: 'var(--spacing-xl)',
      padding: 'var(--spacing-md) var(--spacing-sm)',
      maxWidth: '600px',
      margin: '0 auto',
    }}>
      {profiles.map((profile) => (
        <ToadCard key={profile.fid} profile={profile} />
      ))}
    </div>
  );
}
