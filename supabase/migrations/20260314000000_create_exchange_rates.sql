-- Create exchange_rates table in Supabase
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  currency TEXT PRIMARY KEY,
  rate NUMERIC NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Allow public read access to exchange_rates
DROP POLICY IF EXISTS "Allow public read access to exchange_rates" ON public.exchange_rates;
CREATE POLICY "Allow public read access to exchange_rates"
  ON public.exchange_rates
  FOR SELECT
  USING (true);

-- Allow authenticated and service_role write access
DROP POLICY IF EXISTS "Allow service role all access to exchange_rates" ON public.exchange_rates;
CREATE POLICY "Allow service role all access to exchange_rates"
  ON public.exchange_rates
  FOR ALL
  USING (true)
  WITH CHECK (true);
