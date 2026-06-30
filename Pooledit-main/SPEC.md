# สเปคระบบ — Aquarich / Pooledit (ระบบจองสระว่ายน้ำ & บริหารคลับ)

> เอกสารนี้สรุปสเปคของ "ทุกระบบ" ในเว็บแอป โดยอ้างอิงจากโค้ดจริง (API routes, DB schema, หน้า UI)
> รันที่ frontend `http://localhost:5173` → proxy `/api` → API server `:5000` → PostgreSQL `:5432`

---

## 0. ภาพรวมสถาปัตยกรรม (Architecture Overview)

### Tech Stack
| ชั้น | เทคโนโลยี |
|------|-----------|
| **Frontend** | React + Vite 7, TypeScript, Wouter (routing), TanStack Query, Tailwind, Radix UI, react-hook-form + zod |
| **Backend** | Node.js + Express 5, TypeScript (build ด้วย esbuild → `dist/index.mjs`) |
| **Database** | PostgreSQL + Drizzle ORM (drizzle-kit migrations) — ~30 ตาราง |
| **Auth** | JWT (HS256) Bearer token, bcryptjs (salt round 12) |
| **AI** | Ollama (self-hosted) รุ่น `scb10x/typhoon2.5-qwen3-4b` |
| **Slip OCR** | tesseract.js (tha+eng) + jsQR (อ่าน QR สลิป) |
| **OTP/Email** | SMTP (nodemailer-style), Firebase Phone Auth (ออปชัน) |
| **Security** | AES-256-GCM data/backup vault, rate-limit, CORS, security headers, audit log |
| **Logging** | pino / pino-http |

### โครงสร้าง Monorepo
```
Pooledit-main/
├── artifacts/api-server/        # Express API (:5000)
│   └── src/routes/{auth,booking,membership,finance,shop,staff,support,system}
├── artifacts/pool-reservation/  # React SPA (Vite :5173)
│   └── src/pages/{member,admin,instructor,staff}
└── lib/db/src/schema/           # Drizzle schema (canonical) — 30+ ตาราง
```

### Middleware Pipeline (API)
`pino-http` → `securityHeaders` → `cors` → `intrusionGuard` → `noStoreForSensitiveRoutes` →
rate-limit (240 req/นาที ทุก method, 80 req/นาที เฉพาะ write) → `express.json` (12mb สำหรับสลิป/รูป base64) →
`auditRequests` → `/api` router → error handler (ข้อความ error เป็นภาษาไทย)

ตอนบูต: `ensureDataDirs` → `ensureBackupFolder` → `assertDataEncryptionReady` → `runMigrations` (auto-migrate).

---

## 1. ระบบสิทธิ์และบทบาท (Roles & RBAC)

PostgreSQL enum `user_role` มี 6 ระดับ (เรียงจากสูงไปต่ำ):

| Role | คำอธิบาย | ขอบเขต |
|------|----------|--------|
| **dev** | นักพัฒนา/เจ้าของ (สูงสุด, superset ของ super_admin) | เห็นทุกเมนู + แผง Git pull/push |
| **super_admin** | ผู้ดูแลสูงสุด | ข้ามทุกสาขา, theme, audit, backup, ตอบ dev-ticket |
| **admin** | ผู้ดูแลสาขา | จัดการเฉพาะสาขาตัวเอง (branch-scoped) |
| **instructor** | ครูฝึก | ได้สิทธิ์ member เต็ม + ตารางสอน/คิวจอง |
| **staff** | พนักงาน | ลงเวลา, งานที่ได้รับมอบหมาย, เช็คอิน (ไม่มี member dashboard) |
| **member** | สมาชิก | จอง, กระเป๋าเงิน, แพ็กเกจ, ร้านค้า, แชต |

**Helper บนเซิร์ฟเวอร์:** `isAdminRole` = admin/super_admin/dev · `isStaffRole` = +instructor/staff · `requireSuperAdmin`/`requireDev` แยกระดับ
**Middleware:** `authenticate` (บังคับ token), `optionalAuth`, `attachBranch` (เซต `req.branchId`), `branchEq()` (super_admin = ไม่กรอง, admin = กรองตามสาขา)

