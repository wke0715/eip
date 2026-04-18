-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('LEAVE', 'EXPENSE', 'OTHER_EXPENSE', 'OVERTIME');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalResult" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('A', 'C', 'T', 'M', 'S');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "OtherExpenseKind" AS ENUM ('H', 'O');

-- CreateEnum
CREATE TYPE "OvertimeDayType" AS ENUM ('REST_DAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('CONFIRMED', 'TENTATIVE', 'COMPLETED', 'HOLIDAY');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "usedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MeetingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingBooking" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "bookerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowConfig" (
    "id" TEXT NOT NULL,
    "formType" "FormType" NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverRole" TEXT NOT NULL,

    CONSTRAINT "WorkflowConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formType" "FormType" NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "cancelledByApplicant" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "stepOrder" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" "ApprovalResult",
    "comment" TEXT,
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmtpConfig" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "encryption" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmtpConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseReport" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReceipts" INTEGER NOT NULL DEFAULT 0,
    "attachmentUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseReportItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "workCategory" TEXT NOT NULL,
    "workDetail" TEXT NOT NULL,
    "mileageSubsidy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parkingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etcFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gasFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transportType" "TransportType",
    "transportAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mealType" "MealType",
    "mealAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherKind" "OtherExpenseKind",
    "otherName" TEXT,
    "otherAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receipts" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherExpenseRequest" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReceipts" INTEGER NOT NULL DEFAULT 0,
    "attachmentUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtherExpenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtherExpenseItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "itemName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receipts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtherExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "formNumber" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalWorkHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOvertimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalHolidayPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalOvertimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attachmentUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "workerName" TEXT NOT NULL,
    "clientOrWork" TEXT NOT NULL,
    "dayType" "OvertimeDayType" NOT NULL,
    "workTime" TEXT NOT NULL,
    "workHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holidayDoublePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "personName" TEXT NOT NULL,
    "amTask" TEXT,
    "pmTask" TEXT,
    "fullDayTask" TEXT,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "weekNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCalendarEvent" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_name_key" ON "LeaveType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_userId_leaveTypeId_year_key" ON "LeaveBalance"("userId", "leaveTypeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_submissionId_key" ON "LeaveRequest"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_formNumber_key" ON "LeaveRequest"("formNumber");

-- CreateIndex
CREATE INDEX "LeaveRequest_deletedAt_idx" ON "LeaveRequest"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoom_name_key" ON "MeetingRoom"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendee_bookingId_userId_key" ON "MeetingAttendee"("bookingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowConfig_formType_stepOrder_key" ON "WorkflowConfig"("formType", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReport_submissionId_key" ON "ExpenseReport"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReport_formNumber_key" ON "ExpenseReport"("formNumber");

-- CreateIndex
CREATE INDEX "ExpenseReport_applicantId_idx" ON "ExpenseReport"("applicantId");

-- CreateIndex
CREATE INDEX "ExpenseReport_deletedAt_idx" ON "ExpenseReport"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReport_applicantId_year_month_key" ON "ExpenseReport"("applicantId", "year", "month");

-- CreateIndex
CREATE INDEX "ExpenseReportItem_reportId_idx" ON "ExpenseReportItem"("reportId");

-- CreateIndex
CREATE INDEX "ExpenseReportItem_date_idx" ON "ExpenseReportItem"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OtherExpenseRequest_submissionId_key" ON "OtherExpenseRequest"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "OtherExpenseRequest_formNumber_key" ON "OtherExpenseRequest"("formNumber");

-- CreateIndex
CREATE INDEX "OtherExpenseRequest_applicantId_idx" ON "OtherExpenseRequest"("applicantId");

-- CreateIndex
CREATE INDEX "OtherExpenseRequest_deletedAt_idx" ON "OtherExpenseRequest"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OtherExpenseRequest_applicantId_year_month_key" ON "OtherExpenseRequest"("applicantId", "year", "month");

-- CreateIndex
CREATE INDEX "OtherExpenseItem_requestId_idx" ON "OtherExpenseItem"("requestId");

-- CreateIndex
CREATE INDEX "OtherExpenseItem_date_idx" ON "OtherExpenseItem"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRequest_submissionId_key" ON "OvertimeRequest"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRequest_formNumber_key" ON "OvertimeRequest"("formNumber");

-- CreateIndex
CREATE INDEX "OvertimeRequest_applicantId_idx" ON "OvertimeRequest"("applicantId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_deletedAt_idx" ON "OvertimeRequest"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRequest_applicantId_year_month_key" ON "OvertimeRequest"("applicantId", "year", "month");

-- CreateIndex
CREATE INDEX "OvertimeItem_requestId_idx" ON "OvertimeItem"("requestId");

-- CreateIndex
CREATE INDEX "OvertimeItem_date_idx" ON "OvertimeItem"("date");

-- CreateIndex
CREATE INDEX "CalendarEvent_date_idx" ON "CalendarEvent"("date");

-- CreateIndex
CREATE INDEX "CalendarEvent_personName_idx" ON "CalendarEvent"("personName");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_date_personName_key" ON "CalendarEvent"("date", "personName");

-- CreateIndex
CREATE INDEX "ClientCalendarEvent_date_idx" ON "ClientCalendarEvent"("date");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingBooking" ADD CONSTRAINT "MeetingBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MeetingRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingBooking" ADD CONSTRAINT "MeetingBooking_bookerId_fkey" FOREIGN KEY ("bookerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "MeetingBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseReportItem" ADD CONSTRAINT "ExpenseReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ExpenseReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherExpenseRequest" ADD CONSTRAINT "OtherExpenseRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherExpenseItem" ADD CONSTRAINT "OtherExpenseItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OtherExpenseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeItem" ADD CONSTRAINT "OvertimeItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "OvertimeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
