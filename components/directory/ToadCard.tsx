import Link from 'next/link';
import Image from 'next/image';
import type { Profile } from '@/types/profile';
import { SocialLinks } from '@/components/profile/SocialLinks';

interface ToadCardProps {
  profile: Profile;
}

export function ToadCard({ profile }: ToadCardProps) {
  const handleBuyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Placeholder for buy functionality
    console.log('Buy clicked for', profile.username);
  };

  return (
    <Link href={`/toad/${profile.fid}`}>
      <div className="toad-card toad-card-compact animate-fadeIn" style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-start' }}>
          {profile.pfp_url && (
            <Image
              src={profile.pfp_url}
              alt={`${profile.username}'s profile`}
              width={60}
              height={60}
              className="avatar avatar-compact"
              style={{ objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1, minWidth: 0 }}>
            <h3 style={{ 
              fontSize: 'var(--text-lg)', 
              color: 'var(--deep-blue)',
              fontWeight: 'var(--font-bold)',
              margin: 0,
            }}>
              {profile.username}
            </h3>
            <div style={{ fontSize: 'var(--text-sm)' }}>
              <SocialLinks profile={profile} />
            </div>
            <button
              onClick={handleBuyClick}
              className="btn-buy-compact"
              style={{
                marginTop: 'var(--spacing-xs)',
                alignSelf: 'flex-start',
              }}
            >
              Buy 1USDC
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
