# Shift Scheduling Validation Rules

## Client-Side Validation (AdvancedShiftScheduler)

These validations occur before the shifts are submitted to the API:

### 1. **Job Assignment Validation**
- ✅ Every shift must have a job assigned
- ✅ Jobs can only be assigned if the operator is trained for them

### 2. **Duplicate Shift Type Prevention**
- ✅ Cannot assign multiple day shifts on the same date
- ✅ Cannot assign multiple night shifts on the same date
- Example: If operator has a day shift on 1/15, they cannot have another day shift on 1/15

### 3. **Day/Night Conflict Prevention**
- ✅ Operator cannot work both a day shift AND a night shift on the same date
- Example: If operator has a day shift on 1/15, they cannot have a night shift on 1/15

### 4. **Duplicate Job Prevention (Same Shift Type)**
- ✅ Cannot assign the same job multiple times for the same shift type on the same date
- ✅ ALLOWED: Same job on day shift AND night shift (different shift types)
- ❌ NOT ALLOWED: VRU Console on two different day shifts on 1/15
- ✅ ALLOWED: VRU Console on day shift AND VRU Console on night shift on 1/15
- Example: If operator has "VRU Console" for day shift on 1/15, they cannot have another "VRU Console" day shift on 1/15, but they CAN have "VRU Console" night shift on 1/15

### 5. **Operator Training Validation**
- ✅ Operator must be trained for the job being assigned
- ✅ If operator has no trained jobs, they cannot be scheduled

## Server-Side Validation (Shifts API)

These validations occur when creating shifts in the database:

### 1. **Time Overlap Detection**
- ✅ Prevents scheduling overlapping shifts for the same operator
- Checks if new shift start/end times conflict with existing shifts
- Example: Cannot schedule 6:00 AM - 2:00 PM if operator already has 4:45 AM - 4:45 PM

### 2. **Day/Night Conflict (Database Level)**
- ✅ Double-checks that operator isn't working both day and night on same date
- Compares shift dates and types with existing shifts

### 3. **Duplicate Job Assignment (Database Level)**
- ✅ Prevents assigning the same job multiple times for the same shift type on the same date
- ✅ Allows same job on different shift types (day vs night)
- Compares jobId AND shiftType with existing shifts on the same date

### 4. **RP-755 Fatigue Policy Validation**
- ✅ Validates against fatigue policy rules
- Checks hours worked, rest periods, consecutive days, etc.
- Can be overridden by admin with exception request

## Multi-Day Assignment Rules

### 1. **Consecutive Days Limit**
- Regular Operators: Maximum 4 consecutive days
- Green Hats (APS): Maximum 7 consecutive days

### 2. **Flexible Job Assignment**
- Each day in a multi-day assignment can have a different job
- Example: Day 1 = VRU Console, Day 2 = Butamer, Day 3-4 = Pumper

### 3. **Flexible Shift Type**
- Each day can be either day or night shift
- Example: Days 1-2 can be day shifts, Days 3-4 can be night shifts

## Error Messages

All validation errors provide clear, user-friendly messages:
- "Cannot assign multiple day shifts on the same date (1/15/2025)"
- "Operator cannot work both day and night shifts on 1/15/2025"
- "Cannot assign the same job (VRU Console) to multiple day shifts on 1/15/2025"
- "Shift conflicts with existing day shift on 2025-01-15"

## Toast Notifications

All validation errors and success messages are displayed via toast notifications:
- 🔴 Error toasts (red) for validation failures
- 🟢 Success toasts (green) for successful scheduling
- ⚠️ Warning toasts (yellow) for RP-755 policy violations requiring exceptions