---

## 2. ระบบยืนยันตัวตน & ผู้ใช้ (Auth & Users)

### ตาราง `users`
`id, firstName, lastName, houseNumber, weight, height, phone, phoneE164(unique), phoneVerified, email(unique), username(unique), passwordHash, role, checkinToken(unique, ใช้ทำ QR), profileImageUrl, createdAt, branchId`
- **Member code:** สร้างจาก id → `ART` + เลข 5 หลัก (เช่น ART00001)

### Endpoints
| Method/Path | Role | หมายเหตุ |
|-------------|------|----------|
| `POST /auth/register/send-otp` | public | ตรวจ CAPTCHA + ความซ้ำ email/username → ส่ง OTP 6 หลัก (อายุ 10 นาที), rate-limit 5/15นาที |
| `POST /auth/register` | public | ตรวจ OTP (ผิด 3 ครั้งล็อก) → normalize เบอร์เป็น E.164 → bcrypt → ออก JWT |
| `POST /auth/login` | public | รับ username/email/phone, bcrypt compare, fail = sleep 350ms, rate-limit 10/15นาที, rememberMe → token 30 วัน |
| `GET /auth/me` | auth | โปรไฟล์ปัจจุบัน |
| `POST /auth/change-password` | auth | ตรวจรหัสเดิม → ใหม่ ≥ 6 ตัว |
| `GET /users` | admin | รายชื่อ + pagination + search + enrich (tier, package, points) |
| `GET /users/report` | admin | รายงาน CSV (range day/week/month/all) |
| `GET/PATCH /users/:id` | self หรือ admin | แก้ไข role/profileImage ได้เฉพาะ admin |
| `POST /users` | admin | เพิ่มสมาชิก (default password "changeme123") |
| `POST /users/:id/reset-password` | admin | รีเซ็ตรหัส |
| `DELETE /users/:id` | admin | ลบสมาชิก |
| `GET /users/me/stats` | auth | สถิติการมาใช้บริการ (visits, minutes) |

### JWT
HS256, payload `{ userId, username, role, iat, exp }`, TTL 7 วัน (หรือ 30 วันถ้า rememberMe), secret = `JWT_SECRET` (บังคับใน production)

### Loyalty Tier (คำนวณสด ไม่มีตารางแยก)
จาก lifetime spend = `SUM(member_packages.pricePaid)` ที่ไม่ cancelled → Bronze/Silver/Gold/Diamond → ให้ % ส่วนลด; **points** = floor(spend/100)

---

## 3. ระบบการจอง (Booking / Reservations)

### ตารางหลัก
- **`facilities`** — สถานที่/สระ: `capacity, openTime, closeTime, slotDurationMinutes, isActive, isPurchasable, price, lanes, depth, amenities, branchId` (รองรับ 2 ภาษา)
- **`reservations`** — `userId, date, startTime, endTime, numberOfPeople, instructorId?, memberPackageId?, price, status(pending|confirmed|cancelled|maintenance), notes, branchId`
- **`instructors`** — โปรไฟล์ครู: `specialty, certification, experience, status(active|on_leave|inactive), userId?`
- **`instructor_availability`** — `kind(weekly|date), dayOfWeek?, date?, startTime, endTime, maxPeople, isAvailable, packageId?(ปักคอร์ส)`

### Slot & เวลา
สร้าง slot จาก settings สาขา: `openTime..closeTime` แบ่งช่วงละ `slotDurationMinutes`. ใช้ Asia/Bangkok. จองล่วงหน้าได้ไม่เกิน `maxAdvanceDays`, ห้ามจองอดีต.
**Overlap:** ช่วง A,B ชนกันเมื่อ `s1 < e2 AND e1 > s2`

