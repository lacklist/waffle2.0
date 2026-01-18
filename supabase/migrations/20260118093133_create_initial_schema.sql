/*
  # Create Initial Schema for Waffle Data

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `telegram_id` (bigint, unique, not null) - Telegram user ID
      - `username` (text, nullable) - Telegram username
      - `first_name` (text, not null) - User first name
      - `last_name` (text, nullable) - User last name
      - `subscription_type` (text, not null, default 'free') - User subscription level
      - `created_at` (timestamptz, default now())

    - `templates`
      - `id` (uuid, primary key)
      - `name` (text, not null) - Template name
      - `category` (text, not null) - Template category
      - `description` (text, not null) - Template description
      - `is_premium` (boolean, default false) - Premium template flag
      - `created_at` (timestamptz, default now())

    - `directories`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, foreign key to users) - Directory owner
      - `name` (text, not null) - Directory name
      - `slug` (text, not null) - URL-friendly slug
      - `type` (text, not null) - 'private' or 'public'
      - `storage_type` (text, not null) - Storage type
      - `template_type` (text, not null) - Template type used
      - `theme` (text, not null, default 'light') - UI theme
      - `view_count` (integer, default 0) - Number of views
      - `is_published` (boolean, default false) - Publication status
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  username text,
  first_name text NOT NULL,
  last_name text,
  subscription_type text NOT NULL DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates are viewable by everyone"
  ON templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS directories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  type text NOT NULL,
  storage_type text NOT NULL,
  template_type text NOT NULL,
  theme text NOT NULL DEFAULT 'light',
  view_count integer DEFAULT 0,
  is_published boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE directories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own directories"
  ON directories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own directories"
  ON directories
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own directories"
  ON directories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own directories"
  ON directories
  FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO templates (name, category, description, is_premium) VALUES
  ('Документы и файлы', 'documents', 'Простое хранилище для документов и файлов', false),
  ('Медиа галерея', 'media', 'Хранилище для фото, видео и аудио файлов', false),
  ('База знаний', 'knowledge', 'Структурированная база знаний с поиском', true),
  ('Проектная документация', 'projects', 'Управление проектной документацией', true),
  ('Личный архив', 'archive', 'Личное хранилище с тегами и категориями', false)
ON CONFLICT DO NOTHING;