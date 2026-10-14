-- Create user_cards table to securely store reusable Paystack authorization tokens
CREATE TABLE IF NOT EXISTS public.user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  authorization_code TEXT NOT NULL,
  card_type TEXT,
  last4 TEXT NOT NULL,
  exp_month TEXT,
  exp_year TEXT,
  bank TEXT,
  channel TEXT DEFAULT 'card',
  reusable BOOLEAN DEFAULT true,
  country_code TEXT,
  account_name TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, authorization_code)
);

-- Enable RLS
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own saved cards
DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
CREATE POLICY "Users can view own cards"
  ON public.user_cards
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to delete their own saved cards
DROP POLICY IF EXISTS "Users can delete own cards" ON public.user_cards;
CREATE POLICY "Users can delete own cards"
  ON public.user_cards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow service role full access (for Edge Functions)
DROP POLICY IF EXISTS "Service role full access on user_cards" ON public.user_cards;
CREATE POLICY "Service role full access on user_cards"
  ON public.user_cards
  FOR ALL
  USING (true)
  WITH CHECK (true);