### Flow การจอง (`POST /reservations`)
1. ตรวจรูปแบบเวลา + ต้องตรงขอบ slot + `bookingEnabled` & ไม่อยู่ใน `maintenanceMode`
2. **Capacity:** ไม่มีครู → เช็ค `currentPeople + numberOfPeople ≤ maxPeoplePerSlot`; มีครู → เช็ค `instructor_availability` ครอบคลุม + capacity ของครู
3. **Package/Quota:** ดึง active packages; ถ้ามีครูที่ปัก `packageId` → ต้องมีแพ็กเกจ package เดียวกันหรือ **category เดียวกัน**; ถ้าไม่มีครู → ต้องส่ง `memberPackageId` ที่ยังมีโควต้า
4. สร้าง reservation (status = `bookingAutoConfirm ? confirmed : pending`) แล้ว **หักโควต้าทันที** ใน transaction (`consumeUse`)
5. Side effects: อีเมลแจ้งครู (ถ้า confirmed), usage log, member activity log

### Endpoints
| Method/Path | Role | หมายเหตุ |
|-------------|------|----------|
| `GET /reservations/available-slots?date=` | member | สถานะ slot + currentPeople/maxPeople |
| `POST /reservations` | member | สร้างจอง (หักโควต้า) |
| `GET /reservations/my` | member | การจองของฉัน |
| `DELETE /reservations/:id` | member (เฉพาะ pending) / admin | ยกเลิก → **คืนโควต้า** |
| `GET /reservations` | admin | list + filter (date/status/userId) + pagination |
| `PATCH /reservations/:id` | admin | เปลี่ยนสถานะ/ครู/จำนวนคน (lock FOR UPDATE; pending→confirmed หักโควต้า, →cancelled คืน) |
| `GET/POST/PATCH/DELETE /facilities[...]` | public read / admin write | DELETE = soft delete (isActive=false) |
| `POST /facilities/:id/purchase` | member | ซื้อ add-on หักจาก wallet |
| `GET /instructors/teaching?date=` | member | slot สอนของครูในวันนั้น |
| `GET/POST/PATCH/DELETE /instructors/me/availability` | instructor | ตารางว่างของตัวเอง |
| `POST /instructors/:id/availability` | admin | ตั้งตาราง (ตั้ง maxPeople + packageId ได้) |

### กฎสำคัญ
- หักโควต้าตอนสร้าง, คืนตอนยกเลิก, กัน double-deduct ด้วย `memberPackageId` guard
- member ยกเลิกเองได้เฉพาะ `pending`; `confirmed` ต้องให้ admin

---

## 4. ระบบเช็คอิน (Check-in / QR)

- **`GET /checkin/my-code`** (member) → token สำหรับ QR
- **`POST /checkin`** (admin) → สแกน QR/token, หรือค้นเบอร์/รหัสสมาชิก → `consumeUse` (เลือก package อัตโนมัติหากไม่ระบุ)
- **`GET /checkin/search?q=`** (admin) → ค้นชื่อ/เบอร์/รหัส
- **`GET /checkin/lookup?token=|memberId=`** (admin) → preview โควต้าก่อนยืนยัน
- `package_usages.source` แยก `booking` vs `checkin` ใช้คำนวณสถิติ

---

## 5. ระบบแพ็กเกจสมาชิก & คูปอง (Membership & Coupons)

### ตาราง
- **`membership_packages`** — `name, price, durationDays, maxBookingsPerMonth(null=ไม่จำกัด), bookingDiscount%, benefits, categoryId?, isActive, sortOrder, branchId`
- **`member_packages`** — การถือครอง: `userId, packageId, pricePaid, bookingsUsed, status(active|expired|cancelled), startDate, endDate`
- **`package_categories`** — หมวดคอร์ส (ว่ายน้ำ/แอโรบิค/…); ลบหมวด → set `categoryId=null`
- **`package_usages`** — log การใช้โควต้า · **`member_package_events`** — audit admin actions · **`coupons`** / **`coupon_redemptions`**

### ซื้อแพ็กเกจ (`POST /packages/:id/purchase`)
ลำดับราคา: `listPrice` → หัก **tier discount** (จาก lifetime spend) = `tierPrice` → หัก **coupon** → `finalPrice = max(0, …)` → ตรวจ wallet พอ → หัก wallet + INSERT transaction(`package_purchase`) + สร้าง `member_packages` + บันทึก redemption
- **จ่ายด้วย wallet เท่านั้น** (ต้อง top-up ก่อน)

