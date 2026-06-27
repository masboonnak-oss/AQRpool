import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// "dev" is the highest role — a superset of super_admin. It passes every gate.
export function isDevRole(role?: string): boolean {
  return role === "dev";
}

// admin, super_admin and dev all have administrative privileges.
export function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "super_admin" || role === "dev";
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: admin only" });
  }
  return next();
}

// super_admin gates also admit dev (dev is a superset of super_admin).
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== "super_admin" && req.user.role !== "dev")) {
    return res.status(403).json({ error: "Forbidden: super admin only" });
  }
  return next();
}

// Developer-only gate (e.g. the GitHub patch panel).
export function requireDev(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isDevRole(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: developer only" });
  }
  return next();
}

// Staff = anyone who works here (admins + instructors + employees). Used by the attendance system.
export function isStaffRole(role?: string): boolean {
  return role === "admin" || role === "super_admin" || role === "dev" || role === "instructor" || role === "staff";
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isStaffRole(req.user.role)) {
    return res.status(403).json({ error: "Forbidden: staff only" });
  }
  return next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
  } catch {
    // ignore invalid token
  }
  next();
}
