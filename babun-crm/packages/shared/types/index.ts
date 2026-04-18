// === ROLES ===
export type UserRole = 'admin' | 'dispatcher' | 'team_lead' | 'technician'

// === PROFILES ===
export interface Profile {
  id: string
  full_name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  team_id: string | null
  is_active: boolean
  created_at: string
}

// === TEAMS ===
export interface Team {
  id: string
  name: string
  region: string | null
  lead_id: string | null
  color: string
  created_at: string
}

// === CLIENTS ===
export interface Client {
  id: string
  full_name: string
  phone: string
  phone2: string | null
  sms_name: string | null
  email: string | null
  address: string | null
  address_lat: number | null
  address_lng: number | null
  comment: string | null
  balance: number
  discount: number
  source: string | null
  created_at: string
  updated_at: string
}

// === CLIENT GROUPS ===
export interface ClientGroup {
  id: string
  name: string
  color: string | null
}

// === SERVICES ===
export type ServiceCategory = 'cleaning' | 'installation' | 'repair' | 'maintenance' | 'consultation' | 'other'

export interface Service {
  id: string
  name: string
  category: ServiceCategory
  duration_minutes: number
  price: number
  is_active: boolean
  sort_order: number
  created_at: string
}

// === APPOINTMENTS ===
export type AppointmentStatus = 'scheduled' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
export type PaymentStatus = 'pending' | 'paid' | 'partial'
export type PaymentMethod = 'cash' | 'card' | 'transfer'

export interface Appointment {
  id: string
  client_id: string
  team_id: string | null
  assigned_to: string | null
  service_id: string
  date: string
  time_start: string
  time_end: string
  address: string
  address_lat: number | null
  address_lng: number | null
  status: AppointmentStatus
  notes: string | null
  client_notes: string | null
  price: number | null
  discount: number
  total: number | null
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  color: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// === TRANSACTIONS ===
export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  category: string
  amount: number
  description: string | null
  appointment_id: string | null
  team_id: string | null
  profile_id: string | null
  date: string
  created_at: string
}

// === MESSAGES ===
export type MessageChannel = 'whatsapp' | 'instagram' | 'telegram' | 'messenger' | 'sms' | 'phone' | 'manual'
export type MessageDirection = 'inbound' | 'outbound'

export interface Message {
  id: string
  client_id: string
  channel: MessageChannel
  direction: MessageDirection
  content: string | null
  media_url: string | null
  external_id: string | null
  status: string
  sent_by: string | null
  created_at: string
}

// === CONVERSATIONS ===
export interface Conversation {
  id: string
  client_id: string
  channel: MessageChannel
  last_message_at: string
  unread_count: number
  assigned_to: string | null
  status: 'open' | 'snoozed' | 'closed'
}

// === SMS TEMPLATES ===
export interface SmsTemplate {
  id: string
  name: string
  body: string
  channel: string
  is_active: boolean
}

// === CALL LOGS ===
export interface CallLog {
  id: string
  client_id: string | null
  profile_id: string
  direction: 'inbound' | 'outbound'
  duration_seconds: number | null
  recording_url: string | null
  notes: string | null
  created_at: string
}

// === TEAM LOCATIONS ===
export interface TeamLocation {
  id: string
  profile_id: string
  lat: number
  lng: number
  updated_at: string
}

export * from './finance'
