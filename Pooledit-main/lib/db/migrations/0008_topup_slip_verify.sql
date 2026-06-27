-- Automated slip-reading results on top-up requests (QR + OCR), to assist admin review.
ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS slip_ref text;
ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS slip_amount numeric(12,2);
ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS slip_bank text;
ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS slip_recipient_match boolean;
ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS slip_verdict text;
ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS slip_warnings text;
ALTER TABLE topup_requests ADD COLUMN IF NOT EXISTS slip_checked_at timestamptz;
