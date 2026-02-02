-- Add client_name column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_name TEXT;