### Repurchase & Stacking
- ซื้อซ้ำได้ไม่จำกัด → สร้าง record ใหม่ (ไม่ทับเก่า), endDate = now + durationDays
- รองรับหลาย active package พร้อมกัน; `totalRemaining` = ผลรวมโควต้า; หักจาก **soonest-expiring ก่อน (FIFO)**

### คูปอง
- `discountType: percent|fixed`, `maxDiscount`(เพดาน %), `minPurchase`, `usageLimit`(รวม), `perUserLimit`(default 1), `expiresAt`, `isActive`
- `POST /coupons/validate` (member preview) · CRUD `/coupons` (admin)

### Endpoints แพ็กเกจ
`GET /packages/public` (no auth) · `GET /packages` · `GET /packages/my` · `GET /packages/my-usage` (โควต้า+tier+benefits) ·
admin: `GET /packages/all`, `POST/PATCH/DELETE /packages`, `GET /packages/admin/member/:userId[/history]`, `POST /packages/admin/assign`, `PATCH /packages/admin/member-packages/:id`, `GET /packages/admin/purchase-report`
- ลบ package ที่มีคนซื้อแล้วไม่ได้ (FK) → ให้ใช้ `isActive=false`

---

## 6. ระบบการเงิน & ร้านค้า (Finance & Shop)

### ตาราง
- **`wallets`** — `userId(unique), balance numeric(12,2), branchId` (ห้ามติดลบ)
- **`transactions`** — `type: topup|booking_payment|booking_refund|package_purchase|admin_credit|admin_debit`, `status, referenceId, branchId`
- **`topup_requests`** — `amount, method, slipImageUrl, status(pending|approved|rejected)` + ฟิลด์ตรวจสลิปอัตโนมัติ `slipRef, slipAmount, slipBank, slipRecipientMatch, slipVerdict(match|review|duplicate|unread), slipWarnings[], slipCheckedAt`
- **`products`** — `name, price, stock(null=ไม่จำกัด), isActive, sortOrder, branchId`
- **`orders`** — `items(JSON snapshot), subtotal, status(pending|paid|shipped|cancelled)`, ที่อยู่จัดส่งครบ, `slipImageUrl, trackingNo, paidAt, shippedAt`

### Top-up Flow
1. member `POST /topup` (แนบสลิป base64) → เก็บสลิปเข้ารหัสใน `data/slips/`
2. ระบบตรวจสลิปอัตโนมัติ (QR + OCR): เทียบยอด, เทียบชื่อผู้รับกับบัญชีร้าน (`settings.bankAccountName/Number`), เช็คสลิปซ้ำ
3. ถ้า `topupAutoApprove=true` และ verdict=`match` → อนุมัติเอง; ไม่งั้นรอ admin `POST /topup/:id/approve|reject`
4. อนุมัติ → `wallet.balance += amount` + INSERT transaction(`topup`)

### Shop Flow
- `POST /orders`: ตรวจสต็อก, หักสต็อก atomic (`GREATEST(stock-qty,0)`), แนบสลิป → status `paid` ทันที + log ลง `data/sales/sales-YYYY-MM.jsonl`
- admin `PATCH /orders/:id`: pending→paid→shipped(+trackingNo) หรือ cancelled (คืนสต็อก)
- รายงาน: `GET /orders/admin/revenue` (วันนี้/เดือน/รวม + top products), `GET /orders/admin/pending-count`

### Wallet Endpoints
`GET /wallet/me` · `GET /wallet/transactions` · `GET /wallet/all` (admin) · `POST /wallet/admin-adjust` (admin: +/- พร้อมบันทึก admin_credit/debit, ห้ามทำให้ติดลบ, branch-scoped)

---

## 7. ระบบงานพนักงาน (Staff Operations)

