-- ============================================================
-- TASK HISTORY & COLLABORATION ENHANCEMENTS
-- ============================================================

-- Task History Table (Audit Log)
CREATE TABLE IF NOT EXISTS task_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'created', 'status_changed', 'assigned', 'updated', 'commented'
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Task Comments Table
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at DESC);

-- Enable RLS on new tables
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TASK HISTORY RLS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view task history in their tenant" ON task_history;
DROP POLICY IF EXISTS "Users can create task history" ON task_history;

-- Users can view history for tasks in their tenant
CREATE POLICY "Users can view task history in their tenant"
  ON task_history FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role())
    )
  );

-- System/staff can insert history entries
CREATE POLICY "Users can create task history"
  ON task_history FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND task_id IN (
      SELECT id FROM tasks 
      WHERE tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role())
    )
  );

-- ============================================================
-- TASK COMMENTS RLS POLICIES
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view task comments in their tenant" ON task_comments;
DROP POLICY IF EXISTS "Users can create task comments" ON task_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON task_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON task_comments;

-- Users can view comments for tasks in their tenant
CREATE POLICY "Users can view task comments in their tenant"
  ON task_comments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks 
      WHERE tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role())
    )
  );

-- Users can add comments to tasks in their tenant
CREATE POLICY "Users can create task comments"
  ON task_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND task_id IN (
      SELECT id FROM tasks 
      WHERE tenant_id = (SELECT tenant_id FROM get_user_tenant_and_role())
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON task_comments FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- FUNCTION: Auto-create task history on status change
-- ============================================================

CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_history (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;
  
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO task_history (task_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assigned', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task changes
DROP TRIGGER IF EXISTS task_status_change_trigger ON tasks;
CREATE TRIGGER task_status_change_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_status_change();

-- ============================================================
-- FUNCTION: Create initial task history on task creation
-- ============================================================

CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_history (task_id, user_id, action, new_value)
  VALUES (NEW.id, auth.uid(), 'created', NEW.status);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task creation
DROP TRIGGER IF EXISTS task_creation_trigger ON tasks;
CREATE TRIGGER task_creation_trigger
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_creation();

-- ============================================================
-- VIEWS: Useful task statistics
-- ============================================================

-- Task completion stats per user
CREATE OR REPLACE VIEW task_stats_by_user AS
SELECT 
  u.id AS user_id,
  u.email,
  u.tenant_id,
  COUNT(*) FILTER (WHERE t.status = 'completed') AS completed_tasks,
  COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress_tasks,
  COUNT(*) FILTER (WHERE t.status = 'pending') AS pending_tasks,
  COUNT(*) AS total_tasks,
  ROUND(
    (COUNT(*) FILTER (WHERE t.status = 'completed')::NUMERIC / 
    NULLIF(COUNT(*), 0)) * 100, 
    2
  ) AS completion_rate
FROM users u
LEFT JOIN tasks t ON t.assigned_to = u.id
WHERE u.role = 'staff'
GROUP BY u.id, u.email, u.tenant_id;

-- Overdue tasks view
CREATE OR REPLACE VIEW overdue_tasks AS
SELECT 
  t.*,
  u.email AS assigned_to_email,
  l.name AS location_name,
  EXTRACT(EPOCH FROM (NOW() - t.due_date))/3600 AS hours_overdue
FROM tasks t
LEFT JOIN users u ON t.assigned_to = u.id
LEFT JOIN locations l ON t.location_id = l.id
WHERE t.due_date < NOW()
  AND t.status NOT IN ('completed', 'cancelled')
ORDER BY t.due_date ASC;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT SELECT ON task_history TO authenticated;
GRANT INSERT ON task_history TO authenticated;
GRANT SELECT ON task_comments TO authenticated;
GRANT ALL ON task_comments TO authenticated;
GRANT SELECT ON task_stats_by_user TO authenticated;
GRANT SELECT ON overdue_tasks TO authenticated;
