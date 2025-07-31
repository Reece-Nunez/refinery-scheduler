/*
  Warnings:

  - Added the required column `team` to the `Operator` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'OPER');

-- CreateEnum
CREATE TYPE "public"."Team" AS ENUM ('A', 'B', 'C', 'D');

-- AlterTable
ALTER TABLE "public"."Operator" ADD COLUMN     "team" "public"."Team" NOT NULL;

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'OPER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_OperatorJobs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OperatorJobs_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "public"."users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_title_key" ON "public"."Job"("title");

-- CreateIndex
CREATE INDEX "_OperatorJobs_B_index" ON "public"."_OperatorJobs"("B");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Operator"("employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OperatorJobs" ADD CONSTRAINT "_OperatorJobs_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OperatorJobs" ADD CONSTRAINT "_OperatorJobs_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Operator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