### ลงเวลา (`attendance`)
`userId, workDate, clockIn, clockOut?, workedMinutes?, method(web|qr|manual), note, branchId` (Asia/Bangkok)
- self: `POST /attendance/clock-in` (กันลงซ้ำถ้ายังมี shift เปิด), `POST /attendance/clock-out`, `GET /attendance/me` (today/month minutes)
- admin: `GET /attendance/on-duty`, `GET /attendance/report?from&to&userId`, `POST /attendance/manual`, `PATCH/DELETE /attendance/:id`

### ใบลา (`leave_requests`)
`type(sick|personal|vacation|other), startDate, endDate, days(inclusive), reason, status(pending|approved|rejected), reviewedBy, reviewNote`
- self: `POST /leave`, `GET /leave/me`, `DELETE` (เฉพาะ pending ของตัวเอง)
- admin: `GET /leave?status`, `GET /leave/pending-count`, `PATCH /leave/:id` (อนุมัติ/ปฏิเสธ)

### งานที่มอบหมาย (`staff_tasks`)
`title, description, taskDate, assignedTo, status(assigned|accepted|in_progress|completed|cancelled)` + รูป before/after (data URL ≤ ~5.5MB) + `completionNote`
- self: `GET /tasks/me`, `POST /tasks/:id/accept|start(แนบรูป)|complete(แนบรูป+โน้ต)`
- admin: `GET/POST/PATCH/DELETE /tasks` (มอบหมายให้ staff role)

### ตารางสอนครู (`instructor_availability`)
- self: CRUD `/instructors/me/availability`, `GET /instructors/me/bookings` (poll 30วิ), `PATCH /instructors/me/bookings/:id` (ยืนยัน/เลื่อน/ยกเลิก → หัก/คืนโควต้า), `GET /instructors/me/stats`

---

## 8. ระบบสนับสนุน (Support)

### Live Chat (`chat_tickets` / `chat_messages`)
- member: `POST /chat/tickets`, `POST /chat/tickets/:id/messages` (ข้อความ/รูป) → trigger AI auto-reply
- admin: `GET /chat/tickets`, `PATCH /chat/tickets/:id` (สถานะ/มอบหมาย), `GET /chat/unread`
- สถานะ: open → in_progress → resolved/closed

### AI Assistant "น้องอควา" (`ai_chat_messages`)
- **Provider: Ollama (self-hosted), model `scb10x/typhoon2.5-qwen3-4b`**, เปิดด้วย `AI_CHAT_ENABLED=true`
- ตอบภาษาไทย (สุภาพ, ลงท้าย "ค่ะ"), **read-only** ใช้ข้อมูลจริงจากระบบ (การจอง/wallet/แพ็กเกจ/เวลาเปิด), ทำรายการแทนไม่ได้
- มี **escalation**: เจอคำว่า "เจ้าหน้าที่/ร้องเรียน/human" → โอนให้คน, หยุดตอบ; หยุดตอบเมื่อมีพนักงานเข้า ticket
- params: temp 0.4, top_p 0.9, ctx 8192. super_admin: `GET /ai-chat/analytics`, `/conversation/:userId`

### Announcements (`announcements`)
2 ภาษา, `type(info|warning|success|maintenance), isPublished, isPinned, expiresAt`. public `GET /announcements`; admin CRUD `/announcements`

### Notifications (รวม feed, ไม่มีตารางใหม่)
รวมจาก announcements/reservations/topups/chat/orders แบบ query-time. `GET /notifications` (poll) + `GET /notifications/stream` (SSE ping 15วิ). pinned ก่อน, ใหม่สุดก่อน, max 40

### Reviews (`reviews`)
1 รีวิว/สมาชิก (rating 1-5 + comment). public `GET /reviews` (ชื่อ mask "สมชาย ส.", average+count). admin: `GET /reviews/all`, `PATCH` (ซ่อน/ตอบ public), `DELETE`. แก้รีวิว = reset moderation

### Dev Support (`dev_tickets` / `dev_ticket_messages`)
admin เปิด ticket หา DEV team (super_admin=DEV). `type, priority(normal|high|critical)`. มิเรอร์ไป **N2 (Sovereign OS)** ผ่าน `N2_TICKET_URL` (fire-and-forget). เฉพาะ super_admin เปลี่ยน priority ได้

