-- Enable real-time updates for zakazi table
ALTER TABLE public.zakazi REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zakazi;

-- Enable real-time updates for zadachi table
ALTER TABLE public.zadachi REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zadachi;