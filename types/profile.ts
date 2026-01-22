export interface Profile {
  fid: number;
  username: string;
  pfp_url: string;
  pfp_cached_at: string;
  creator_coin_address: string;
  chain_id: number;
  bio?: string | null;
  x_handle?: string | null;
  x_handle_valid?: boolean;
  telegram_handle?: string | null;
  telegram_handle_valid?: boolean;
  zora_page_url?: string | null;
  zora_page_valid?: boolean;
  token_ticker?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileFormData {
  creator_coin_address: string;
  bio?: string;
  x_handle?: string;
  telegram_handle?: string;
  zora_page_url?: string;
}

export interface FarcasterUser {
  fid: number;
  username: string;
  pfp_url: string;
  display_name?: string;
  bio?: string;
}
