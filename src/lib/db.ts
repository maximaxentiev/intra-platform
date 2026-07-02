// Domain types + typed supabase client alias.
// Types file is auto-generated and stale after our migration, so we cast.
import { supabase as _supabase } from "@/integrations/supabase/client";

export const db = _supabase as unknown as {
  from: (t: string) => any;
  auth: (typeof _supabase)["auth"];
  channel: (typeof _supabase)["channel"];
  removeChannel: (typeof _supabase)["removeChannel"];
};

export type StaffStatus = "active" | "inactive";
export type CentreChannel = "whatsapp" | "goto" | "email";
export type ShiftStatus = "pending" | "filled" | "cancelled" | "completed";

export interface Staff {
  id: string;
  legal_name: string;
  display_name: string;
  use_display_name: boolean;
  phone: string;
  email: string;
  role: string;
  status: StaffStatus;
  notes: string;
  documents_url: string;
  created_at: string;
  updated_at: string;
}

export interface Centre {
  id: string;
  name: string;
  address: string;
  contact_name: string;
  contact_title: string;
  contact_phone: string;
  contact_email: string;
  preferred_channel: CentreChannel;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Availability {
  id: string;
  staff_id: string;
  week_start_date: string; // YYYY-MM-DD (Monday)
  day_of_week: number; // 0=Mon..6=Sun
  start_time: string; // HH:MM:SS
  end_time: string;
}

export interface Shift {
  id: string;
  centre_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role_needed: string;
  notes: string;
  status: ShiftStatus;
  assigned_staff_id: string | null;
  cancellation_reason: string;
  created_at: string;
  updated_at: string;
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function displayStaff(s: Pick<Staff, "legal_name" | "display_name" | "use_display_name">) {
  return s.use_display_name && s.display_name ? s.display_name : s.legal_name;
}

export function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() + diff);
  return m;
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtTime(t: string): string {
  // HH:MM:SS -> h:mm AM/PM
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

export function dowFromDate(d: Date): number {
  // Convert JS 0=Sun..6=Sat to our 0=Mon..6=Sun
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}
