import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Profile } from '@/types/profile';

interface ToadCardProps {
  profile: Profile;
}

export function ToadCard({ profile }: ToadCardProps) {
  return (
    <Link href={`/toad/${profile.fid}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-4 cursor-pointer border-2 border-green-100 hover:border-green-300">
        <div className="flex flex-col items-center">
          <div className="relative w-24 h-24 rounded-full overflow-hidden mb-3 border-4 border-green-500">
            <Image
              src={profile.pfp_url}
              alt={`${profile.username}'s profile picture`}
              fill
              className="object-cover"
            />
          </div>
          
          <h3 className="font-bold text-lg text-gray-900 mb-1">
            @{profile.username}
          </h3>
          
          <div className="flex gap-2 text-sm text-gray-600">
            {profile.x_handle && (
              <span>🐦 X</span>
            )}
            {profile.telegram_handle && (
              <span>💬 Telegram</span>
            )}
            {profile.zora_page_url && (
              <span>🎨 Zora</span>
            )}
          </div>
          
          <div className="mt-3 text-xs text-gray-500 truncate max-w-full px-2">
            {profile.creator_coin_address.slice(0, 6)}...{profile.creator_coin_address.slice(-4)}
          </div>
        </div>
      </div>
    </Link>
  );
}
