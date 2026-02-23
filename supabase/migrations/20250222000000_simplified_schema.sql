-- Simplified coaching homework schema (run in Supabase SQL editor if not using Supabase CLI)
-- Assumes you may already have homework_sessions_v2, recordings_v2, etc.; this adds new columns and task_1_pool.

-- Task 1 pool (homework task description, not scored)
CREATE TABLE IF NOT EXISTS task_1_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Exercises pool (if not exists)
CREATE TABLE IF NOT EXISTS exercises_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_starting_metric int NOT NULL DEFAULT 100,
  target_wpm_min int,
  target_wpm_max int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Homework sessions (create if not exists; otherwise add column)
CREATE TABLE IF NOT EXISTS homework_sessions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'recording', 'processing', 'completed')),
  recommended_exercise_id uuid REFERENCES exercises_pool(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE homework_sessions_v2 ADD COLUMN IF NOT EXISTS recommended_exercise_id uuid REFERENCES exercises_pool(id);
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Recordings (create if not exists; add metric columns)
CREATE TABLE IF NOT EXISTS recordings_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES homework_sessions_v2(id) ON DELETE CASCADE,
  storage_path text,
  transcript text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recordings_v2 ADD COLUMN IF NOT EXISTS wpm numeric;
ALTER TABLE recordings_v2 ADD COLUMN IF NOT EXISTS voice_strength numeric;
ALTER TABLE recordings_v2 ADD COLUMN IF NOT EXISTS filler_count int NOT NULL DEFAULT 0;
ALTER TABLE recordings_v2 ADD COLUMN IF NOT EXISTS starting_metric int NOT NULL DEFAULT 100;
ALTER TABLE recordings_v2 ADD COLUMN IF NOT EXISTS score numeric;

-- Student overrides / context (coach notes, defaults, homework message)
CREATE TABLE IF NOT EXISTS student_overrides_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  coach_notes text,
  starting_metric_override int,
  default_task_1_id uuid REFERENCES task_1_pool(id),
  default_exercise_id uuid REFERENCES exercises_pool(id),
  homework_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_overrides_v2 ADD COLUMN IF NOT EXISTS default_task_1_id uuid REFERENCES task_1_pool(id);
ALTER TABLE student_overrides_v2 ADD COLUMN IF NOT EXISTS default_exercise_id uuid REFERENCES exercises_pool(id);
ALTER TABLE student_overrides_v2 ADD COLUMN IF NOT EXISTS homework_message text;

-- Homework reports
CREATE TABLE IF NOT EXISTS homework_reports_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES homework_sessions_v2(id) ON DELETE CASCADE,
  recording_id uuid REFERENCES recordings_v2(id) ON DELETE SET NULL,
  summary text,
  score numeric,
  starting_metric int,
  filler_count int NOT NULL DEFAULT 0,
  coach_feedback_text text,
  coach_feedback_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_homework_sessions_v2_user_id ON homework_sessions_v2(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_sessions_v2_status ON homework_sessions_v2(status);
CREATE INDEX IF NOT EXISTS idx_recordings_v2_session_id ON recordings_v2(session_id);
CREATE INDEX IF NOT EXISTS idx_homework_reports_v2_session_id ON homework_reports_v2(session_id);
CREATE INDEX IF NOT EXISTS idx_student_overrides_v2_user_id ON student_overrides_v2(user_id);
