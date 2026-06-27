-- Opt-in: auto-approve a top-up when the slip reader is confident (verdict = "match").
ALTER TABLE settings ADD COLUMN IF NOT EXISTS topup_auto_approve boolean NOT NULL DEFAULT false;
