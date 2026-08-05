export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      dispute_messages: {
        Row: {
          attachment_url: string | null
          created_at: string
          dispute_id: string
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          dispute_id: string
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          dispute_id?: string
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          raised_by: string
          reason: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          raised_by: string
          reason: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          transaction_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          raised_by?: string
          reason?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount_bdt: number
          auto_release_deadline: string | null
          buyer_id: string
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          funded_at: string | null
          id: string
          listing_id: string
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_reference_id: string | null
          platform_fee_bdt: number
          released_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["escrow_status"]
          updated_at: string
        }
        Insert: {
          amount_bdt: number
          auto_release_deadline?: string | null
          buyer_id: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          funded_at?: string | null
          id?: string
          listing_id: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_reference_id?: string | null
          platform_fee_bdt?: number
          released_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Update: {
          amount_bdt?: number
          auto_release_deadline?: string | null
          buyer_id?: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          funded_at?: string | null
          id?: string
          listing_id?: string
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          payment_reference_id?: string | null
          platform_fee_bdt?: number
          released_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          created_at: string
          description: string | null
          game: Database["public"]["Enums"]["game_type"]
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          price_bdt: number
          screenshots: string[] | null
          seller_id: string
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          game: Database["public"]["Enums"]["game_type"]
          id?: string
          item_type: Database["public"]["Enums"]["item_type"]
          price_bdt: number
          screenshots?: string[] | null
          seller_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          game?: Database["public"]["Enums"]["game_type"]
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          price_bdt?: number
          screenshots?: string[] | null
          seller_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_game_stats: {
        Row: {
          created_at: string
          game: Database["public"]["Enums"]["game_type"]
          id: string
          in_game_name: string
          is_verified: boolean
          player_id: string
          rank_or_level: string | null
          stats: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          game: Database["public"]["Enums"]["game_type"]
          id?: string
          in_game_name: string
          is_verified?: boolean
          player_id: string
          rank_or_level?: string | null
          stats?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          game?: Database["public"]["Enums"]["game_type"]
          id?: string
          in_game_name?: string
          is_verified?: boolean
          player_id?: string
          rank_or_level?: string | null
          stats?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_game_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_game_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          is_admin: boolean
          phone_verified: boolean
          reputation_score: number
          total_trades: number
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          is_admin?: boolean
          phone_verified?: boolean
          reputation_score?: number
          total_trades?: number
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          is_admin?: boolean
          phone_verified?: boolean
          reputation_score?: number
          total_trades?: number
          username?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          transaction_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          transaction_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_preferences: {
        Row: {
          created_at: string
          game: Database["public"]["Enums"]["game_type"]
          id: string
          is_active: boolean
          looking_for_note: string | null
          player_id: string
          playtime_days: string[]
          playtime_end_hour: number | null
          playtime_start_hour: number | null
          preferred_squad_size: number
          rank_or_level: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          game: Database["public"]["Enums"]["game_type"]
          id?: string
          is_active?: boolean
          looking_for_note?: string | null
          player_id: string
          playtime_days?: string[]
          playtime_end_hour?: number | null
          playtime_start_hour?: number | null
          preferred_squad_size?: number
          rank_or_level?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          game?: Database["public"]["Enums"]["game_type"]
          id?: string
          is_active?: boolean
          looking_for_note?: string | null
          player_id?: string
          playtime_days?: string[]
          playtime_end_hour?: number | null
          playtime_start_hour?: number | null
          preferred_squad_size?: number
          rank_or_level?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_preferences_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_preferences_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_session_feedback: {
        Row: {
          created_at: string
          id: string
          note: string | null
          reporter_id: string
          session_id: string
          showed_up: boolean
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          reporter_id: string
          session_id: string
          showed_up: boolean
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          reporter_id?: string
          session_id?: string
          showed_up?: boolean
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_session_feedback_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_session_feedback_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_session_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "squad_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_session_feedback_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_session_feedback_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_sessions: {
        Row: {
          created_at: string
          game: Database["public"]["Enums"]["game_type"]
          id: string
          initiator_id: string
          recipient_id: string
          scheduled_at: string | null
          status: Database["public"]["Enums"]["squad_session_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          game: Database["public"]["Enums"]["game_type"]
          id?: string
          initiator_id: string
          recipient_id: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["squad_session_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          game?: Database["public"]["Enums"]["game_type"]
          id?: string
          initiator_id?: string
          recipient_id?: string
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["squad_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_sessions_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_sessions_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_sessions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_sessions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          created_at: string
          id: string
          is_bye: boolean
          match_number: number
          player1_id: string | null
          player2_id: string | null
          reported_at: string | null
          reported_by: string | null
          round_number: number
          status: Database["public"]["Enums"]["tournament_match_status"]
          tournament_id: string
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_bye?: boolean
          match_number: number
          player1_id?: string | null
          player2_id?: string | null
          reported_at?: string | null
          reported_by?: string | null
          round_number: number
          status?: Database["public"]["Enums"]["tournament_match_status"]
          tournament_id: string
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_bye?: boolean
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          reported_at?: string | null
          reported_by?: string | null
          round_number?: number
          status?: Database["public"]["Enums"]["tournament_match_status"]
          tournament_id?: string
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_prize_payouts: {
        Row: {
          amount_bdt: number
          created_at: string
          id: string
          paid_at: string | null
          payout_status: Database["public"]["Enums"]["payout_status"]
          placement: number
          player_id: string
          tournament_id: string
        }
        Insert: {
          amount_bdt: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          placement: number
          player_id: string
          tournament_id: string
        }
        Update: {
          amount_bdt?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          placement?: number
          player_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_prize_payouts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_prize_payouts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_prize_payouts_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          payment_reference_id: string | null
          payment_status: Database["public"]["Enums"]["registration_payment_status"]
          player_id: string
          registered_at: string
          seed_position: number | null
          tournament_id: string
        }
        Insert: {
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          payment_reference_id?: string | null
          payment_status?: Database["public"]["Enums"]["registration_payment_status"]
          player_id: string
          registered_at?: string
          seed_position?: number | null
          tournament_id: string
        }
        Update: {
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          payment_reference_id?: string | null
          payment_status?: Database["public"]["Enums"]["registration_payment_status"]
          player_id?: string
          registered_at?: string
          seed_position?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          entry_fee_bdt: number
          format: Database["public"]["Enums"]["tournament_format"]
          game: Database["public"]["Enums"]["game_type"]
          id: string
          max_participants: number
          organizer_id: string
          platform_fee_percent: number
          prize_split: Json
          registration_closes_at: string | null
          rules: string | null
          starts_at: string
          status: Database["public"]["Enums"]["tournament_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_fee_bdt?: number
          format?: Database["public"]["Enums"]["tournament_format"]
          game: Database["public"]["Enums"]["game_type"]
          id?: string
          max_participants: number
          organizer_id: string
          platform_fee_percent?: number
          prize_split?: Json
          registration_closes_at?: string | null
          rules?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["tournament_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_fee_bdt?: number
          format?: Database["public"]["Enums"]["tournament_format"]
          game?: Database["public"]["Enums"]["game_type"]
          id?: string
          max_participants?: number
          organizer_id?: string
          platform_fee_percent?: number
          prize_split?: Json
          registration_closes_at?: string | null
          rules?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          transaction_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          transaction_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "player_passport_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_status_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      player_passport_view: {
        Row: {
          avatar_url: string | null
          badges: string[] | null
          best_placement: number | null
          game_stats: Json | null
          id: string | null
          member_since: string | null
          phone_verified: boolean | null
          reputation_score: number | null
          total_matches_played: number | null
          total_matches_won: number | null
          total_trades: number | null
          tournaments_played: number | null
          tournaments_won: number | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_winner_to_next_round: {
        Args: {
          p_match_number: number
          p_round_number: number
          p_tournament_id: string
          p_winner_id: string
        }
        Returns: undefined
      }
      auto_release_overdue_trades: { Args: never; Returns: undefined }
      cancel_squad_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      complete_squad_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      create_trade_atomic: {
        Args: { p_buyer_id: string; p_listing_id: string }
        Returns: string
      }
      generate_bracket: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      get_no_ghost_score: { Args: { p_player_id: string }; Returns: number }
      get_player_badges: { Args: { p_player_id: string }; Returns: string[] }
      get_player_tournament_summary: {
        Args: { p_player_id: string }
        Returns: {
          best_placement: number
          total_matches_played: number
          total_matches_won: number
          tournaments_played: number
          tournaments_won: number
        }[]
      }
      get_squad_matches: {
        Args: {
          p_game: Database["public"]["Enums"]["game_type"]
          p_limit?: number
          p_player_id: string
        }
        Returns: {
          avatar_url: string
          compatibility_score: number
          hours_overlap: number
          no_ghost_score: number
          player_id: string
          rank_or_level: string
          region: string
          reputation_score: number
          shared_days: string[]
          username: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      report_match_result: {
        Args: { p_match_id: string; p_winner_id: string }
        Returns: undefined
      }
      request_squad_session: {
        Args: {
          p_game: Database["public"]["Enums"]["game_type"]
          p_recipient_id: string
          p_scheduled_at?: string
        }
        Returns: string
      }
      respond_to_squad_session: {
        Args: { p_accept: boolean; p_session_id: string }
        Returns: undefined
      }
      set_app_current_user_id: { Args: never; Returns: undefined }
      validate_prize_split: { Args: { p_split: Json }; Returns: boolean }
    }
    Enums: {
      dispute_status:
        | "open"
        | "under_review"
        | "resolved_buyer"
        | "resolved_seller"
        | "resolved_split"
      escrow_status:
        | "awaiting_payment"
        | "funds_held"
        | "item_delivered"
        | "buyer_confirmed"
        | "released"
        | "disputed"
        | "refunded"
        | "cancelled"
        | "auto_released"
      game_type: "free_fire" | "pubg_mobile" | "mobile_legends" | "other"
      item_type: "account" | "skin" | "uc" | "diamonds" | "other"
      listing_status: "active" | "pending_trade" | "sold" | "removed"
      payment_method_type: "bkash" | "nagad"
      payout_status: "pending" | "paid" | "failed"
      registration_payment_status: "pending" | "paid" | "refunded"
      squad_session_status:
        | "requested"
        | "accepted"
        | "declined"
        | "cancelled"
        | "completed"
      tournament_format: "single_elimination"
      tournament_match_status: "pending" | "ready" | "reported" | "disputed"
      tournament_status:
        | "draft"
        | "registration_open"
        | "registration_closed"
        | "bracket_generated"
        | "in_progress"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      dispute_status: [
        "open",
        "under_review",
        "resolved_buyer",
        "resolved_seller",
        "resolved_split",
      ],
      escrow_status: [
        "awaiting_payment",
        "funds_held",
        "item_delivered",
        "buyer_confirmed",
        "released",
        "disputed",
        "refunded",
        "cancelled",
        "auto_released",
      ],
      game_type: ["free_fire", "pubg_mobile", "mobile_legends", "other"],
      item_type: ["account", "skin", "uc", "diamonds", "other"],
      listing_status: ["active", "pending_trade", "sold", "removed"],
      payment_method_type: ["bkash", "nagad"],
      payout_status: ["pending", "paid", "failed"],
      registration_payment_status: ["pending", "paid", "refunded"],
      squad_session_status: [
        "requested",
        "accepted",
        "declined",
        "cancelled",
        "completed",
      ],
      tournament_format: ["single_elimination"],
      tournament_match_status: ["pending", "ready", "reported", "disputed"],
      tournament_status: [
        "draft",
        "registration_open",
        "registration_closed",
        "bracket_generated",
        "in_progress",
        "completed",
        "cancelled",
      ],
    },
  },
} as const