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
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hosting_subscriptions: {
        Row: {
          amount: number
          auto_renew: boolean
          client_id: string
          created_at: string
          currency: string
          end_date: string
          id: string
          invoice_id: string | null
          notes: string | null
          service_name: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          auto_renew?: boolean
          client_id: string
          created_at?: string
          currency?: string
          end_date: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          service_name: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          auto_renew?: boolean
          client_id?: string
          created_at?: string
          currency?: string
          end_date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          service_name?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hosting_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_subscriptions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          paid_on: string
          reference: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          reference?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          paid_on?: string
          reference?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paid: number
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          discount: number
          due_date: string
          id: string
          issue_date: string
          items: Json
          next_issue_date: string | null
          notes: string | null
          number: string
          open_count: number
          opened_at: string | null
          paid_at: string | null
          quotation_id: string | null
          recurring_interval: string | null
          sent_at: string | null
          sent_by: string | null
          share_token: string
          status: string
          subtotal: number
          tax_rate: number
          terms: string | null
          title: string
          total: number
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number
          due_date?: string
          id?: string
          issue_date?: string
          items?: Json
          next_issue_date?: string | null
          notes?: string | null
          number: string
          open_count?: number
          opened_at?: string | null
          paid_at?: string | null
          quotation_id?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          sent_by?: string | null
          share_token?: string
          status?: string
          subtotal?: number
          tax_rate?: number
          terms?: string | null
          title: string
          total?: number
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount?: number
          due_date?: string
          id?: string
          issue_date?: string
          items?: Json
          next_issue_date?: string | null
          notes?: string | null
          number?: string
          open_count?: number
          opened_at?: string | null
          paid_at?: string | null
          quotation_id?: string | null
          recurring_interval?: string | null
          sent_at?: string | null
          sent_by?: string | null
          share_token?: string
          status?: string
          subtotal?: number
          tax_rate?: number
          terms?: string | null
          title?: string
          total?: number
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          last_seen_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pending_admin_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bank_accounts: Json
          bank_details: string | null
          brand_color: string
          business_address: string | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          created_at: string
          default_currency: string
          deposit_percent: number
          doc_design: Json
          id: string
          logo_url: string | null
          terms_conditions: string | null
          updated_at: string
        }
        Insert: {
          bank_accounts?: Json
          bank_details?: string | null
          brand_color?: string
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          default_currency?: string
          deposit_percent?: number
          doc_design?: Json
          id: string
          logo_url?: string | null
          terms_conditions?: string | null
          updated_at?: string
        }
        Update: {
          bank_accounts?: Json
          bank_details?: string | null
          brand_color?: string
          business_address?: string | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          created_at?: string
          default_currency?: string
          deposit_percent?: number
          doc_design?: Json
          id?: string
          logo_url?: string | null
          terms_conditions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_comments: {
        Row: {
          author_name: string | null
          body: string
          client_visible: boolean
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          client_visible?: boolean
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          client_visible?: boolean
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_feedback: {
        Row: {
          client_email: string | null
          client_name: string | null
          created_at: string
          id: string
          message: string
          project_id: string
          resolved: boolean
          revision_number: number
          screenshots: Json
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          message: string
          project_id: string
          resolved?: boolean
          revision_number: number
          screenshots?: Json
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          id?: string
          message?: string
          project_id?: string
          resolved?: boolean
          revision_number?: number
          screenshots?: Json
        }
        Relationships: [
          {
            foreignKeyName: "project_feedback_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_meeting_requests: {
        Row: {
          client_email: string | null
          client_name: string | null
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          paid: boolean
          preferred_at: string | null
          project_id: string
          revision_number: number
          status: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          duration_minutes: number
          id?: string
          notes?: string | null
          paid?: boolean
          preferred_at?: string | null
          project_id: string
          revision_number: number
          status?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          paid?: boolean
          preferred_at?: string | null
          project_id?: string
          revision_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_meeting_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assignee_name: string | null
          client_id: string | null
          client_visible: boolean
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          paid_revisions: number
          progress: number
          quotation_id: string | null
          revision1_done: boolean
          revision2_done: boolean
          share_token: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_name?: string | null
          client_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_revisions?: number
          progress?: number
          quotation_id?: string | null
          revision1_done?: boolean
          revision2_done?: boolean
          share_token?: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_name?: string | null
          client_id?: string | null
          client_visible?: boolean
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_revisions?: number
          progress?: number
          quotation_id?: string | null
          revision1_done?: boolean
          revision2_done?: boolean
          share_token?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          accepted_at: string | null
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          deposit_percent: number
          discount: number
          follow_up_at: string | null
          follow_up_done: boolean
          id: string
          items: Json
          notes: string | null
          number: string
          open_count: number
          opened_at: string | null
          sent_at: string | null
          sent_by: string | null
          share_token: string
          status: string
          subtotal: number
          tax_rate: number
          terms: string | null
          title: string
          total: number
          updated_at: string
          user_id: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_percent?: number
          discount?: number
          follow_up_at?: string | null
          follow_up_done?: boolean
          id?: string
          items?: Json
          notes?: string | null
          number: string
          open_count?: number
          opened_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          share_token?: string
          status?: string
          subtotal?: number
          tax_rate?: number
          terms?: string | null
          title: string
          total?: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_percent?: number
          discount?: number
          follow_up_at?: string | null
          follow_up_done?: boolean
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          open_count?: number
          opened_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          share_token?: string
          status?: string
          subtotal?: number
          tax_rate?: number
          terms?: string | null
          title?: string
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          currency: string
          discount: number
          id: string
          invoice_id: string
          issued_at: string
          items: Json
          notes: string | null
          number: string
          share_token: string
          subtotal: number
          tax_rate: number
          terms: string | null
          total: number
          user_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          currency: string
          discount?: number
          id?: string
          invoice_id: string
          issued_at?: string
          items?: Json
          notes?: string | null
          number: string
          share_token?: string
          subtotal?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          discount?: number
          id?: string
          invoice_id?: string
          issued_at?: string
          items?: Json
          notes?: string | null
          number?: string
          share_token?: string
          subtotal?: number
          tax_rate?: number
          terms?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_quotation: { Args: { p_token: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_invoice_viewed: { Args: { p_token: string }; Returns: undefined }
      mark_quotation_viewed: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "accounts"
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
      app_role: ["admin", "accounts"],
    },
  },
} as const
