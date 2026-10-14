-- Remove duplicate and legacy triggers causing duplicate WhatsApp notifications
DROP TRIGGER IF EXISTS "whatsaapwebhook" ON public."order";
DROP TRIGGER IF EXISTS "twilliohook" ON public."order";
DROP TRIGGER IF EXISTS "on_order_created_whatsapp" ON public."order";
DROP FUNCTION IF EXISTS public.handle_new_order_whatsapp();

-- Ensure single clean trigger for sending WhatsApp order notifications
DROP TRIGGER IF EXISTS "on_order_created" ON public."order";
CREATE TRIGGER on_order_created
AFTER INSERT ON public."order"
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_whatsapp_order();

-- Clean up temporary inspection functions
DROP FUNCTION IF EXISTS public.get_order_triggers();
DROP FUNCTION IF EXISTS public.get_fn_src(text);
