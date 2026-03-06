CREATE TABLE IF NOT EXISTS public.profile (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  first_name text,
  phone_number text,
  address text,
  wallet_balance numeric DEFAULT 0,
  delivery_note text,
  email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

ALTER TABLE public."order" ADD COLUMN IF NOT EXISTS refunded_amount numeric DEFAULT 0;