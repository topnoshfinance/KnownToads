'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useConnect } from 'wagmi';
import { frameConnector } from '@/lib/wagmi';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Button } from '@/components/ui/Button';
import { ProfileFormData } from '@/types/profile';
import { supabase } from '@/lib/supabase';
import { useFarcasterContext } from '@/lib/useFarcasterContext';
import {
  validateXHandle,
  validateTelegramHandle,
  normalizeTelegramHandle,
  validateZoraUrl,
} from '@/lib/validation';

export default function ProfileEditPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const farcasterContext = useFarcasterContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

      // Save to Supabase
      const profileData = {
        fid: farcasterContext.fid,
        username: farcasterContext.username,
        pfp_url: farcasterContext.pfpUrl || 'https://i.imgur.com/placeholder.png',
        pfp_cached_at: new Date().toISOString(),
        creator_coin_address: formData.creator_coin_address,
        chain_id: validationResult.chainId || 8453,
        x_handle: cleanedXHandle,
        telegram_handle: normalizedTelegram,
        zora_page_url: formData.zora_page_url || null,
      };

      const { error: dbError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'fid' });

      if (dbError) throw dbError;

      setSuccess(true);
      setTimeout(() => {
        router.push(`/toad/${farcasterContext.fid}`);
      }, 1500);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/">
            <Button variant="secondary" className="mb-6">
              ← Back to Directory
            </Button>
          </Link>

          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Connect with Farcaster
            </h1>
            <p className="text-gray-600 mb-8">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="secondary" className="mb-6">
            ← Back to Directory
          </Button>
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Edit Your Profile
          </h1>
          <p className="text-gray-600 mb-2">
            Welcome, @{farcasterContext.username}!
          </p>
          <p className="text-gray-600 mb-8">
            Join the toadgang by creating your profile. Make sure you follow{' '}
            <a
              href="https://warpcast.com/toadgod1017"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 underline"
            >
              @toadgod1017
            </a>
            !
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              Profile saved successfully! Redirecting...
            </div>
          )}

          <ProfileForm onSubmit={handleSubmit} isLoading={isLoading} />

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">
              Important Notes:
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>
                • Creator coin address must be a valid ERC-20 token on Base
              </li>
              <li>• X handle: just the username (with or without @)</li>
              <li>
                • Telegram: username, @username, or full t.me link work
              </li>
              <li>• Zora page: must be a zora.co URL</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
