-- Attach an optional course/package to an instructor availability slot. When set, a
-- booking against this slot auto-deducts the member's package of this type, so the
-- customer doesn't pick the course (and can't pick the wrong one).
ALTER TABLE instructor_availability ADD COLUMN IF NOT EXISTS package_id integer;
