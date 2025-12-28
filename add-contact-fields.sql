-- Add contact info columns to rides table for other person bookings

ALTER TABLE rides ADD COLUMN IF NOT EXISTS contact_name VARCHAR(100);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_for_other BOOLEAN DEFAULT false;