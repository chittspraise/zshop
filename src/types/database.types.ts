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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      category: {
        Row: {
          created_at: string
          id: number
          imageUrl: string
          name: string
          product: number[] | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: number
          imageUrl: string
          name: string
          product?: number[] | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: number
          imageUrl?: string
          name?: string
          product?: number[] | null
          slug?: string
        }
        Relationships: []
      }
      order: {
        Row: {
          created_at: string
          declined_shops_count: number | null
          delivery_address: string | null
          description: string | null
          id: number
          latitude: number | null
          longitude: number | null
          notified_shops_count: number | null
          refunded_amount: number | null
          shop_address: string | null
          shop_latitude: number | null
          shop_longitude: number | null
          shop_name: string | null
          shop_owner_name: string | null
          shop_phone: string | null
          slug: string
          status: string
          totalPrice: number
          user: string
        }
        Insert: {
          created_at?: string
          declined_shops_count?: number | null
          delivery_address?: string | null
          description?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          notified_shops_count?: number | null
          refunded_amount?: number | null
          shop_address?: string | null
          shop_latitude?: number | null
          shop_longitude?: number | null
          shop_name?: string | null
          shop_owner_name?: string | null
          shop_phone?: string | null
          slug: string
          status: string
          totalPrice: number
          user: string
        }
        Update: {
          created_at?: string
          declined_shops_count?: number | null
          delivery_address?: string | null
          description?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          notified_shops_count?: number | null
          refunded_amount?: number | null
          shop_address?: string | null
          shop_latitude?: number | null
          shop_longitude?: number | null
          shop_name?: string | null
          shop_owner_name?: string | null
          shop_phone?: string | null
          slug?: string
          status?: string
          totalPrice?: number
          user?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item: {
        Row: {
          created_at: string
          id: number
          order: number
          product: number
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: number
          order: number
          product: number
          quantity: number
        }
        Update: {
          created_at?: string
          id?: number
          order?: number
          product?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_order_fkey"
            columns: ["order"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_product_fkey"
            columns: ["product"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          category: number
          created_at: string
          description: string | null
          heroImage: string
          id: number
          imagesUrl: string[]
          maxQuantity: number
          price: number
          slug: string | null
          title: string
        }
        Insert: {
          category: number
          created_at?: string
          description?: string | null
          heroImage: string
          id?: number
          imagesUrl: string[]
          maxQuantity: number
          price: number
          slug?: string | null
          title: string
        }
        Update: {
          category?: number
          created_at?: string
          description?: string | null
          heroImage?: string
          id?: number
          imagesUrl?: string[]
          maxQuantity?: number
          price?: number
          slug?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          address: string | null
          created_at: string
          delivery_note: string | null
          email: string | null
          first_name: string | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          phone_number: string | null
          user_id: string
          wallet_balance: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          delivery_note?: string | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          phone_number?: string | null
          user_id: string
          wallet_balance?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          delivery_note?: string | null
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          phone_number?: string | null
          user_id?: string
          wallet_balance?: number | null
        }
        Relationships: []
      }
      registration_sessions: {
        Row: {
          address: string | null
          first_name: string | null
          phone_number: string
          shop_name: string | null
          step: number | null
          surname: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          first_name?: string | null
          phone_number: string
          shop_name?: string | null
          step?: number | null
          surname?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          first_name?: string | null
          phone_number?: string
          shop_name?: string | null
          step?: number | null
          surname?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_pending_orders: {
        Row: {
          created_at: string
          id: number
          order_slug: string
          shop_phone: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: number
          order_slug: string
          shop_phone: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: number
          order_slug?: string
          shop_phone?: string
          status?: string
        }
        Relationships: []
      }
      shops: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone_number: string
          shop_name: string
          surname: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone_number: string
          shop_name: string
          surname: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone_number?: string
          shop_name?: string
          surname?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string
          created_at: string | null
          email: string
          expo_notification_token: string | null
          id: string
          stripe_customer_id: string | null
          paystack_customer_id?: string | null
          type: string | null
        }
        Insert: {
          avatar_url: string
          created_at?: string | null
          email: string
          expo_notification_token?: string | null
          id: string
          stripe_customer_id?: string | null
          paystack_customer_id?: string | null
          type?: string | null
        }
        Update: {
          avatar_url?: string
          created_at?: string | null
          email?: string
          expo_notification_token?: string | null
          id?: string
          stripe_customer_id?: string | null
          paystack_customer_id?: string | null
          type?: string | null
        }
        Relationships: []
      }
      user_cards: {
        Row: {
          id: string
          user_id: string
          authorization_code: string
          card_type: string | null
          last4: string
          exp_month: string | null
          exp_year: string | null
          bank: string | null
          channel: string | null
          reusable: boolean | null
          country_code: string | null
          account_name: string | null
          is_default: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          authorization_code: string
          card_type?: string | null
          last4: string
          exp_month?: string | null
          exp_year?: string | null
          bank?: string | null
          channel?: string | null
          reusable?: boolean | null
          country_code?: string | null
          account_name?: string | null
          is_default?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          authorization_code?: string
          card_type?: string | null
          last4?: string
          exp_month?: string | null
          exp_year?: string | null
          bank?: string | null
          channel?: string | null
          reusable?: boolean | null
          country_code?: string | null
          account_name?: string | null
          is_default?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          currency: string
          rate: number
          base_currency: string
          updated_at: string
        }
        Insert: {
          currency: string
          rate: number
          base_currency?: string
          updated_at?: string
        }
        Update: {
          currency?: string
          rate?: number
          base_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_product_quantity: {
        Args: { product_id: number; quantity: number }
        Returns: undefined
      }
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
