# Security Policy

## Data Protection Baseline

- Production must set `JWT_SECRET` and either `DATA_ENCRYPTION_KEY` or `BACKUP_ENCRYPTION_KEY`.
- Customer backups, member profiles, slips, sales logs, usage logs, and AI chat logs are encrypted with AES-256-GCM before they are written under `data/`.
- Decrypted backup download is disabled by default. Set `ALLOW_DECRYPTED_BACKUP_DOWNLOAD=true` only for a short, supervised break-glass recovery window, then turn it off again.
- Do not commit `.env`, `.env.local`, logs, database dumps, generated data folders, private keys, or production backups.

## Secret Handling

- Generate production secrets outside the repo and store them in a secret manager or platform secret store.
- Rotate `JWT_SECRET`, SMTP credentials, `ADMIN_KEY`, and encryption keys after suspected exposure.
- Use `SUPER_ADMIN_PASSWORD` only as a one-time bootstrap value and remove it from the shell/session immediately after use.
- Run `gitleaks detect --source . --config .gitleaks.toml --redact` before pushing changes. The root script `pnpm run secret:scan` wraps the same command when `gitleaks` is installed.

## Operational Controls Needed For Enterprise Grade

- Use a managed database with TLS, encryption at rest, automated backups, point-in-time recovery, and least-privilege app credentials.
- Store encryption keys in KMS/Secret Manager rather than plain environment variables when the hosting platform supports it.
- Ship logs and audit events to a tamper-resistant log store or SIEM.
- Require MFA for admin and super-admin accounts.
- Prefer HTTP-only secure cookies plus CSRF protection for browser sessions in a future auth hardening pass.
- Test backup restore and incident response regularly.
