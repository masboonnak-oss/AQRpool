import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "*.authorization",
    "*.cookie",
    "*.password",
    "*.passwordHash",
    "*.currentPassword",
    "*.newPassword",
    "*.confirmPassword",
    "*.otp",
    "*.token",
    "*.jwt",
    "*.secret",
    "*.apiKey",
    "*.adminKey",
    "*.smtpPass",
    "*.SMTP_PASS",
    "*.JWT_SECRET",
    "*.DATA_ENCRYPTION_KEY",
    "*.BACKUP_ENCRYPTION_KEY",
    "err.config.headers.Authorization",
    "err.request.headers.authorization",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
