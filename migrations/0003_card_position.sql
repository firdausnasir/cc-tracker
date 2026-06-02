-- Migration number: 0003 	 2026-06-02T03:43:42.448Z

-- Adds Card.position for manual drag-drop sort order. Additive column with a
-- DEFAULT so the apply never rebuilds the table or risks data. Existing rows
-- are backfilled per-user in createdAt order, preserving the current visual
-- order (which was createdAt-asc before this migration).

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill: position = count of the same user's cards created earlier, so each
-- user's existing list keeps its createdAt order (0-based, ties by rowid).
UPDATE "Card"
SET "position" = (
    SELECT COUNT(*)
    FROM "Card" AS earlier
    WHERE earlier."userId" = "Card"."userId"
      AND (
        earlier."createdAt" < "Card"."createdAt"
        OR (earlier."createdAt" = "Card"."createdAt" AND earlier."rowid" < "Card"."rowid")
      )
);
