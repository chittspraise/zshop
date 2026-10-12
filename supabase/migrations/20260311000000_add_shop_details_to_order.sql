-- Add shop collection and pickup details to order table
ALTER TABLE public."order"
ADD COLUMN IF NOT EXISTS shop_name TEXT,
ADD COLUMN IF NOT EXISTS shop_address TEXT,
ADD COLUMN IF NOT EXISTS shop_phone TEXT,
ADD COLUMN IF NOT EXISTS shop_owner_name TEXT,
ADD COLUMN IF NOT EXISTS shop_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS shop_longitude NUMERIC;
