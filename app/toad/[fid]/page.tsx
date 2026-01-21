'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Profile } from '@/types/profile';
import { supabase } from '@/lib/supabase';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { Button } from '@/components/ui/Button';
import { SwapButton } from '@/components/ui/SwapButton';
import { Header } from '@/components/ui/Header';
import { Loading } from '@/components/ui/Loading';

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

  if (loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Header />
        <Loading />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Header />
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: 'var(--spacing-lg)',
        }}>
          <p style={{ fontSize: 'var(--text-xl)', color: 'var(--text-secondary)' }}>Toad not found 🐸</p>
          <Link href="/">
            <Button>Back to Directory</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--spacing-xl)' }}>
        <div className="toad-card" style={{ padding: 'var(--spacing-2xl)' }}>
          {/* Profile Header */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            marginBottom: 'var(--spacing-xl)',
          }}>
            {profile.pfp_url && (
              <Image
                src={profile.pfp_url}
                alt={`${profile.username}'s profile`}
                width={200}
                height={200}
                className="avatar avatar-lg"
                style={{ objectFit: 'cover', marginBottom: 'var(--spacing-md)' }}
              />
            )}
            <h1 style={{ 
              fontSize: 'var(--text-3xl)', 
              fontWeight: 'var(--font-bold)',
              color: 'var(--deep-blue)',
              marginBottom: 'var(--spacing-sm)',
            }}>
              @{profile.username}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>FID: {profile.fid}</p>
          </div>

          {/* Social Links */}
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ 
              fontSize: 'var(--text-2xl)', 
              fontWeight: 'var(--font-semibold)',
              color: 'var(--deep-blue)',
              marginBottom: 'var(--spacing-md)',
            }}>
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
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <h2 style={{ 
              fontSize: 'var(--text-2xl)', 
              fontWeight: 'var(--font-semibold)',
              color: 'var(--deep-blue)',
              marginBottom: 'var(--spacing-md)',
            }}>
              Creator Coin
            </h2>
            <div className="info-card" style={{ marginBottom: 'var(--spacing-md)' }}>
              <p style={{ 
                fontSize: 'var(--text-sm)', 
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-sm)',
              }}>
                Contract Address
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <code style={{ 
                  flex: 1,
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'monospace',
                  background: 'var(--white)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--toby-blue)',
                  wordBreak: 'break-all',
                }}>
                  {profile.creator_coin_address}
                </code>
                <Button onClick={handleCopyAddress} style={{ padding: 'var(--spacing-sm) var(--spacing-md)', fontSize: 'var(--text-sm)' }}>
                  {copied ? '✓' : 'Copy'}
                </Button>
              </div>
              {profile.chain_id !== 8453 && (
                <p style={{ fontSize: 'var(--text-sm)', color: '#eab308', marginTop: 'var(--spacing-sm)' }}>
                  ⚠️ Chain ID: {profile.chain_id} (not Base)
                </p>
              )}
            </div>
            <SwapButton
              tokenAddress={profile.creator_coin_address}
              chainId={profile.chain_id}
              tokenSymbol={profile.username}
              style={{ width: '100%' }}
            />
          </div>

          {/* Metadata */}
          <div style={{ 
            fontSize: 'var(--text-sm)', 
            color: 'var(--text-secondary)',
            paddingTop: 'var(--spacing-md)',
            borderTop: '1px solid var(--toby-blue)',
          }}>
            <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
