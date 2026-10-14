-- Temporary inspection function to check all triggers on table "order"
CREATE OR REPLACE FUNCTION public.get_order_triggers()
RETURNS TABLE (
  trigger_name text,
  event_manipulation text,
  action_statement text,
  action_orientation text
) AS $$
  SELECT
    trigger_name::text,
    event_manipulation::text,
    action_statement::text,
    action_orientation::text
  FROM information_schema.triggers
  WHERE event_object_table = 'order';
$$ LANGUAGE sql SECURITY DEFINER;
