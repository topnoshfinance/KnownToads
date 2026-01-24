'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useConnect } from 'wagmi';
import { frameConnector } from '@/lib/wagmi';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/Button';
import { ShareButton } from '@/components/ShareButton';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { Header } from '@/components/ui/Header';
import { ProfileFormData } from '@/types/profile';
import { supabase } from '@/lib/supabase';
import { useFarcasterContext } from '@/lib/useFarcasterContext';
import {
  validateXHandle,
  validateTelegramHandle,
  normalizeTelegramHandle,
  validateZoraUrl,
} from '@/lib/validation';
import { fetchTokenSymbol } from '@/lib/token-helpers';
import type { Address } from 'viem';

const PROFILE_REDIRECT_DELAY_MS = 3000;

export default function ProfileEditPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const farcasterContext = useFarcasterContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingProfile, setExistingProfile] = useState<Partial<ProfileFormData> | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Fetch existing profile data when component mounts
  useEffect(() => {
    async function fetchProfile() {
      if (!farcasterContext.fid) {
        setIsLoadingProfile(false);
        return;
      }
      
      try {
        setIsLoadingProfile(true);
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('fid', farcasterContext.fid)
          .single();
        
        if (data && !fetchError) {
          // Map database fields to form fields
          setExistingProfile({
            creator_coin_address: data.creator_coin_address || '',
            bio: data.bio || '',
            x_handle: data.x_handle || '',
            telegram_handle: data.telegram_handle || '',
            zora_page_url: data.zora_page_url || '',
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        // Don't show error to user, just proceed with empty form
      } finally {
        setIsLoadingProfile(false);
      }
    }

    fetchProfile();
  }, [farcasterContext.fid]);

  async function handleConnect() {
    const connector = frameConnector();
    connect({ connector });
  }

  async function handleSubmit(formData: ProfileFormData) {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!farcasterContext.fid || !farcasterContext.username) {
        throw new Error('Please connect with Farcaster first');
      }

      // Validate creator coin address via API
      const validationResponse = await fetch('/api/validate/contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: formData.creator_coin_address }),
      });

      const validationResult = await validationResponse.json();

      if (!validationResult.valid) {
        throw new Error(
          validationResult.error || 'Invalid ERC-20 contract address'
        );
      }

      // Validate social handles
      if (formData.x_handle && !validateXHandle(formData.x_handle)) {
        throw new Error('Invalid X handle format');
      }

      if (
        formData.telegram_handle &&
        !validateTelegramHandle(formData.telegram_handle)
      ) {
        throw new Error('Invalid Telegram handle format');
      }

      if (
        formData.zora_page_url &&
        !validateZoraUrl(formData.zora_page_url)
      ) {
        throw new Error('Invalid Zora URL format');
      }

      // Normalize telegram handle
      const normalizedTelegram = formData.telegram_handle
        ? normalizeTelegramHandle(formData.telegram_handle)
        : null;

      // Clean X handle (remove @ if present)
      const cleanedXHandle = formData.x_handle
        ? formData.x_handle.replace(/^@/, '')
        : null;

      // Fetch token ticker/symbol from the contract
      let tokenTicker: string | null = null;
      try {
        // Validate address format before fetching
        if (formData.creator_coin_address.startsWith('0x') && formData.creator_coin_address.length === 42) {
          tokenTicker = await fetchTokenSymbol(formData.creator_coin_address as Address);
        }
      } catch (error) {
        console.error('Error fetching token symbol:', error);
        // Continue without token ticker - it can be fetched on demand
      }

      // Save to Supabase
      const profileData = {
        fid: farcasterContext.fid,
        username: farcasterContext.username,
        pfp_url: farcasterContext.pfpUrl || 'https://i.imgur.com/placeholder.png',
        pfp_cached_at: new Date().toISOString(),
        creator_coin_address: formData.creator_coin_address,
        chain_id: validationResult.chainId || 8453,
        bio: formData.bio || null,
        x_handle: cleanedXHandle,
        telegram_handle: normalizedTelegram,
        zora_page_url: formData.zora_page_url || null,
        token_ticker: tokenTicker,
      };

      const { error: dbError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'fid' });

      if (dbError) throw dbError;

      setSuccess(true);
      
      // Show success temporarily, then redirect
      setTimeout(() => {
        router.push(`/toad/${farcasterContext.fid}`);
      }, PROFILE_REDIRECT_DELAY_MS);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Header />
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--spacing-xl)' }}>
          <div className="toad-card" style={{ padding: 'var(--spacing-2xl)', textAlign: 'center' }}>
            <h1 style={{ 
              fontSize: 'var(--text-3xl)', 
              fontWeight: 'var(--font-bold)',
              color: 'var(--deep-blue)',
              marginBottom: 'var(--spacing-md)',
            }}>
              Connect with Farcaster
            </h1>
            <p style={{ 
              color: 'var(--text-secondary)',
              marginBottom: 'var(--spacing-xl)',
            }}>
              To join the toadgang, you need to connect with your Farcaster account.
            </p>
            <Button onClick={handleConnect}>
              Connect Farcaster
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while fetching existing profile
  if (isLoadingProfile) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <Header />
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--spacing-xl)' }}>
          <div className="toad-card" style={{ padding: 'var(--spacing-2xl)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--spacing-xl)' }}>
        <div className="toad-card" style={{ padding: 'var(--spacing-2xl)' }}>
          <h1 style={{ 
            fontSize: 'var(--text-3xl)', 
            fontWeight: 'var(--font-bold)',
            color: 'var(--deep-blue)',
            marginBottom: 'var(--spacing-sm)',
          }}>
            Edit Your Profile
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-sm)',
          }}>
            Welcome, @{farcasterContext.username}!
          </p>
          <p style={{ 
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-xl)',
          }}>
            Join the toadgang by creating your profile. Make sure you follow{' '}
            <a
              href="https://warpcast.com/toadgod1017"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              @toadgod1017
            </a>
            !
          </p>

          {error && (
            <div style={{ 
              background: '#fef2f2',
              border: '2px solid #fca5a5',
              color: '#991b1b',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ 
              background: '#f0fdf4',
              border: '2px solid #86efac',
              color: '#166534',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-lg)',
            }}>
              <p style={{ marginBottom: 'var(--spacing-md)' }}>
                Profile saved successfully! Redirecting...
              </p>
              <div style={{ 
                display: 'flex', 
                gap: 'var(--spacing-sm)',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                <ShareButton
                  url={`https://farcaster.xyz/miniapps/bjXOyJfzJCxU/knowntoads/toad/${farcasterContext.fid}`}
                  text="🐸 Share My Profile"
                  variant="primary"
                />
                <NotificationPrompt />
              </div>
            </div>
          )}

          <ProfileForm onSubmit={handleSubmit} isLoading={isLoading} initialData={existingProfile || undefined} />

          <div className="info-card" style={{ marginTop: 'var(--spacing-lg)' }}>
            <h3 style={{ 
              fontWeight: 'var(--font-semibold)',
              color: 'var(--deep-blue)',
              marginBottom: 'var(--spacing-sm)',
            }}>
              Important Notes:
            </h3>
            <ul style={{ 
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              paddingLeft: 'var(--spacing-lg)',
            }}>
              <li>Creator coin address must be a valid ERC-20 token on Base</li>
              <li>X handle: just the username (with or without @)</li>
              <li>Telegram: username, @username, or full t.me link work</li>
              <li>Zora page: must be a zora.co URL</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
