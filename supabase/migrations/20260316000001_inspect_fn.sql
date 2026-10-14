CREATE OR REPLACE FUNCTION public.get_fn_src(fn_name text)
RETURNS text AS $$
  SELECT prosrc FROM pg_proc WHERE proname = fn_name LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
