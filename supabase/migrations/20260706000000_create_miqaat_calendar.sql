-- Create miqaat_calendar table for annual miqaat events
-- Keyed by hijri month-day (MM-DD) so events repeat every year
-- No external API dependency - all data is stored locally in Supabase

CREATE TABLE IF NOT EXISTS miqaat_calendar (
  id BIGSERIAL PRIMARY KEY,
  hijri_date VARCHAR(5) NOT NULL,  -- "MM-DD" format
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'Urus', 'Eid', 'Wilaadat', 'Wafaat', 'Ashara Mubaraka', 'Yawme Ashura', 'Event'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_miqaat_calendar_date ON miqaat_calendar (hijri_date);

ALTER TABLE miqaat_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read miqaat_calendar"
  ON miqaat_calendar
  FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (use Supabase dashboard or SQL console)

-- ========================
-- SEED DATA: Annual Miqaats
-- ========================

INSERT INTO miqaat_calendar (hijri_date, name, type) VALUES

-- ===== MUHARRAM (01) =====
('01-01', 'Raas el Sanah al-Hijriah', 'Event'),
('01-01', 'Moulaya Abdullah AQ (Khambat)', 'Urus'),
('01-02', 'Syedi Shaikh Pir Jamaluddin (Jamnagar)', 'Urus'),
('01-02', 'Syedi Khanji Feer Saheb AQ [Mukasir] (Udaipur)', 'Urus'),
('01-02', 'Mawlai Raj Bin Mawlai Hasan Saheb (Ahmedabad)', 'Urus'),
('01-02', 'Vaaz 1 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-03', 'Vaaz 2 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-04', 'Vaaz 3 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-05', 'Vaaz 4 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-06', 'Syedi Mohammed Bin Qazikhan', 'Urus'),
('01-06', 'Vaaz 5 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-07', 'Syedna Ismail Badruddin RA [38th Dai] (Jamnagar)', 'Urus'),
('01-07', 'Vaaz 6 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-08', 'Vaaz 7 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-09', 'Vaaz 8 (Ashara Mubaraka)', 'Ashara Mubaraka'),
('01-10', 'Ashura', 'Yawme Ashura'),
('01-10', 'Syedna Zoeb Bin Musa AQ [1st Dai] (Haus)', 'Urus'),
('01-10', 'Moulaya Ahmed AQ (Khambat)', 'Urus'),
('01-14', 'Moulaya Luqmanji bin Mulla Ali bhai AQ (Wankaner)', 'Urus'),
('01-15', 'Mawlai Nuruddin Saheb', 'Urus'),
('01-16', 'Syedna Hatim bin Syedna Ibrahim RA [3rd Dai] (Hutaib)', 'Urus'),
('01-17', 'Shahadat Imam Ali Zainulabedin SA', 'Urus'),
('01-17', 'Seven Shahid Sahebo', 'Urus'),
('01-17', 'Moulaya Masood bin Moulaya Sulaiman AQ (Dhrangadhra)', 'Urus'),
('01-17', 'Mulla Mohammedali bin Syedi Najam Khan (Pune)', 'Urus'),
('01-17', 'Syedna Ibrahim Vajihuddin RA [39th Dai] (Ujjain)', 'Urus'),
('01-18', 'Syedi Ghani Feer bin Dawoodji Shaheed AQ (Kalavad)', 'Urus'),
('01-23', 'Syedi Hasanfeer al-Shaheed AQ (Denmaal)', 'Urus'),
('01-23', 'Noor Bibi Umme Syedna Yusuf Najmuddin', 'Urus'),
('01-23', 'Fatema Bibi Ukhte Syedna Yusuf Najmuddin', 'Urus'),
('01-24', 'Syedi Dada Sulemanji (Bundi/Kota)', 'Urus'),
('01-27', 'Syedi Fakhruddin al-Shaheed AQ (Taherabad)', 'Urus'),
('01-28', 'Syedi Moosanji bin Taj Shaheed AQ (Baroda)', 'Urus'),
('01-29', 'Mawlai Hasan Bin Mawlai Adam (Ahmedabad)', 'Urus'),

-- ===== SAFAR (02) =====
('02-20', 'Arba''een / Chehlum', 'Event'),

-- ===== RABI AL-AWWAL (03) =====
('03-09', 'Eid-e-Zahra', 'Eid'),
('03-17', 'Wilaadat Imam Jafar us Sadiq SA', 'Wilaadat'),

-- ===== RABI AL-AAKHAR (04) =====
('04-08', 'Wafaat Imam Hasan al-Askari SA', 'Wafaat'),

-- ===== JUMADA AL-ULA (05) =====
('05-10', 'Wilaadat Imam Hasan al-Mujtaba SA', 'Wilaadat'),

-- ===== JUMADA AL-AKHIRA (06) =====
('06-20', 'Wilaadat Imam Zainulabedin SA', 'Wilaadat'),

-- ===== RAJAB (07) =====
('07-13', 'Wilaadat Maulana Ali SA', 'Wilaadat'),
('07-25', 'Wafaat Imam Musa al-Kadhim SA', 'Wafaat'),
('07-25', 'Wilaadat Imam Ali bin Abi Talib SA', 'Wilaadat'),

-- ===== SHABAN (08) =====
('08-03', 'Wilaadat Imam Husain SA', 'Wilaadat'),
('08-04', 'Wilaadat Abul Fazlil Abbas SA', 'Wilaadat'),
('08-15', 'Wilaadat Sahib al-Zaman al-Mehdi SA', 'Wilaadat'),

-- ===== RAMADAN (09) =====
('09-19', 'Dharbat Moula Ali SA', 'Event'),
('09-21', 'Shahadat Moula Ali SA', 'Wafaat'),

-- ===== SHAWWAL (10) =====
('10-01', 'Eid-ul-Fitr', 'Eid'),
('10-25', 'Wafaat Imam Jafar us Sadiq SA', 'Wafaat'),

-- ===== ZIL QAADAH (11) =====
('11-25', 'Yawme Dahwul Ardh', 'Event'),

-- ===== ZIL HAJJAH (12) =====
('12-10', 'Eid-ul-Adha', 'Eid'),
('12-18', 'Eid-ul-Ghadeer', 'Eid'),
('12-24', 'Yawme Mubahila', 'Event');
