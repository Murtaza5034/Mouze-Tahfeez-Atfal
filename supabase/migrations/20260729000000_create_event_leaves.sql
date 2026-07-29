CREATE TABLE IF NOT EXISTS event_leaves (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id BIGINT REFERENCES miqaat_calendar(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  applied_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage event leaves"
  ON event_leaves FOR ALL
  USING (true);

CREATE POLICY "Everyone can view event leaves"
  ON event_leaves FOR SELECT
  USING (true);
