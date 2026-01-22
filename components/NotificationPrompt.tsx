'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

type NotificationPermission = 'granted' | 'denied' | 'not-requested' | 'unavailable';

interface NotificationPromptProps {
  onPermissionChange?: (permission: NotificationPermission) => void;
}

const STORAGE_KEY = 'notification-prompt-shown';

function setPromptShown() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
}

function hasPromptBeenShown(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function NotificationPrompt({ onPermissionChange }: NotificationPromptProps) {
  const [permission, setPermission] = useState<NotificationPermission>('unavailable');
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if we've already asked or if notifications are available
    if (hasPromptBeenShown()) {
      setShowPrompt(false);
    }

    // Check notification permission status
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = () => {
    // Check if notifications are supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const currentPermission = Notification.permission;
      
      if (currentPermission === 'granted') {
        setPermission('granted');
      } else if (currentPermission === 'denied') {
        setPermission('denied');
      } else {
        setPermission('not-requested');
      }
    } else {
      setPermission('unavailable');
    }
  };

  const requestNotificationPermission = async () => {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        
        if (result === 'granted') {
          setPermission('granted');
          onPermissionChange?.('granted');
        } else {
          setPermission('denied');
          onPermissionChange?.('denied');
        }
        
        setPromptShown();
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setPermission('denied');
    }
  };

  const handleDismiss = () => {
    setPromptShown();
    setShowPrompt(false);
  };

  // Show prompt only when user triggers it
  const handleShowPrompt = () => {
    setShowPrompt(true);
  };

  // Don't show if already granted, denied, or unavailable
  if (permission === 'granted' || permission === 'denied' || permission === 'unavailable') {
    return null;
  }

  if (!showPrompt) {
    return (
      <Button
        variant="secondary"
        onClick={handleShowPrompt}
        style={{
          fontSize: 'var(--text-sm)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
        }}
      >
        🔔 Enable Notifications
      </Button>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '2px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--spacing-lg)',
      marginTop: 'var(--spacing-md)',
      marginBottom: 'var(--spacing-md)',
    }}>
      <h3 style={{
        fontWeight: 'var(--font-semibold)',
        color: 'var(--deep-blue)',
        marginBottom: 'var(--spacing-sm)',
        fontSize: 'var(--text-lg)',
      }}>
        🔔 Stay Updated
      </h3>
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: 'var(--spacing-md)',
        fontSize: 'var(--text-sm)',
      }}>
        Enable notifications to get updates when new toads join the gang and when there's activity on your profile!
      </p>
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
      }}>
        <Button
          variant="primary"
          onClick={requestNotificationPermission}
        >
          Enable Notifications
        </Button>
        <Button
          variant="secondary"
          onClick={handleDismiss}
        >
          Maybe Later
        </Button>
      </div>
    </div>
  );
}
