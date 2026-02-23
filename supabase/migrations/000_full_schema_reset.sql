-- Full schema reset: run this on a fresh DB (or after dropping everything).
-- No assumptions. This is the complete coaching homework schema.

-- ========== DROP (children first, then parents) ==========
DROP TABLE IF EXISTS homework_reports_v2;
DROP TABLE IF EXISTS recordings_v2;
DROP TABLE IF EXISTS homework_sessions_v2;
DROP TABLE IF EXISTS student_overrides_v2;
DROP TABLE IF EXISTS task_1_pool;
DROP TABLE IF EXISTS exercises_pool;

-- ========== CREATE TABLES ==========

-- Task 1 pool (homework task description, not scored)
CREATE TABLE task_1_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Exercises pool
CREATE TABLE exercises_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_starting_metric int NOT NULL DEFAULT 100,
  target_wpm_min int,
  target_wpm_max int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Homework sessions
CREATE TABLE homework_sessions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'recording', 'processing', 'completed')),
  recommended_exercise_id uuid REFERENCES exercises_pool(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Recordings
CREATE TABLE recordings_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES homework_sessions_v2(id) ON DELETE CASCADE,
  storage_path text,
  transcript text,
  wpm numeric,
  voice_strength numeric,
  filler_count int NOT NULL DEFAULT 0,
  starting_metric int NOT NULL DEFAULT 100,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Student overrides / context (coach notes)
CREATE TABLE student_overrides_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  coach_notes text,
  starting_metric_override int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Homework reports
CREATE TABLE homework_reports_v2 (
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

-- ========== INDEXES ==========
CREATE INDEX idx_homework_sessions_v2_user_id ON homework_sessions_v2(user_id);
CREATE INDEX idx_homework_sessions_v2_status ON homework_sessions_v2(status);
CREATE INDEX idx_recordings_v2_session_id ON recordings_v2(session_id);
CREATE INDEX idx_homework_reports_v2_session_id ON homework_reports_v2(session_id);
CREATE INDEX idx_student_overrides_v2_user_id ON student_overrides_v2(user_id);
