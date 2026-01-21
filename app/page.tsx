'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/profile';
import { supabase } from '@/lib/supabase';
import { ToadGrid } from '@/components/directory/ToadGrid';
import { SearchBar } from '@/components/directory/SearchBar';
import { Header } from '@/components/ui/Header';
import { Loading } from '@/components/ui/Loading';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'alphabetical'>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    filterAndSortProfiles();
  }, [profiles, searchQuery, sortBy]);

  async function fetchProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterAndSortProfiles() {
    let filtered = profiles;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((profile) =>
        profile.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    if (sortBy === 'alphabetical') {
      filtered = [...filtered].sort((a, b) =>
        a.username.localeCompare(b.username)
      );
    } else {
      // 'newest' - already sorted by created_at desc from query
      filtered = [...filtered];
    }

    setFilteredProfiles(filtered);
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Header />
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: 'var(--spacing-xl)' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-2xl)' }}>
          <h1 style={{ 
            fontSize: 'var(--text-4xl)', 
            fontWeight: 'var(--font-bold)',
            color: 'var(--deep-blue)',
            marginBottom: 'var(--spacing-md)',
          }}>
            🐸 KnownToads
          </h1>
          <p style={{ 
            fontSize: 'var(--text-xl)', 
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-lg)',
          }}>
            The Toadgang Community Directory
          </p>
          <Link href="/profile/edit">
            <Button>Join the Gang</Button>
          </Link>
        </div>

        {/* Search and Filter */}
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search toads by username..."
          />
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: 'var(--spacing-md)',
            marginTop: 'var(--spacing-md)',
          }}>
            <Button
              variant={sortBy === 'newest' ? 'primary' : 'secondary'}
              onClick={() => setSortBy('newest')}
              style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', fontSize: 'var(--text-base)' }}
            >
              Newest
            </Button>
            <Button
              variant={sortBy === 'alphabetical' ? 'primary' : 'secondary'}
              onClick={() => setSortBy('alphabetical')}
              style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', fontSize: 'var(--text-base)' }}
            >
              A-Z
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && <Loading />}

        {/* Profiles Grid */}
        {!loading && <ToadGrid profiles={filteredProfiles} />}

        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: 'var(--spacing-2xl)',
          color: 'var(--text-secondary)',
        }}>
          <p>Built for the toadgang community 🐸</p>
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--spacing-sm)' }}>
            Follow{' '}
            <a
              href="https://warpcast.com/toadgod1017"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              @toadgod1017
            </a>{' '}
            to join
          </p>
        </div>
      </div>
    </div>
  );
}
