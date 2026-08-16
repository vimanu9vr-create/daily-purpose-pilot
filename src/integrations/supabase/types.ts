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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          body: string
          completed_at: string | null
          created_at: string
          desire_id: string | null
          for_date: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          body: string
          completed_at?: string | null
          created_at?: string
          desire_id?: string | null
          for_date?: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          body?: string
          completed_at?: string | null
          created_at?: string
          desire_id?: string | null
          for_date?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desires"
            referencedColumns: ["id"]
          },
        ]
      }
      programmes: {
        Row: {
          id: string
          user_id: string
          desire_id: string | null
          title: string
          length_days: number
          started_on: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          desire_id?: string | null
          title: string
          length_days: number
          started_on?: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          desire_id?: string | null
          title?: string
          length_days?: number
          started_on?: string
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desires"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_days: {
        Row: {
          id: string
          programme_id: string
          user_id: string
          day_number: number
          theme: string
          intention: string
          lines: string[]
          moment_id: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          programme_id: string
          user_id: string
          day_number: number
          theme: string
          intention: string
          lines: string[]
          moment_id?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          programme_id?: string
          user_id?: string
          day_number?: number
          theme?: string
          intention?: string
          lines?: string[]
          moment_id?: string | null
          completed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_days_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          desire_id: string
          id: string
          position: number
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          desire_id: string
          id?: string
          position?: number
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          desire_id?: string
          id?: string
          position?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desires"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          created_at: string
          desire_id: string | null
          for_date: string
          id: string
          seconds: number
          steps_completed: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          desire_id?: string | null
          for_date?: string
          id?: string
          seconds?: number
          steps_completed?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          desire_id?: string | null
          for_date?: string
          id?: string
          seconds?: number
          steps_completed?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desires"
            referencedColumns: ["id"]
          },
        ]
      }
      vision_boards: {
        Row: {
          category: string | null
          cover_url: string | null
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      vision_items: {
        Row: {
          board_id: string
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          kind: string
          position: number
          user_id: string
        }
        Insert: {
          board_id: string
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          position?: number
          user_id: string
        }
        Update: {
          board_id?: string
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "vision_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      affirmations: {
        Row: {
          category: string | null
          created_at: string
          goal_id: string | null
          id: string
          is_favorite: boolean
          last_shown_at: string | null
          source: string
          text: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          is_favorite?: boolean
          last_shown_at?: string | null
          source?: string
          text: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          is_favorite?: boolean
          last_shown_at?: string | null
          source?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affirmations_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chats: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "ai_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          created_at: string
          date: string
          energy: number | null
          gratitude: string | null
          id: string
          tomorrow_focus: string | null
          user_id: string
          visualization_minutes: number
          wins: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          energy?: number | null
          gratitude?: string | null
          id?: string
          tomorrow_focus?: string | null
          user_id: string
          visualization_minutes?: number
          wins?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          energy?: number | null
          gratitude?: string | null
          id?: string
          tomorrow_focus?: string | null
          user_id?: string
          visualization_minutes?: number
          wins?: string | null
        }
        Relationships: []
      }
      desires: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          title: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_steps: {
        Row: {
          completed: boolean
          created_at: string
          due_date: string | null
          goal_id: string
          id: string
          order_index: number
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          goal_id: string
          id?: string
          order_index?: number
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          goal_id?: string
          id?: string
          order_index?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_steps_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: string | null
          created_at: string
          feeling: string | null
          id: string
          obstacles: string | null
          progress: number
          status: string
          target_date: string | null
          title: string
          user_id: string
          why: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          feeling?: string | null
          id?: string
          obstacles?: string | null
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          user_id: string
          why?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          feeling?: string | null
          id?: string
          obstacles?: string | null
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          user_id?: string
          why?: string | null
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date?: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          target_per_week: number
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          target_per_week?: number
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          target_per_week?: number
          user_id?: string
        }
        Relationships: []
      }
      journals: {
        Row: {
          content: string
          created_at: string
          entry_date: string
          id: string
          is_favorite: boolean
          mood: number | null
          prompt: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          is_favorite?: boolean
          mood?: number | null
          prompt?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          entry_date?: string
          id?: string
          is_favorite?: boolean
          mood?: number | null
          prompt?: string | null
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      moments: {
        Row: {
          audio_marks: Json | null
          audio_url: string | null
          audio_voice: string | null
          body: string
          category: string | null
          created_at: string
          desire_id: string | null
          duration_seconds: number
          expires_at: string | null
          goal_id: string | null
          hook: string | null
          id: string
          image_url: string | null
          is_favorite: boolean
          kind: string
          listened_at: string | null
          moment_date: string
          source: string
          title: string
          user_id: string
        }
        Insert: {
          audio_marks?: Json | null
          audio_url?: string | null
          audio_voice?: string | null
          body: string
          category?: string | null
          created_at?: string
          desire_id?: string | null
          duration_seconds?: number
          expires_at?: string | null
          goal_id?: string | null
          hook?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          kind?: string
          listened_at?: string | null
          moment_date?: string
          source?: string
          title: string
          user_id: string
        }
        Update: {
          audio_marks?: Json | null
          audio_url?: string | null
          audio_voice?: string | null
          body?: string
          category?: string | null
          created_at?: string
          desire_id?: string | null
          duration_seconds?: number
          expires_at?: string | null
          goal_id?: string | null
          hook?: string | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          kind?: string
          listened_at?: string | null
          moment_date?: string
          source?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moments_desire_id_fkey"
            columns: ["desire_id"]
            isOneToOne: false
            referencedRelation: "desires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          desired_feeling: string | null
          desires: string | null
          display_name: string | null
          email: string | null
          focus_areas: string[]
          id: string
          last_notified_on: string | null
          notifications_enabled: boolean
          notify_hour: number
          notify_minute: number
          practice_minutes: number
          practice_styles: string[]
          practice_time_of_day: string
          obstacles: string | null
          onboarded_at: string | null
          subscription_tier: string
          timezone: string | null
          tone: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          desired_feeling?: string | null
          desires?: string | null
          display_name?: string | null
          email?: string | null
          focus_areas?: string[]
          id: string
          last_notified_on?: string | null
          notifications_enabled?: boolean
          notify_hour?: number
          notify_minute?: number
          practice_minutes?: number
          practice_styles?: string[]
          practice_time_of_day?: string
          obstacles?: string | null
          onboarded_at?: string | null
          subscription_tier?: string
          timezone?: string | null
          tone?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          desired_feeling?: string | null
          desires?: string | null
          display_name?: string | null
          email?: string | null
          focus_areas?: string[]
          id?: string
          last_notified_on?: string | null
          notifications_enabled?: boolean
          notify_hour?: number
          notify_minute?: number
          practice_minutes?: number
          practice_styles?: string[]
          practice_time_of_day?: string
          obstacles?: string | null
          onboarded_at?: string | null
          subscription_tier?: string
          timezone?: string | null
          tone?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          device_token: string | null
          endpoint: string
          failure_count: number
          id: string
          last_success_at: string | null
          p256dh: string | null
          platform: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          device_token?: string | null
          endpoint: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string | null
          platform?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          device_token?: string | null
          endpoint?: string
          failure_count?: number
          id?: string
          last_success_at?: string | null
          p256dh?: string | null
          platform?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          price_display: string | null
          status: string
          store: string
          store_transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan: string
          price_display?: string | null
          status?: string
          store?: string
          store_transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          price_display?: string | null
          status?: string
          store?: string
          store_transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
