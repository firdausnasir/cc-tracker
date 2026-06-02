-- Creates Card and Statement in their final shape (card billing schedule on the
-- Card, currency on the Card, none on the Statement). Written as plain CREATE
-- TABLEs rather than a table rebuild so a fresh apply never DROPs data. Already
-- applied on existing databases (D1 tracks migrations by filename), so editing
-- this content only affects newly-provisioned databases.

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "last4" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "statementDay" INTEGER NOT NULL,
    "paymentDay" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardId" TEXT NOT NULL,
    "statementDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amountDue" BIGINT NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Statement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Card_userId_idx" ON "Card"("userId");

-- CreateIndex
CREATE INDEX "Statement_cardId_idx" ON "Statement"("cardId");

-- CreateIndex
CREATE INDEX "Statement_dueDate_idx" ON "Statement"("dueDate");
