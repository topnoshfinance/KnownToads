import Link from 'next/link';
import Image from 'next/image';
import type { Profile } from '@/types/profile';
import { SocialLinks } from '@/components/profile/SocialLinks';

interface ToadCardProps {
  profile: Profile;
}

export function ToadCard({ profile }: ToadCardProps) {
  return (
    <Link href={`/toad/${profile.fid}`}>
      <div className="toad-card animate-fadeIn" style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {profile.pfp_url && (
            <Image
              src={profile.pfp_url}
              alt={`${profile.username}'s profile`}
              width={60}
              height={60}
              className="avatar avatar-md"
              style={{ objectFit: 'cover' }}
            />
          )}
          <h3 style={{ 
            fontSize: 'var(--text-lg)', 
            color: 'var(--deep-blue)',
            fontWeight: 'var(--font-bold)',
            textAlign: 'center',
          }}>
            {profile.username}
          </h3>
          <SocialLinks profile={profile} showDirectoryView={true} />
        </div>
      </div>
    </Link>
  );
}
