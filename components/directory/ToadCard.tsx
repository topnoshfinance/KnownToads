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
    // TODO: Implement buy functionality - connect to swap API
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
              width={50}
              height={50}
              className="avatar avatar-compact"
              style={{ objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--spacing-xs)', 
            flex: 1, 
            minWidth: 0  // Prevents flex item overflow for text truncation
          }}>
            <div style={{ fontSize: 'var(--text-xs)' }}>
              <SocialLinks profile={profile} compactView={true} />
            </div>
            <button
              onClick={handleBuyClick}
              className="btn-buy-compact"
              style={{
                marginTop: 'var(--spacing-xs)',
                alignSelf: 'flex-start',
                fontSize: 'var(--text-xs)',
                padding: '0.15rem var(--spacing-sm)',
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
