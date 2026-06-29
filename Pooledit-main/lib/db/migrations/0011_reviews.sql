-- Member reviews / ratings of the club (social proof). One row per member; admins
-- can hide a review (is_published=false) or post a public reply.
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL,
  "comment" text,
  "reply" text,
  "is_published" boolean NOT NULL DEFAULT true,
  "branch_id" integer DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "reviews_user_id_idx" ON "reviews" ("user_id");
CREATE INDEX IF NOT EXISTS "reviews_published_idx" ON "reviews" ("is_published");
