# Aquarich (Pooledit) — สเปคระบบ (System Specification)

> ระบบจองสระว่ายน้ำ + ศูนย์สุขภาพครบวงจร สำหรับสโมสร Aqua Rich (บางบอน)
> เอกสารนี้สรุป "มีระบบอะไรบ้าง" จากโค้ดจริงในรีโป — อัปเดตล่าสุด 2026-06-29

---

## 1. ภาพรวมสถาปัตยกรรม (Architecture)

Monorepo (pnpm workspaces) 3 ส่วนหลัก:

```
Pooledit-main/
├─ artifacts/
│  ├─ api-server/        # Backend REST API (Express 5)  → พอร์ต 5000
│  ├─ pool-reservation/  # Frontend SPA (React + Vite)   → พอร์ต 5173
│  └─ gemma-chat / AI gateway (Ollama proxy)             → พอร์ต 8787
└─ lib/
   └─ db/               # Schema + migrations (Drizzle ORM) — แชร์ทั้ง backend
```

**Data flow:** Browser → Vite (5173, proxy `/api`) → API (5000) → PostgreSQL (5432)
AI chat: Browser → `/ai` proxy → Gateway (8787) → Ollama (โมเดล Typhoon)

---

## 2. Tech Stack

**Frontend**
- React + TypeScript, **Vite** (build/dev), **Tailwind CSS v4** + shadcn/ui (Radix UI)
- Routing: **wouter** (lazy-loaded routes, code-splitting ~45 หน้า)
- Data: **@tanstack/react-query**
- ไอคอน: **lucide-react** · กราฟ: recharts · QR: html5-qrcode (สแกน) + qrcode.react (สร้าง)
- i18n: ระบบเอง (ไทย/อังกฤษ) · Firebase (ยืนยันเบอร์โทร) · thai-address-database
- PWA: service worker (network-first) + manifest

**Backend**
- **Express 5** + TypeScript, bundle ด้วย esbuild
- ORM: **Drizzle** + PostgreSQL (node-postgres)
- Auth: **JWT** (jsonwebtoken) + **bcryptjs**
- Logging: **pino** · วันที่/เวลา: luxon
- OCR สลิป: **tesseract.js** + jimp + jsqr
- Email: nodemailer (ผ่าน Brevo SMTP)

**ฐานข้อมูล:** PostgreSQL 16 · 32 ตาราง · migrations อัตโนมัติตอนสตาร์ท (idempotent)

---

## 3. บทบาทผู้ใช้ (Roles) & สิทธิ์

ลำดับสิทธิ์ (`user_role` enum):

| Role | คำอธิบาย |
|---|---|
| `member` | สมาชิกทั่วไป — จอง/ซื้อแพ็กเกจ/กระเป๋าเงิน/รีวิว |
| `instructor` | ครูฝึก — ได้สิทธิ์สมาชิกเต็ม + ตารางสอนของตัวเอง |
| `staff` | พนักงาน — ลงเวลา/ลา/ภารกิจ |
| `admin` | แอดมินสาขา — จัดการทุกอย่างในสาขาตัวเอง |
| `super_admin` | เจ้าของแฟรนไชส์ — เห็นทุกสาขา + วิเคราะห์ภาพรวม |
| `dev` | สูงสุด — เห็นทุกเมนู + แผงอัปเดตโค้ด (GitHub patch) |

**Multi-branch (แฟรนไชส์):** ทุกตารางหลักมี `branch_id` · แอดมินถูก scope ด้วย `branchEq` (เห็นเฉพาะสาขาตน) · super_admin/dev เห็นทุกสาขา

---

## 4. ระบบทั้งหมด (Modules)

