'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Profile } from '@/types/profile';
import { supabase } from '@/lib/supabase';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { Button } from '@/components/ui/Button';

export default function ToadCardPage() {
  const params = useParams();
  const fid = params.fid as string;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (fid) {
      fetchProfile();
    }
  }, [fid]);

  async function fetchProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('fid', fid)
        .single();

      if (error) throw error;

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyAddress() {
    if (profile) {
      await navigator.clipboard.writeText(profile.creator_coin_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleBuyClick() {
    if (!profile) return;
    
    // In a real implementation, this would trigger a Farcaster Frame
    // For now, we'll just show an alert
    alert('This will trigger a Farcaster native swap for 1 USDC worth of the creator coin');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 flex items-center justify-center">
        <p className="text-gray-600 text-lg">Loading toad... 🐸</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg mb-4">Toad not found 🐸</p>
          <Link href="/">
            <Button>Back to Directory</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="secondary" className="mb-6">
            ← Back to Directory
          </Button>
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Profile Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-green-500">
              <Image
                src={profile.pfp_url}
                alt={`${profile.username}'s profile picture`}
                fill
                className="object-cover"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              @{profile.username}
            </h1>
            <p className="text-gray-600">FID: {profile.fid}</p>
          </div>

          {/* Social Links */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Social Links
            </h2>
            <SocialLinks
              xHandle={profile.x_handle}
              xHandleValid={profile.x_handle_valid}
              telegramHandle={profile.telegram_handle}
              telegramHandleValid={profile.telegram_handle_valid}
              zoraPageUrl={profile.zora_page_url}
              zoraPageValid={profile.zora_page_valid}
            />
          </div>

          {/* Creator Coin */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Creator Coin
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-2">Contract Address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border break-all">
                  {profile.creator_coin_address}
                </code>
                <Button onClick={handleCopyAddress} style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontSize: 'var(--text-sm)' }}>
                  {copied ? '✓' : 'Copy'}
                </Button>
              </div>
              {profile.chain_id !== 8453 && (
                <p className="text-sm text-yellow-600 mt-2">
                  ⚠️ Chain ID: {profile.chain_id} (not Base)
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleBuyClick}
            >
              Buy 1 USDC Worth
            </Button>
          </div>

          {/* Metadata */}
          <div className="text-sm text-gray-500 pt-4 border-t">
            <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
