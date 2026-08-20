-- Ensure the order table has the missing address and coordinates columns
ALTER TABLE public."order" 
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Enable the pg_net extension (used by Supabase for secure HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a trigger function that invokes the send-whatsapp-order Edge Function
CREATE OR REPLACE FUNCTION public.trigger_send_whatsapp_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform an asynchronous HTTP POST payload to our Supabase Edge Function
  PERFORM net.http_post(
    url := 'https://qzfphqccgcwetislggto.supabase.co/functions/v1/send-whatsapp-order', -- Or your remote URL in production
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(current_setting('request.headers', true)::jsonb->>'authorization', '')
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'order',
      'record', row_to_json(NEW)::jsonb
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set up the trigger to fire on INSERT on the order table
DROP TRIGGER IF EXISTS on_order_created ON public."order";
CREATE TRIGGER on_order_created
AFTER INSERT ON public."order"
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_whatsapp_order();
