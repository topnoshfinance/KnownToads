import Link from 'next/link';
import Image from 'next/image';
import type { Profile } from '@/types/profile';
import { SocialLinks } from '@/components/profile/SocialLinks';

interface ToadCardProps {
  profile: Profile;
}

export function ToadCard({ profile }: ToadCardProps) {
  return (
    <div className="toad-card animate-fadeIn">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        {profile.pfp_url && (
          <Image
            src={profile.pfp_url}
            alt={`${profile.username}'s profile`}
            width={80}
            height={80}
            className="avatar avatar-md"
            style={{ objectFit: 'cover' }}
          />
        )}
        <h3 style={{ 
          fontSize: 'var(--text-xl)', 
          color: 'var(--deep-blue)',
          fontWeight: 'var(--font-bold)',
          textAlign: 'center',
        }}>
          {profile.username}
        </h3>
        <SocialLinks profile={profile} />
        <Link href={`/toad/${profile.fid}`}>
          <button className="btn-primary" style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            fontSize: 'var(--text-base)',
          }}>
            View Profile
          </button>
        </Link>
      </div>
    </div>
  );
}