### 4.1 ระบบสมาชิก & ยืนยันตัวตน (Auth & Members)
- สมัครสมาชิก: **captcha + ยืนยันอีเมลด้วย OTP** (ส่งผ่าน Brevo) ก่อนสร้างบัญชี
- ยืนยันเบอร์โทร (Firebase phone OTP) — optional
- เข้าสู่ระบบด้วย username/email + password (JWT, remember-me 30 วัน)
- **รหัสสมาชิกประจำตัว = เบอร์โทร** (fallback รหัส ART#####)
- โปรไฟล์: อวตาร, น้ำหนัก/ส่วนสูง, ที่อยู่
- ตาราง: `users` · API: `auth/auth.ts`, `auth/users.ts` · lib: `jwt`, `captcha`, `otp`, `mailer`, `phone`, `firebaseToken`, `memberCode`

### 4.2 ระบบจอง (Booking / Reservations)
- จองคาบ/สิ่งอำนวยความสะดวก, ดูที่ว่าง, ปฏิทิน
- กันจองชนกัน, สถานะการจอง
- เช็คอินหน้างาน
- ตาราง: `reservations`, `facilities`, `facility_addons` · API: `booking/reservations.ts`, `booking/facilities.ts`
- หน้า: member `/book`, `/reservations`, `/calendar` · admin `/admin/reservations`

### 4.3 เช็คอิน QR (Check-in)
- สมาชิกมี QR ส่วนตัว (บัตรสมาชิก)
- แอดมินสแกน QR / **ค้นด้วยชื่อจริง / เบอร์ / รหัสสมาชิก** (มีรายชื่อให้เลือก กันหักผิดคน)
- หักสิทธิ์ 1 ครั้งจากคอร์สที่เลือก
- API: `booking/checkin.ts` · lib: `packageUsage`, `usageLog` · หน้า: `/admin/checkin`, `/membership-card`

### 4.4 ระบบแพ็กเกจ & สมาชิกภาพ (Membership Packages)
- แพ็กเกจ/คอร์ส: ราคา, ระยะเวลา, โควต้าจอง/เดือน, ส่วนลดจอง, รูปภาพ
- **หมวดหมู่แพ็กเกจ** (ว่ายน้ำ/แอโรบิค/ฟิตเนส/อื่นๆ) — admin จัดการ, member เห็น badge
- ซื้อด้วยกระเป๋าเงิน, การใช้สิทธิ์ (package_usages), ประวัติเหตุการณ์ (events)
- **ระดับสมาชิก (Loyalty Tiers):** Bronze/Silver/Gold/Diamond auto จากยอดสะสม → ส่วนลดซื้อ 0/5/10/15%
- **แต้มสะสม (Points):** floor(ยอดสะสม/100)
- ตาราง: `membership_packages`, `package_categories`, `member_packages`, `member_addons`, `package_usages`, `member_package_events`
- API: `membership/packages.ts`, `membership/categories.ts` · lib: `memberTier`, `packageUsage`
- หน้า: member `/packages` · admin `/admin/packages`

### 4.5 ระบบคูปองส่วนลด (Coupons) — ใหม่
- โค้ดส่วนลด: เปอร์เซ็นต์/จำนวนเงิน, ยอดขั้นต่ำ, เพดานส่วนลด, จำกัดจำนวนครั้งรวม/ต่อคน, วันหมดอายุ
- ใช้ตอนซื้อแพ็กเกจ (ซ้อนบนส่วนลดระดับสมาชิก), บันทึกการใช้ (redemptions)
- ตาราง: `coupons`, `coupon_redemptions` · API: `membership/coupons.ts` · lib: `coupon` · หน้า: `/admin/coupons`

### 4.6 ระบบรีวิว & เรตติ้ง (Reviews) — ใหม่
- สมาชิกให้ดาว 1–5 + ความเห็น (1 คน 1 รีวิว, แก้ได้)
- แอดมิน moderate: ซ่อน/แสดง/ตอบกลับ/ลบ
- แสดง social proof บนหน้า landing
- ตาราง: `reviews` · API: `support/reviews.ts` · หน้า: `/reviews`, `/admin/reviews`

### 4.7 ระบบการเงิน (Wallet & Top-up)
- กระเป๋าเงินสมาชิก, ประวัติธุรกรรม (transactions)
- เติมเงิน: อัปโหลดสลิป → **OCR อ่านสลิป (tesseract)** + ตรวจชื่อบัญชีผู้รับ/ยอด → auto-approve ถ้าตรง
- PromptPay/QR (บัญชีร้านจาก settings)
- ตาราง: `wallets`, `transactions`, `topup_requests` · API: `finance/wallet.ts`, `finance/topup.ts` · lib: `slipVerify`
- หน้า: member `/wallet`, `/topup` · admin `/admin/wallet`

### 4.8 ร้านค้าสโมสร (Shop)
- สินค้า/ผลิตภัณฑ์, ตะกร้า, คำสั่งซื้อ, สถานะออเดอร์
- ตาราง: `products`, `orders` · API: `shop/products.ts`, `shop/orders.ts`
- หน้า: member `/products`, `/cart`, `/my-orders` · admin `/admin/products`, `/admin/orders`

### 4.9 ครูฝึก & ตารางสอน (Instructors)
- โปรไฟล์ครู, ความเชี่ยวชาญ, ตารางว่าง/ตารางสอน, ผูกกับหมวดหมู่คอส
- ตาราง: `instructors`, `instructor_availability` · API: `booking/instructors.ts`
- หน้า: member `/instructors` · instructor `/instructor/schedule` · admin `/admin/instructors`

### 4.10 บุคลากร (Staff Ops)
- ลงเวลาเข้า-ออก (attendance), คำขอลา (leave), ภารกิจประจำวัน (tasks), วางแผนงาน
- ตาราง: `attendance`, `leave_requests`, `staff_tasks`
- API: `staff/attendance.ts`, `staff/leave.ts`, `staff/tasks.ts`
- หน้า: `/attendance`, `/leave`, `/tasks` · admin `/admin/attendance`, `/admin/leave`, `/admin/work-plan`

### 4.11 สื่อสาร & ช่วยเหลือ (Support)
- แชทสมาชิก-แอดมิน (tickets), ประกาศ (announcements), แจ้งเตือนในแอป (notifications)
- ศูนย์ช่วยเหลือ + dev tickets (แจ้งปัญหาถึงผู้พัฒนา)
- ตาราง: `chat_tickets`, `chat_messages`, `announcements`, `dev_tickets`, `dev_ticket_messages`
- API: `support/chat.ts`, `support/announcements.ts`, `support/notifications.ts`, `support/devSupport.ts`

### 4.12 น้องอควา AI Chat
- ผู้ช่วย AI (Ollama / โมเดล Typhoon) ผ่าน gateway แยก :8787
- เก็บประวัติแชท + วิเคราะห์ (super_admin)
- ตาราง: `ai_chat_messages` · API: `support/aiChat.ts` · lib: `ai-assistant` · หน้า: `/admin/ai-chat`

### 4.13 แดชบอร์ด & รายงาน (Dashboard / Analytics)
- สถิติ: รายได้, การจอง, สมาชิก, ออเดอร์
- ภาพรวมทุกสาขา (super_admin), รายงานการซื้อแพ็กเกจ (CSV/XLSX)
- API: `system/stats.ts` · หน้า: `/admin`, `/admin/overview`, member `/dashboard`

### 4.14 ตั้งค่าระบบ & แฟรนไชส์
- ตั้งค่าร้าน (บัญชีรับเงิน, ฯลฯ), จัดการสาขา, **ธีมสี/ฟอนต์เว็บไซต์** (เปลี่ยนสดผ่าน SSE)
- ตาราง: `settings`, `branches`, `app_theme`
- API: `system/settings.ts`, `system/branches.ts`, `system/theme.ts`
- หน้า: `/admin/settings`, `/admin/branches`, `/admin/theme`

---

## 5. ระบบความปลอดภัย (Security)
- **Rate limiting** — แยก bucket ตาม user ที่ล็อกอิน (กัน 429 รวมกันหลังตู้เน็ตเดียว)
- CORS allowlist, security headers (Helmet-style), intrusion guard, no-store สำหรับ route อ่อนไหว
- Captcha (SVG เอง) + Email OTP กันบอตสมัคร
- JWT + bcrypt, cookie-parser
- **เข้ารหัสข้อมูล** (`cryptoVault`, `DATA_ENCRYPTION_KEY`)
- **บันทึกความปลอดภัย (Audit logs)** — ตาราง `audit_logs`, หน้า `/admin/audit-logs`
- lib: `security` (middleware), `audit`, `cryptoVault`, `captcha`, `otp`

---

## 6. ระบบโครงสร้างพื้นฐาน (Infra / DevOps)
- **Auto-migrate** ตอนสตาร์ท API — รัน `lib/db/migrations/*.sql` (idempotent, ติดตามใน `_migrations`)
- **สำรองข้อมูล** เข้ารหัส (`backup`, `BACKUP_ENCRYPTION_KEY`), backup รายวัน (scheduled)
- **Health check** (`system/health.ts`)
- **แผงอัปเดตโค้ด in-app** (`/admin/update`, role dev) — pull/push patch ผ่าน GitHub (`lib/git.ts`)
- Workflow: แก้บนเครื่อง dev → push GitHub → server pull → restart (auto-migrate + rebuild)

---

## 7. โครงสร้างฐานข้อมูล (32 ตาราง)

**สมาชิก/สิทธิ์:** users · **จอง:** reservations, facilities, facility_addons ·
**แพ็กเกจ:** membership_packages, package_categories, member_packages, member_addons, package_usages, member_package_events ·
**คูปอง:** coupons, coupon_redemptions · **รีวิว:** reviews ·
**การเงิน:** wallets, transactions, topup_requests · **ร้านค้า:** products, orders ·
**ครู:** instructors, instructor_availability · **บุคลากร:** attendance, leave_requests, staff_tasks ·
**สื่อสาร:** chat_tickets, chat_messages, announcements, dev_tickets, dev_ticket_messages, ai_chat_messages ·
**ระบบ:** settings, branches, app_theme, audit_logs

Migrations: `0001`–`0012` (instructor availability, addons, events, audit, package image, dev role,
availability-package, slip verify, auto-approve, **package categories**, **reviews**, **coupons**)

---

## 8. ธีม & ดีไซน์
- Design tokens (CSS variables) light/dark — โทน **navy น้ำเงินเข้ม (trust) + gold accent (luxury)**
- ฟอนต์: Plus Jakarta Sans (เนื้อหา) + Sora (หัวข้อ) + Noto Sans Thai
- ธีมสี/ฟอนต์เปลี่ยนได้สดจากหน้าแอดมิน (เก็บใน `app_theme`, broadcast ผ่าน SSE)
- เอฟเฟกต์: glassmorphism, gradient, glow, card-lift, ambient background, skeleton loading
- PWA, responsive, accessibility (skip-link, focus ring, reduced-motion), ErrorBoundary
