'use client';

import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ProfileFormData } from '@/types/profile';

interface ProfileFormProps {
  initialData?: Partial<ProfileFormData>;
  onSubmit: (data: ProfileFormData) => Promise<void>;
  isLoading?: boolean;
}

export function ProfileForm({ initialData, onSubmit, isLoading = false }: ProfileFormProps) {
  const [formData, setFormData] = useState<ProfileFormData>({
    creator_coin_address: initialData?.creator_coin_address || '',
    x_handle: initialData?.x_handle || '',
    telegram_handle: initialData?.telegram_handle || '',
    zora_page_url: initialData?.zora_page_url || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFormData, string>>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors: Partial<Record<keyof ProfileFormData, string>> = {};

    if (!formData.creator_coin_address) {
      newErrors.creator_coin_address = 'Creator coin address is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Creator Coin Address *"
        type="text"
        value={formData.creator_coin_address}
        onChange={(e) => setFormData({ ...formData, creator_coin_address: e.target.value })}
        placeholder="0x..."
        error={errors.creator_coin_address}
        disabled={isLoading}
      />

      <Input
        label="X (Twitter) Handle"
        type="text"
        value={formData.x_handle}
        onChange={(e) => setFormData({ ...formData, x_handle: e.target.value })}
        placeholder="@username or username"
        error={errors.x_handle}
        disabled={isLoading}
      />

      <Input
        label="Telegram Handle"
        type="text"
        value={formData.telegram_handle}
        onChange={(e) => setFormData({ ...formData, telegram_handle: e.target.value })}
        placeholder="@username, username, or https://t.me/username"
        error={errors.telegram_handle}
        disabled={isLoading}
      />

      <Input
        label="Zora Page URL"
        type="url"
        value={formData.zora_page_url}
        onChange={(e) => setFormData({ ...formData, zora_page_url: e.target.value })}
        placeholder="https://zora.co/..."
        error={errors.zora_page_url}
        disabled={isLoading}
      />

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Saving...' : 'Save Profile'}
      </Button>
    </form>
  );
}
