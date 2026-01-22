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
import styles from './page.module.css';

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
      <div className={styles.container}>
        <div className={`toad-card ${styles.card}`}>
          {/* Profile Header */}
          <div className={styles.profileHeader}>
            {profile.pfp_url && (
              <Image
                src={profile.pfp_url}
                alt={`${profile.username}'s profile`}
                width={200}
                height={200}
                className={`avatar avatar-lg ${styles.profileImage}`}
              />
            )}
            <h1 className={styles.profileUsername}>
              @{profile.username}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>FID: {profile.fid}</p>
          </div>

          {/* Social Links */}
          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>
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
          <div className={styles.section}>
            <h2 className={styles.sectionHeading}>
              Creator Coin
            </h2>
            <div className={`info-card ${styles.contractInfo}`}>
              <p className={styles.contractLabel}>
                Contract Address
              </p>
              <div className={styles.contractAddressContainer}>
                <code className={styles.contractCode}>
                  {profile.creator_coin_address}
                </code>
                <Button onClick={handleCopyAddress} className={styles.copyButton}>
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
              style={{ width: '100%' }}
            />
          </div>

          {/* Metadata */}
          <div className={styles.metadata}>
            <p>Joined: {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
