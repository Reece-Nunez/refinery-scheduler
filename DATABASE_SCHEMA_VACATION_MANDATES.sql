-- Vacation table
CREATE TABLE IF NOT EXISTS vacation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "operatorId" UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endTime" TIMESTAMP WITH TIME ZONE NOT NULL,
  "vacationType" VARCHAR(10) NOT NULL CHECK ("vacationType" IN ('12hr', '8hr', '4hr')),
  "isWholeSet" BOOLEAN DEFAULT false,
  "shiftType" VARCHAR(10) CHECK ("shiftType" IN ('day', 'night')),
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" UUID REFERENCES users(id)
);

-- Mandates table
CREATE TABLE IF NOT EXISTS mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "operatorId" UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  "mandateDate" DATE NOT NULL,
  "shiftType" VARCHAR(10) NOT NULL CHECK ("shiftType" IN ('day', 'night')),
  "jobId" UUID REFERENCES jobs(id),
  reason TEXT,
  "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endTime" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" UUID REFERENCES users(id)
);

-- Mandate protection tracking
CREATE TABLE IF NOT EXISTS mandate_protection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "operatorId" UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  "vacationId" UUID NOT NULL REFERENCES vacation(id) ON DELETE CASCADE,
  "protectionStartDate" DATE NOT NULL,
  "protectionEndDate" DATE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Out of schedule jobs (dynamic jobs created by admins)
CREATE TABLE IF NOT EXISTS out_of_schedule_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" UUID REFERENCES users(id)
);

-- Out of schedule assignments
CREATE TABLE IF NOT EXISTS out_of_schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "operatorId" UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  "jobId" UUID NOT NULL REFERENCES out_of_schedule_jobs(id) ON DELETE CASCADE,
  "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endTime" TIMESTAMP WITH TIME ZONE NOT NULL,
  "shiftType" VARCHAR(10) NOT NULL CHECK ("shiftType" IN ('day', 'night')),
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "createdBy" UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vacation_operator ON vacation("operatorId");
CREATE INDEX IF NOT EXISTS idx_vacation_dates ON vacation("startTime", "endTime");
CREATE INDEX IF NOT EXISTS idx_mandates_operator ON mandates("operatorId");
CREATE INDEX IF NOT EXISTS idx_mandates_date ON mandates("mandateDate");
CREATE INDEX IF NOT EXISTS idx_mandate_protection_operator ON mandate_protection("operatorId");
CREATE INDEX IF NOT EXISTS idx_out_of_schedule_assignments_operator ON out_of_schedule_assignments("operatorId");
CREATE INDEX IF NOT EXISTS idx_out_of_schedule_assignments_dates ON out_of_schedule_assignments("startTime", "endTime");

-- Comments
COMMENT ON TABLE vacation IS 'Tracks operator vacation time (12hr, 8hr, or 4hr blocks)';
COMMENT ON TABLE mandates IS 'Tracks when operators are mandated to work on their days off';
COMMENT ON TABLE mandate_protection IS 'Tracks mandate protection periods when operators take whole sets off';
COMMENT ON TABLE out_of_schedule_jobs IS 'Dynamic jobs created by admins (EXTRA, Training, PHA, etc.)';
COMMENT ON TABLE out_of_schedule_assignments IS 'Assignments to out-of-schedule jobs';
