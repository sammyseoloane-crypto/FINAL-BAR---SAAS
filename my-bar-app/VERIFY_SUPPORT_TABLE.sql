-- Verify support_tickets table exists
SELECT 
  table_name, 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHEREtable_name = 'support_tickets'
ORDER BY ordinal_position;
