'use client';

import React, { useState, useEffect } from 'react';
import { Profile } from '@/types/profile';
import { supabase } from '@/lib/supabase';
import { ToadGrid } from '@/components/directory/ToadGrid';
import { SearchBar } from '@/components/directory/SearchBar';
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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-green-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-green-800 mb-4">
            🐸 KnownToads
          </h1>
          <p className="text-xl text-gray-700 mb-6">
            The Toadgang Community Directory
          </p>
          <Link href="/profile/edit">
            <Button>Join the Gang</Button>
          </Link>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search toads by username..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'newest' ? 'primary' : 'secondary'}
                onClick={() => setSortBy('newest')}
              >
                Newest
              </Button>
              <Button
                variant={sortBy === 'alphabetical' ? 'primary' : 'secondary'}
                onClick={() => setSortBy('alphabetical')}
              >
                A-Z
              </Button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Loading toads... 🐸</p>
          </div>
        )}

        {/* Profiles Grid */}
        {!loading && <ToadGrid profiles={filteredProfiles} />}

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600">
          <p>Built for the toadgang community 🐸</p>
          <p className="text-sm mt-2">
            Follow{' '}
            <a
              href="https://warpcast.com/toadgod1017"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 underline"
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