---

## 9. ระบบบริหารระบบ (System Administration)

### Settings (`settings`, ต่อสาขา)
`bookingEnabled, openTime, closeTime, maxPeoplePerSlot, maxAdvanceDays, slotDurationMinutes, maintenanceMode, maintenanceMessage, bookingPricePerSession, bookingAutoConfirm, lineUrl, contactPhone/Email, bankAccountName/Number, bankName, promptpayNumber, topupAutoApprove`
- `GET /settings` (auth) · `PATCH /settings` (admin, branch-scoped)

### Multi-Branch (`branches`)
franchise: `name, code(unique), address, ownerName, isMain, isActive`. super_admin CRUD `/branches` (+ memberCount); ลบสาขาไม่ได้ถ้า isMain หรือยังมีสมาชิก. ทุกตารางหลักมี `branchId`

### Theme (`app_theme`, 1 แถว)
`color{h,s,l}, font?, logoUrl?(dev-only ≤2.5MB), version`. public `GET /theme` + `GET /theme/stream` (SSE ping 2วิ). admin `PATCH /theme` → เพิ่ม version + broadcast

### Audit Logs (`audit_logs`, super_admin)
immutable. `GET /audit-logs` + filter (search/action/method/status/from/to) + pagination. เก็บ actor, action, method, path, statusCode, ip, userAgent, target, metadata

### In-App Update (Git, dev-only)
`GET /update/folders|status` · `POST /update/set-remote(ล็อก repo AQRpool)|push(auto-commit+push)|pull(FF-only)`

### Stats / Dashboard
- public: `GET /stats/public` (members/instructors/facilities/packages/reservations)
- admin: `GET /stats/admin` (branch), `GET /stats/branches` (cross-branch + revenue), `GET /stats/monthly`, `GET /stats/top-users`, `GET /stats/sales` (รวม package + shop)
- member: `GET /stats/member`

### Backup (AES-256-GCM, super_admin)
`POST /backup/run-full`, `GET /backup/full|users|usage-logs[...]`, `POST /backup/users/restore` (upsert). ดาวน์โหลดแบบถอดรหัสต้องเปิด env `ALLOW_DECRYPTED_BACKUP_DOWNLOAD` (break-glass)

---

## 10. Routing & หน้าจอ (Frontend)

- **Routing:** Wouter + lazy load, `ProtectedRoute` (adminOnly/devOnly/instructorOnly/staffOnly). หน้าแรกตาม role: admin→`/admin`, staff→`/attendance`, member→`/dashboard`
- **Providers:** Auth, Cart, Language (i18n ไทย/อังกฤษ), Theme, ThemeColor, TanStack Query (staleTime 30s)
- **Member pages:** dashboard, book, calendar, reservations, instructors, membership-card, profile, wallet, topup, packages, products, cart, my-orders, chat, reviews
- **Staff/Instructor:** attendance, leave, tasks, instructor/schedule
- **Admin pages (~30):** dashboard, overview, members, reservations, facilities, instructors, checkin-scan, packages-management, coupons, products, orders, sales, wallet-management, announcements, reviews, ai-chat, chat, attendance, leave, work-plan, branches, theme, settings, audit-logs, help-center, update (dev)

---

## 11. มาตรฐาน Error & ความปลอดภัย

| Code | ความหมาย |
|------|----------|
| 400 | validation ผิด / โควต้าหมด |
| 401 | ไม่ได้ login / token หมดอายุ |
| 403 | role ไม่พอ |
| 404 | ไม่พบ |
| 409 | ขัดแย้ง (เต็ม/ครูไม่ว่าง/ลบไม่ได้) |
| 429 | เกิน rate-limit |
| 500 | error ระบบ |

**ความปลอดภัย:** CAPTCHA, rate-limit (login/OTP), bcrypt round 12, timing-attack mitigation, JWT secret บังคับ production, AES-256-GCM vault สำหรับสลิป/backup, audit log ทุก action สำคัญ, branch isolation, slip duplicate detection. ข้อความ error ทั้งหมดเป็นภาษาไทย
