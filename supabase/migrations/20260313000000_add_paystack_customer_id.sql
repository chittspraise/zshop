-- Add paystack_customer_id to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS paystack_customer_id TEXT;

-- Add payment_reference and payment_gateway to order table
ALTER TABLE public."order"
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'paystack';
