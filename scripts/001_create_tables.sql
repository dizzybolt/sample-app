-- Create color_codes table
CREATE TABLE IF NOT EXISTS color_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  color_code TEXT NOT NULL,
  color_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sample_entries table
CREATE TABLE IF NOT EXISTS sample_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  china_code TEXT NOT NULL,
  korea_code TEXT,
  color_code TEXT,
  color_name TEXT,
  quantity INT DEFAULT 1,
  checked_at DATE,
  status TEXT DEFAULT '미진행',
  image_url TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS for public access (no auth required for this app)
ALTER TABLE color_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sample_entries ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access to color_codes
CREATE POLICY "Allow public read color_codes" ON color_codes FOR SELECT USING (true);
CREATE POLICY "Allow public insert color_codes" ON color_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update color_codes" ON color_codes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete color_codes" ON color_codes FOR DELETE USING (true);

-- Allow public read/write access to sample_entries
CREATE POLICY "Allow public read sample_entries" ON sample_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert sample_entries" ON sample_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update sample_entries" ON sample_entries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete sample_entries" ON sample_entries FOR DELETE USING (true);

-- Insert default color codes
INSERT INTO color_codes (color_code, color_name, is_active, sort_order) VALUES
  ('01', '화이트', true, 1),
  ('02', '블랙', true, 2),
  ('03', '그레이', true, 3),
  ('04', '네이비', true, 4),
  ('05', '베이지', true, 5),
  ('06', '카키', true, 6),
  ('07', '브라운', true, 7),
  ('08', '레드', true, 8),
  ('09', '핑크', true, 9),
  ('10', '오렌지', true, 10),
  ('11', '옐로우', true, 11),
  ('12', '그린', true, 12),
  ('13', '블루', true, 13),
  ('14', '퍼플', true, 14)
ON CONFLICT DO NOTHING;
