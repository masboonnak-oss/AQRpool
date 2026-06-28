type NodeEnv = "development" | "test" | "production";

type EnvValidation = {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  logLevel: string;
  corsOrigins: string[];
  frontendOrigins: string[];
  dataDir?: string;
  jwtSecret?: string;
  dataEncryptionKey?: string;
  backupEncryptionKey?: string;
  smtp: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    from?: string;
    fromName: string;
  };
  backup: {
    hour: number;
    keep: number;
  };
  ai: {
    enabled: boolean;
    ollamaUrl: string;
    model: string;
  };
  slipVerify: {
    ocrLang: string;
    ocrLangPath?: string;
    merchantName?: string;
    merchantNumber?: string;
  };
  firebaseProjectId?: string;
  n2TicketUrl?: string;
};

const VALID_NODE_ENVS = new Set(["development", "test", "production"]);

function readNodeEnv(): NodeEnv {
  const raw = process.env.NODE_ENV || "development";
  if (VALID_NODE_ENVS.has(raw)) return raw as NodeEnv;
  throw new Error(`NODE_ENV must be one of development, test, or production. Received "${raw}".`);
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function required(name: string): string {
  const value = trimOptional(process.env[name]);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseInteger(name: string, fallback: number, options: { min?: number; max?: number } = {}): number {
  const raw = trimOptional(process.env[name]);
  const value = raw == null ? fallback : Number(raw);

  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer. Received "${raw}".`);
  }
  if (options.min != null && value < options.min) {
    throw new Error(`${name} must be >= ${options.min}. Received ${value}.`);
  }
  if (options.max != null && value > options.max) {
    throw new Error(`${name} must be <= ${options.max}. Received ${value}.`);
  }

  return value;
}

function parseBoolean(name: string, fallback = false): boolean {
  const raw = trimOptional(process.env[name]);
  if (raw == null) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be "true" or "false". Received "${raw}".`);
}

function parseList(name: string): string[] {
  return (process.env[name] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertUrlLike(name: string, value: string | undefined, requiredInProduction = false): string | undefined {
  if (!value) {
    if (requiredInProduction && process.env.NODE_ENV === "production") {
      throw new Error(`${name} is required in production`);
    }
    return undefined;
  }

  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`${name} must be a valid URL. Received "${value}".`);
  }
}

function validateProductionSecrets(isProduction: boolean): void {
  if (!isProduction) return;

  required("JWT_SECRET");

  if (!trimOptional(process.env.DATA_ENCRYPTION_KEY) && !trimOptional(process.env.BACKUP_ENCRYPTION_KEY)) {
    throw new Error("DATA_ENCRYPTION_KEY or BACKUP_ENCRYPTION_KEY is required in production");
  }
}

function loadEnv(): EnvValidation {
  const nodeEnv = readNodeEnv();
  const isProduction = nodeEnv === "production";
  validateProductionSecrets(isProduction);

  return {
    nodeEnv,
    isProduction,
    port: parseInteger("PORT", 5000, { min: 1, max: 65535 }),
    databaseUrl: required("DATABASE_URL"),
    logLevel: process.env.LOG_LEVEL || "info",
    corsOrigins: parseList("CORS_ORIGINS"),
    frontendOrigins: parseList("FRONTEND_ORIGINS"),
    dataDir: trimOptional(process.env.DATA_DIR),
    jwtSecret: trimOptional(process.env.JWT_SECRET),
    dataEncryptionKey: trimOptional(process.env.DATA_ENCRYPTION_KEY),
    backupEncryptionKey: trimOptional(process.env.BACKUP_ENCRYPTION_KEY),
    smtp: {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInteger("SMTP_PORT", 465, { min: 1, max: 65535 }),
      user: trimOptional(process.env.SMTP_USER),
      pass: trimOptional(process.env.SMTP_PASS),
      from: trimOptional(process.env.SMTP_FROM),
      fromName: process.env.SMTP_FROM_NAME || "Aquarich",
    },
    backup: {
      hour: parseInteger("BACKUP_HOUR", 2, { min: 0, max: 23 }),
      keep: parseInteger("BACKUP_KEEP", 30, { min: 1 }),
    },
    ai: {
      enabled: parseBoolean("AI_CHAT_ENABLED", false),
      ollamaUrl: assertUrlLike("OLLAMA_URL", trimOptional(process.env.OLLAMA_URL)) || "http://127.0.0.1:11434",
      model: process.env.AI_MODEL || "scb10x/typhoon2.5-qwen3-4b",
    },
    slipVerify: {
      ocrLang: process.env.OCR_LANG || "tha+eng",
      ocrLangPath: trimOptional(process.env.OCR_LANG_PATH) || trimOptional(process.env.TESSDATA_PREFIX),
      merchantName: trimOptional(process.env.MERCHANT_ACCOUNT_NAME),
      merchantNumber: trimOptional(process.env.MERCHANT_ACCOUNT_NUMBER),
    },
    firebaseProjectId: trimOptional(process.env.FIREBASE_PROJECT_ID),
    n2TicketUrl: assertUrlLike("N2_TICKET_URL", trimOptional(process.env.N2_TICKET_URL)),
  };
}

export const apiEnv = loadEnv();
