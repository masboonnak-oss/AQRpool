-- Add the "dev" role (highest level: sees every menu + owns the GitHub patch panel).
-- ALTER TYPE ... ADD VALUE must run outside a transaction; psql autocommit is fine.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'dev';
