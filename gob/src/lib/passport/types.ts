/**
 * Shared types for the Gamer Reputation Passport feature.
 * Mirrors the shape returned by `player_passport_view` and the server
 * actions in `lib/actions/passport.ts`.
 */

export interface PassportGameStat {
  game: string;
  in_game_name: string;
  rank_or_level: string | null;
  stats: Record<string, unknown> | null;
  is_verified: boolean;
}

export interface PlayerPassport {
  id: string;
  username: string;
  avatar_url: string | null;
  reputation_score: number;
  total_trades: number;
  phone_verified: boolean;
  member_since: string;
  tournaments_played: number;
  tournaments_won: number;
  best_placement: number | null;
  total_matches_played: number;
  total_matches_won: number;
  badges: string[];
  game_stats: PassportGameStat[];
}