import React from 'react';
import { Profile } from '@/types/profile';
import { ToadCard } from './ToadCard';

interface ToadGridProps {
  profiles: Profile[];
}

export function ToadGrid({ profiles }: ToadGridProps) {
  if (profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 text-lg">🐸 No toads found in the pond yet!</p>
        <p className="text-gray-500 text-sm mt-2">Be the first to join the gang!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {profiles.map((profile) => (
        <ToadCard key={profile.fid} profile={profile} />
      ))}
    </div>
  );
}
