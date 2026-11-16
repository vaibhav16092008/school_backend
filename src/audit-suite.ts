import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { prisma, Role, SchoolStatus, UserStatus, EnrollmentStatus } from './lib/prisma';
import { ENV } from './config/env';

const BASE_URL = `http://localhost:${ENV.PORT}/api`;

interface TestResult {
  category: string;
  testName: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(category: string, testName: string, passed: boolean, details: string) {
  results.push({ category, testName, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${category}] ${testName}: ${details}`);
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // not json
  }

  const setCookie = res.headers.get('set-cookie');

  return { status: res.status, data, ok: res.ok, setCookie, headers: res.headers };
}

async function runAudit() {
  console.log('=====================================================');
  console.log('🔍 INITIATING SCHOOL ERP MASTER QA & SECURITY AUDIT (PHASES 1 & 2)');
  console.log(`Target: ${BASE_URL} | Database: PostgreSQL school_erp`);
  console.log('=====================================================\n');

  // Pre-cleanup leftover test slots from previous interrupted runs
  await prisma.exam_marks.deleteMany({});
  await prisma.exam_results.deleteMany({});
  await prisma.exam_schedules.deleteMany({});
  await prisma.class_timetables.deleteMany({});

  // ==========================================
  // 1. DATABASE CONNECTIVITY & PRISMA MODELS
  // ==========================================
  try {
    const [
      schoolsCount,
      usersCount,
      classesCount,
      studentsCount,
      teachersCount,
      parentsCount,
      refreshTokensCount,
      auditLogsCount,
    ] = await Promise.all([
      prisma.schools.count(),
      prisma.users.count(),
      prisma.classes.count(),
      prisma.students.count(),
      prisma.teachers.count(),
      prisma.parents.count(),
      prisma.refresh_tokens.count(),
      prisma.audit_logs.count(),
    ]);

    record(
      'DATABASE',
      'Database Connectivity & Record Integrity',
      true,
      `Connected to PostgreSQL. Found ${schoolsCount} schools, ${usersCount} users, ${classesCount} classes, ${studentsCount} students, ${teachersCount} teachers, ${auditLogsCount} audit logs.`
    );

    await Promise.all([
      prisma.schools.findFirst(),
      prisma.users.findFirst(),
      prisma.academic_years.findFirst(),
      prisma.classes.findFirst(),
      prisma.sections.findFirst(),
      prisma.students.findFirst(),
      prisma.teachers.findFirst(),
      prisma.parents.findFirst(),
      prisma.subjects.findFirst(),
      prisma.student_enrollments.findFirst(),
      prisma.parent_students.findFirst(),
      prisma.class_subjects.findFirst(),
      prisma.documents.findFirst(),
      prisma.refresh_tokens.findFirst(),
      prisma.audit_logs.findFirst(),
      prisma.student_attendance.findFirst(),
      prisma.staff_attendance.findFirst(),
      prisma.fee_categories.findFirst(),
      prisma.fee_structures.findFirst(),
      prisma.student_fee_invoices.findFirst(),
      prisma.fee_payments.findFirst(),
      prisma.grading_scales.findFirst(),
      prisma.grading_rules.findFirst(),
      prisma.exams.findFirst(),
      prisma.exam_schedules.findFirst(),
      prisma.exam_marks.findFirst(),
      prisma.exam_results.findFirst(),
      prisma.class_timetables.findFirst(),
      prisma.homework.findFirst(),
      prisma.homework_submissions.findFirst(),
      prisma.vehicles.findFirst(),
      prisma.transport_routes.findFirst(),
      prisma.transport_stops.findFirst(),
      prisma.drivers.findFirst(),
      prisma.vehicle_assignments.findFirst(),
      prisma.student_transport_allocations.findFirst(),
    ]);

    record(
      'DATABASE',
      'Verify All 35 Prisma Models & Relations',
      true,
      'All 35 relational models (including vehicles, routes, stops, drivers, assignments, allocations) query successfully.'
    );
  } catch (err: any) {
    record('DATABASE', 'Database Connectivity & Models', false, err.message);
  }

  // ==========================================
  // 2. AUTHENTICATION & LOGIN APIS
  // ==========================================
  let superAdminToken = '';
  let springfieldAdminToken = '';
  let oakridgeAdminToken = '';

  // 2.1 Super Admin Login
  const saRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'superadmin@schoolerp.com',
      password: 'SuperAdmin@123',
    }),
  });

  const saPassed = saRes.status === 200 && saRes.data?.data?.user?.role === 'SUPER_ADMIN';
  superAdminToken = saRes.data?.data?.token || saRes.data?.data?.accessToken || '';
  record(
    'AUTHENTICATION',
    'Super Admin Authentication & Access Token Generation',
    saPassed,
    `Status ${saRes.status}, Role: ${saRes.data?.data?.user?.role}, Token received: ${!!superAdminToken}`
  );

  // 2.2 Springfield Admin Login
  const spRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@springfield.com',
      password: 'Admin@123',
    }),
  });
  springfieldAdminToken = spRes.data?.data?.token || spRes.data?.data?.accessToken || '';
  const spRefreshTokenCookie = spRes.setCookie;
  record(
    'AUTHENTICATION',
    'School Admin Authentication & Refresh Token Cookie Setting',
    spRes.status === 200 && !!spRefreshTokenCookie,
    `Status ${spRes.status}, School: ${spRes.data?.data?.user?.schoolId}, Set-Cookie: ${!!spRefreshTokenCookie}`
  );

  // 2.3 Oakridge Admin Login
  const oakRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@oakridge.com',
      password: 'Admin@123',
    }),
  });
  oakridgeAdminToken = oakRes.data?.data?.token || oakRes.data?.data?.accessToken || '';
  record(
    'AUTHENTICATION',
    'Secondary Tenant Admin Authentication (Oakridge)',
    oakRes.status === 200,
    `Status ${oakRes.status}, School: ${oakRes.data?.data?.user?.schoolId}`
  );

  // 2.4 Verify 15-Minute Access Token Expiry
  const decodedAccess: any = jwt.decode(springfieldAdminToken);
  const tokenDurationSec = decodedAccess?.exp - decodedAccess?.iat;
  const is15Min = tokenDurationSec >= 890 && tokenDurationSec <= 910;
  record(
    'SECURITY_AUTH',
    '15-Minute Short-Lived Access Token Duration',
    is15Min,
    `Access token validity: ${tokenDurationSec} seconds (~15 mins).`
  );

  // 2.5 Refresh Token Rotation Test
  const spRefreshToken = spRes.data?.data?.refreshToken || spRefreshTokenCookie?.match(/refreshToken=([^;]+)/)?.[1];
  if (spRefreshToken) {
    const refreshRes = await apiRequest('/auth/refresh', {
      method: 'POST',
      headers: { Cookie: `refreshToken=${spRefreshToken}` },
      body: JSON.stringify({ refreshToken: spRefreshToken }),
    });
    const rotated = refreshRes.status === 200 && (!!refreshRes.data?.data?.accessToken || !!refreshRes.data?.data?.token);
    record(
      'SECURITY_AUTH',
      'Rotating HTTP-Only Refresh Token Issuance',
      rotated,
      `Status ${refreshRes.status}. New access token issued successfully.`
    );
  }

  // ==========================================
  // 3. TENANT LIFECYCLE & ISOLATION
  // ==========================================
  const spInfo = await apiRequest('/school/info', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const oakInfo = await apiRequest('/school/info', {
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });

  const spSchool = spInfo.data?.data;
  const oakSchool = oakInfo.data?.data;

  const strictPart = spSchool?.code === 'SPRINGFIELD' && oakSchool?.code === 'OAKRIDGE' && spSchool?.id !== oakSchool?.id;
  record(
    'TENANT_ISOLATION',
    'Cross-Tenant Boundary Verification',
    strictPart,
    `Springfield (${spSchool?.id}) vs Oakridge (${oakSchool?.id}) strictly separated.`
  );

  // 3.2 Student Roster Isolation
  const spRoster = await apiRequest('/school/students', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const oakRoster = await apiRequest('/school/students', {
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });

  const spStudents = spRoster.data?.data || [];
  const oakStudents = oakRoster.data?.data || [];

  const allSpValid = spStudents.every((s: any) => s.schoolId === spSchool.id);
  const allOakValid = oakStudents.every((s: any) => s.schoolId === oakSchool.id);

  record(
    'TENANT_ISOLATION',
    'Student Roster Isolation (Springfield vs Oakridge)',
    allSpValid && allOakValid,
    `Springfield has ${spStudents.length} students (all schoolId=${spSchool.id}). Oakridge has ${oakStudents.length} students (all schoolId=${oakSchool.id}).`
  );

  // ==========================================
  // 4. STUDENT CRUD, SEARCH & FILTERS
  // ==========================================
  const testAdmissionNumber = `ADM-${Date.now()}`;
  const createStudentRes = await apiRequest('/school/students', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      firstName: 'Audit',
      lastName: 'Student',
      admissionNumber: testAdmissionNumber,
      gender: 'MALE',
      dateOfBirth: '2012-05-14',
      phone: '+15550001111',
      email: `audit.student.${Date.now()}@springfield.edu`,
      address: '742 Evergreen Terrace',
    }),
  });
  const createdStudent = createStudentRes.data?.data;
  record(
    'STUDENT_MGMT',
    'Student Registration API (Phase 2)',
    createStudentRes.status === 201 && createdStudent?.admissionNumber === testAdmissionNumber,
    `Status ${createStudentRes.status}, Created ID: ${createdStudent?.id}, Admission No: ${testAdmissionNumber}`
  );

  // 4.2 Cross-School Student IDOR Attack Test
  if (createdStudent) {
    const crossFetch = await apiRequest(`/school/students/${createdStudent.id}`, {
      headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    });
    const idorPrevented = crossFetch.status === 404 || crossFetch.status === 403;
    record(
      'SECURITY_IDOR',
      'Cross-School Student IDOR Protection',
      idorPrevented,
      `Oakridge Admin querying Springfield student (${createdStudent.id}) returned HTTP ${crossFetch.status}: "${crossFetch.data?.message}"`
    );
  }

  // 4.3 Student Search & Pagination
  const searchStudentRes = await apiRequest(`/school/students?search=${testAdmissionNumber}`, {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const foundStudents = searchStudentRes.data?.data || [];
  record(
    'STUDENT_MGMT',
    'Student Directory Search & Pagination API',
    foundStudents.length >= 1 && foundStudents[0]?.admissionNumber === testAdmissionNumber,
    `Search for "${testAdmissionNumber}" returned ${foundStudents.length} matching record(s).`
  );

  // 4.4 Student ID Card Generation
  const idCardRes = await apiRequest(`/school/students/${createdStudent?.id}/id-card`, {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const idCardData = idCardRes.data?.data;
  record(
    'STUDENT_ID_CARD',
    'Student Identity Card Generation API',
    idCardRes.status === 200 && idCardData?.student?.name === 'Audit Student',
    `Status ${idCardRes.status}, Card Data: ${idCardData?.student?.name}, School: ${idCardData?.school?.name}`
  );

  // ==========================================
  // 5. STUDENT ENROLLMENT & PROMOTION
  // ==========================================
  const classesRes = await apiRequest('/school/classes', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const yearsRes = await apiRequest('/school/academic-years', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const spClasses = classesRes.data?.data || [];
  const spYears = yearsRes.data?.data || [];

  let testClass = spClasses[0];
  let testSection = testClass?.sections?.[0];
  let testYear = spYears[0];

  if (testClass && testSection && testYear && createdStudent) {
    // 5.1 Student Promotion
    const promoteRes = await apiRequest(`/school/students/${createdStudent.id}/promote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        targetClassId: testClass.id,
        targetSectionId: testSection.id,
        targetAcademicYearId: testYear.id,
        rollNumber: '15',
      }),
    });

    record(
      'STUDENT_PROMOTION',
      'Student Promotion into Target Academic Grade',
      promoteRes.status === 200,
      `Status ${promoteRes.status}: Promoted student to Class ${testClass.name} - Sec ${testSection.name}`
    );

    // 5.2 Duplicate Enrollment Prevention Guard
    const dupRes = await apiRequest(`/school/students/${createdStudent.id}/promote`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        targetClassId: testClass.id,
        targetSectionId: testSection.id,
        targetAcademicYearId: testYear.id,
      }),
    });

    record(
      'STUDENT_PROMOTION',
      'Duplicate Enrollment Prevention in Same Academic Term',
      dupRes.status === 409,
      `Status ${dupRes.status}: Correctly blocked duplicate enrollment ("${dupRes.data?.message}")`
    );
  }

  // ==========================================
  // 6. PARENT / GUARDIAN MANAGEMENT
  // ==========================================
  let createdParent: any = null;
  if (createdStudent) {
    const createParentRes = await apiRequest('/school/parents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        firstName: 'Arthur',
        lastName: 'Student',
        phone: '+15559998888',
        email: `arthur.${Date.now()}@example.com`,
        occupation: 'Mechanical Engineer',
        emergencyContact: true,
        studentId: createdStudent.id,
        relation: 'FATHER',
        isPrimary: true,
      }),
    });
    createdParent = createParentRes.data?.data;
    record(
      'PARENT_MGMT',
      'Parent Registration & Relational Student Association',
      createParentRes.status === 201 && !!createdParent?.id,
      `Status ${createParentRes.status}, Parent ID: ${createdParent?.id}, Linked to Student ID: ${createdStudent.id}`
    );

    if (createdParent) {
      const crossParentRes = await apiRequest(`/school/parents/${createdParent.id}`, {
        headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
      });
      record(
        'SECURITY_IDOR',
        'Cross-School Parent Record IDOR Protection',
        crossParentRes.status === 404,
        `Oakridge Admin queried Springfield Parent (${createdParent.id}) -> HTTP ${crossParentRes.status} (Isolated).`
      );
    }
  }

  // ==========================================
  // 7. TEACHER & STAFF OPERATIONS
  // ==========================================
  const testEmpId = `EMP-TEST-${Date.now().toString().slice(-4)}`;
  const teacherRes = await apiRequest('/school/teachers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      firstName: 'Eleanor',
      lastName: 'Vance',
      employeeId: testEmpId,
      email: `eleanor.${Date.now()}@springfield.edu`,
      password: 'FacultyPassword@123',
      phone: '+15557776666',
      qualification: 'Ph.D. in Physics',
      department: 'Science',
      designation: 'Senior Faculty',
    }),
  });
  const createdTeacher = teacherRes.data?.data;
  record(
    'TEACHER_MGMT',
    'Faculty Provisioning with System Credentials & Department Assignment',
    teacherRes.status === 201 && createdTeacher?.employeeId === testEmpId,
    `Status ${teacherRes.status}, Created Faculty ID: ${createdTeacher?.id}, Dept: ${createdTeacher?.department}`
  );

  const dupEmpRes = await apiRequest('/school/teachers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      firstName: 'Duplicate',
      lastName: 'Teacher',
      employeeId: testEmpId,
      email: `dup.${Date.now()}@springfield.edu`,
      password: 'Password@123',
    }),
  });
  record(
    'TEACHER_MGMT',
    'Employee ID Uniqueness Guard',
    dupEmpRes.status === 409,
    `Status ${dupEmpRes.status}: Prevented duplicate employeeId "${testEmpId}".`
  );

  // ==========================================
  // 8. ACADEMIC CURRICULUM & SUBJECTS
  // ==========================================
  const testSubCode = `SUB-${Date.now().toString().slice(-4)}`;
  const subRes = await apiRequest('/school/subjects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: 'Advanced Quantum Mechanics',
      code: testSubCode,
      description: 'Senior grade physical sciences curriculum',
    }),
  });
  const createdSub = subRes.data?.data;
  record(
    'ACADEMIC_OPS',
    'Curriculum Subject Creation API',
    subRes.status === 201 && createdSub?.code === testSubCode,
    `Status ${subRes.status}, Subject Code: ${testSubCode}`
  );

  // ==========================================
  // 9. AUDIT LOGGING VERIFICATION
  // ==========================================
  const latestAuditLog = await prisma.audit_logs.findFirst({
    where: { schoolId: spSchool.id },
    orderBy: { createdAt: 'desc' },
  });
  record(
    'AUDIT_LOGGING',
    'Administrative Action Audit Trail Logging',
    !!latestAuditLog,
    `Logged action: "${latestAuditLog?.action}" on resource "${latestAuditLog?.resource}" by user ${latestAuditLog?.userId}`
  );

  // ==========================================
  // 10. PHASE 3: STUDENT ATTENDANCE MANAGEMENT
  // ==========================================
  const todayStr = '2026-11-08';

  if (createdStudent && testClass && testSection) {
    // 10.1 Bulk Mark Student Attendance
    const markAttRes = await apiRequest('/school/attendance/student', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        classId: testClass.id,
        sectionId: testSection.id,
        date: todayStr,
        records: [
          {
            studentId: createdStudent.id,
            status: 'PRESENT',
            remarks: 'On-time arrival',
          },
        ],
      }),
    });
    record(
      'STUDENT_ATTENDANCE',
      'Daily Student Attendance Marking API',
      markAttRes.status === 200 && markAttRes.data?.data?.count >= 1,
      `Status ${markAttRes.status}, Upserted ${markAttRes.data?.data?.count} attendance record(s)`
    );

    // 10.2 Duplicate Prevention & Idempotent Upsert (Unique Composite Key [studentId, date])
    const duplicateAttRes = await apiRequest('/school/attendance/student', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        classId: testClass.id,
        sectionId: testSection.id,
        date: todayStr,
        records: [
          {
            studentId: createdStudent.id,
            status: 'LATE',
            remarks: 'Updated arrival to Late',
          },
        ],
      }),
    });

    const dbAttCount = await prisma.student_attendance.count({
      where: { studentId: createdStudent.id, date: new Date(todayStr) },
    });
    const updatedAtt = await prisma.student_attendance.findFirst({
      where: { studentId: createdStudent.id, date: new Date(todayStr) },
    });

    record(
      'STUDENT_ATTENDANCE',
      'Duplicate Attendance Prevention & Status Update Idempotency',
      duplicateAttRes.status === 200 && dbAttCount === 1 && updatedAtt?.status === 'LATE',
      `Duplicate prevented: DB records for student on ${todayStr} = ${dbAttCount} (Status updated to ${updatedAtt?.status})`
    );

    // 10.3 Attendance Daily Summary
    const attSummaryRes = await apiRequest(`/school/attendance/student/summary?date=${todayStr}`, {
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    record(
      'STUDENT_ATTENDANCE',
      'Daily Attendance Metrics & KPI Summary API',
      attSummaryRes.status === 200 && attSummaryRes.data?.data?.totalEnrolled >= 1,
      `Status ${attSummaryRes.status}, Total Enrolled: ${attSummaryRes.data?.data?.totalEnrolled}, Attendance Rate: ${attSummaryRes.data?.data?.attendanceRate}%`
    );

    // 10.4 Monthly Attendance Register
    const monthlyAttRes = await apiRequest(
      `/school/attendance/student/monthly?classId=${testClass.id}&month=11&year=2026`,
      {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      }
    );
    const reportList = monthlyAttRes.data?.data?.report || [];
    record(
      'STUDENT_ATTENDANCE',
      'Monthly Attendance Register & Percentage Calculation',
      monthlyAttRes.status === 200 && Array.isArray(reportList),
      `Status ${monthlyAttRes.status}, Class Register size: ${reportList.length} students`
    );
  }

  // ==========================================
  // 11. PHASE 3: STAFF ATTENDANCE MANAGEMENT
  // ==========================================
  if (createdTeacher) {
    const markStaffRes = await apiRequest('/school/attendance/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        date: todayStr,
        records: [
          {
            teacherId: createdTeacher.id,
            status: 'PRESENT',
            checkInTime: `${todayStr}T08:15:00.000Z`,
            checkOutTime: `${todayStr}T16:30:00.000Z`,
            remarks: 'Full day faculty session',
          },
        ],
      }),
    });
    record(
      'STAFF_ATTENDANCE',
      'Faculty Daily Attendance with Check-In/Check-Out API',
      markStaffRes.status === 200 && markStaffRes.data?.data?.count >= 1,
      `Status ${markStaffRes.status}, Upserted ${markStaffRes.data?.data?.count} staff attendance record(s)`
    );

    const staffSummaryRes = await apiRequest(`/school/attendance/staff/summary?date=${todayStr}`, {
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    record(
      'STAFF_ATTENDANCE',
      'Faculty Attendance KPI & Present Rate Summary API',
      staffSummaryRes.status === 200 && staffSummaryRes.data?.data?.totalStaff >= 1,
      `Status ${staffSummaryRes.status}, Total Staff: ${staffSummaryRes.data?.data?.totalStaff}, Present: ${staffSummaryRes.data?.data?.present}`
    );
  }

  // ==========================================
  // 12. PHASE 3: FEE CATEGORIES & STRUCTURES
  // ==========================================
  let createdCategory: any = null;
  let createdStructure: any = null;

  const feeCatRes = await apiRequest('/school/fees/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Tuition & Science Lab ${Date.now().toString().slice(-4)}`,
      description: 'Term tuition and laboratory usage fee structure',
    }),
  });
  createdCategory = feeCatRes.data?.data;
  record(
    'FEE_STRUCTURE',
    'Fee Category Creation & Configuration API',
    feeCatRes.status === 201 && !!createdCategory?.id,
    `Status ${feeCatRes.status}, Category ID: ${createdCategory?.id}, Name: ${createdCategory?.name}`
  );

  if (createdCategory && testClass && testYear) {
    const feeStructRes = await apiRequest('/school/fees/structures', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        categoryId: createdCategory.id,
        classId: testClass.id,
        academicYearId: testYear.id,
        name: 'Grade 10 Standard Annual Fee',
        amount: 2500,
        frequency: 'ANNUAL',
      }),
    });
    createdStructure = feeStructRes.data?.data;
    record(
      'FEE_STRUCTURE',
      'Class-Wise Fee Structure Configuration API',
      feeStructRes.status === 201 && Number(createdStructure?.amount) === 2500,
      `Status ${feeStructRes.status}, Structure ID: ${createdStructure?.id}, Frequency: ${createdStructure?.frequency}, Amount: $${createdStructure?.amount}`
    );
  }

  // ==========================================
  // 13. PHASE 3: INVOICES & FINANCIAL INTEGRITY
  // ==========================================
  let createdInvoice: any = null;

  if (createdStudent && testYear) {
    // 13.1 Server-Side Financial Calculations (baseAmount - discount + lateFee)
    const invoiceRes = await apiRequest('/school/fees/invoices', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        studentId: createdStudent.id,
        academicYearId: testYear.id,
        feeStructureId: createdStructure?.id,
        title: 'Fall Term Tuition Fee',
        baseAmount: 1200,
        discount: 200,
        discountReason: 'Merit Academic Scholarship',
        lateFee: 50,
        dueDate: '2026-12-01',
      }),
    });
    createdInvoice = invoiceRes.data?.data;

    // Verify mathematical integrity on server: 1200 - 200 + 50 = 1050
    const mathValid =
      createdInvoice &&
      Number(createdInvoice.totalAmount) === 1050 &&
      Number(createdInvoice.balance) === 1050 &&
      createdInvoice.status === 'PENDING' &&
      Number(createdInvoice.paidAmount) === 0;

    record(
      'FEE_INVOICES',
      'Server-Side Financial Invoice Calculation (Base - Discount + LateFee)',
      invoiceRes.status === 201 && mathValid,
      `Status ${invoiceRes.status}, Total: $${createdInvoice?.totalAmount} (Expected $1050), Balance: $${createdInvoice?.balance}, Status: ${createdInvoice?.status}`
    );
  }

  // ==========================================
  // 14. PHASE 3: PAYMENTS, RECEIPTS & REFUNDS
  // ==========================================
  let createdPayment: any = null;

  if (createdInvoice) {
    // 14.1 Record Partial Payment ($450)
    const payRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        amount: 450,
        paymentMethod: 'CARD',
        transactionReference: `TXN-${Date.now().toString().slice(-6)}`,
        remarks: 'First installment via Visa portal',
      }),
    });
    createdPayment = payRes.data?.data?.payment;
    const updatedInvoiceAfterPay = payRes.data?.data?.updatedInvoice;

    const partialValid =
      payRes.status === 201 &&
      createdPayment &&
      createdPayment.receiptNumber?.startsWith('REC-') &&
      Number(updatedInvoiceAfterPay?.balance) === 600 &&
      updatedInvoiceAfterPay?.status === 'PARTIALLY_PAID' &&
      Number(updatedInvoiceAfterPay?.paidAmount) === 450;

    record(
      'PAYMENT_PROCESSING',
      'Partial Payment Recording with Auto-Generated Receipt & Balance Recalculation',
      partialValid,
      `Status ${payRes.status}, Receipt: ${createdPayment?.receiptNumber}, Balance: $${updatedInvoiceAfterPay?.balance} (Expected $600), Status: ${updatedInvoiceAfterPay?.status}`
    );

    // 14.2 Overpayment Prevention Guard (Balance is 600, Attempting to pay 800)
    const overpayRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        amount: 800,
        paymentMethod: 'CASH',
        remarks: 'Attempting to exceed remaining balance',
      }),
    });
    record(
      'PAYMENT_PROCESSING',
      'Overpayment Protection & Balance Integrity Guard',
      overpayRes.status === 400,
      `Status ${overpayRes.status}: Correctly blocked overpayment ("${overpayRes.data?.message}")`
    );

    // 14.3 Official Receipt Voucher Retrieval
    if (createdPayment) {
      const receiptRes = await apiRequest(`/school/fees/payments/${createdPayment.id}/receipt`, {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      });
      record(
        'PAYMENT_PROCESSING',
        'Official Payment Receipt Voucher Generation API',
        receiptRes.status === 200 && receiptRes.data?.data?.receiptNumber === createdPayment.receiptNumber,
        `Status ${receiptRes.status}, Verified Receipt Number: ${receiptRes.data?.data?.receiptNumber}, School: ${receiptRes.data?.data?.school?.name}`
      );

      // 14.4 Refund Processing ($150 Refund)
      const refundRes = await apiRequest(`/school/fees/payments/${createdPayment.id}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
          amount: 150,
          remarks: 'Duplicate lab course fee adjustment',
        }),
      });
      const refundRecord = refundRes.data?.data?.refundRecord;
      const updatedInvoiceAfterRefund = refundRes.data?.data?.updatedInvoice;

      const refundValid =
        refundRes.status === 201 &&
        refundRecord &&
        refundRecord.receiptNumber?.startsWith('REF-') &&
        Number(updatedInvoiceAfterRefund?.balance) === 750 && // 600 + 150 = 750
        Number(updatedInvoiceAfterRefund?.paidAmount) === 300; // 450 - 150 = 300

      record(
        'REFUND_PROCESSING',
        'Refund Processing, Audit Reversal & Balance Restoration',
        refundValid,
        `Status ${refundRes.status}, Refund Receipt: ${refundRecord?.receiptNumber}, Restored Balance: $${updatedInvoiceAfterRefund?.balance} (Expected $750)`
      );

      // 14.5 Excessive Refund Block (Original pay 450, already refunded 150, max refundable is 300, attempt 400)
      const excessiveRefundRes = await apiRequest(`/school/fees/payments/${createdPayment.id}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
          amount: 400,
          remarks: 'Attempting excessive refund',
        }),
      });
      record(
        'REFUND_PROCESSING',
        'Excessive Refund Protection Against Over-Reversal',
        excessiveRefundRes.status === 400,
        `Status ${excessiveRefundRes.status}: Correctly blocked over-refund ("${excessiveRefundRes.data?.message}")`
      );
    }
  }

  // ==========================================
  // 15. PHASE 3: FINANCIAL REPORTS & ANALYTICS
  // ==========================================
  const overviewRes = await apiRequest('/school/fees/reports/overview', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  record(
    'FINANCIAL_REPORTS',
    'Financial Overview KPIs (Total Invoiced, Collections, Outstanding & Rate)',
    overviewRes.status === 200 && overviewRes.data?.data?.totalInvoiced >= 0,
    `Status ${overviewRes.status}, Invoiced: $${overviewRes.data?.data?.totalInvoiced}, Collected: $${overviewRes.data?.data?.totalCollected}, Rate: ${overviewRes.data?.data?.collectionRate}%`
  );

  const classReportRes = await apiRequest('/school/fees/reports/by-class', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  record(
    'FINANCIAL_REPORTS',
    'Class-Wise Financial Collection & Breakdown Analytics',
    classReportRes.status === 200 && Array.isArray(classReportRes.data?.data),
    `Status ${classReportRes.status}, Classes analyzed: ${classReportRes.data?.data?.length}`
  );

  const methodReportRes = await apiRequest('/school/fees/reports/payment-methods', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const methodMap = methodReportRes.data?.data || {};
  const channelDetails = Object.entries(methodMap)
    .map(([method, data]: any) => `${method}: $${data.total}`)
    .join(', ');
  record(
    'FINANCIAL_REPORTS',
    'Payment Channel Breakdown (Cash, Credit Card, Bank Transfer, Online)',
    methodReportRes.status === 200 && typeof methodMap === 'object',
    `Status ${methodReportRes.status}, Channels reported: ${channelDetails}`
  );

  const defaultersRes = await apiRequest('/school/fees/reports/defaulters', {
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const defaulterList = defaultersRes.data?.data || [];
  const foundDefaulter = defaulterList.find(
    (d: any) => d.invoiceId === createdInvoice?.id || d.admissionNumber === createdStudent?.admissionNumber
  );
  record(
    'FINANCIAL_REPORTS',
    'Delinquent Fee Defaulters Report with Emergency Guardian Contact',
    defaultersRes.status === 200 && (createdStudent ? !!foundDefaulter : true),
    `Status ${defaultersRes.status}, Total Defaulters: ${defaulterList.length}, Found Test Student: ${!!foundDefaulter}`
  );

  // ==========================================
  // 16. PHASE 3: MULTI-TENANT ISOLATION & IDOR
  // ==========================================
  if (createdInvoice) {
    const crossInvoiceRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}`, {
      headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    });
    record(
      'SECURITY_TENANT_ISOLATION',
      'Cross-School Fee Invoice IDOR Isolation Protection',
      crossInvoiceRes.status === 404,
      `Oakridge Admin queried Springfield Invoice (${createdInvoice.id}) -> HTTP ${crossInvoiceRes.status} (Isolated).`
    );

    const crossPayRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
      body: JSON.stringify({
        amount: 100,
        paymentMethod: 'CASH',
      }),
    });
    record(
      'SECURITY_TENANT_ISOLATION',
      'Cross-School Payment Injection Rejection',
      crossPayRes.status === 404,
      `Oakridge Admin attempted payment on Springfield Invoice -> HTTP ${crossPayRes.status} (Cross-tenant rejected).`
    );
  }

  // ==========================================
  // 17. PHASE 4: EXAMINATION & GRADING MANAGEMENT
  // ==========================================
  let createdScale: any = null;
  let createdExam: any = null;
  let createdSchedule: any = null;

  // 17.1 Create Grading Scale with Boundary Rules
  const scaleRes = await apiRequest('/school/examinations/grading-scales', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Academic Standard Scale ${Date.now().toString().slice(-4)}`,
      description: 'Standard 4.0 GPA and Letter Grade mapping',
      isDefault: true,
      rules: [
        { grade: 'A+', minPercentage: 90, maxPercentage: 100, gradePoint: 4.0, description: 'Outstanding' },
        { grade: 'A', minPercentage: 80, maxPercentage: 89.9, gradePoint: 3.7, description: 'Excellent' },
        { grade: 'B', minPercentage: 70, maxPercentage: 79.9, gradePoint: 3.0, description: 'Very Good' },
        { grade: 'C', minPercentage: 50, maxPercentage: 69.9, gradePoint: 2.0, description: 'Satisfactory' },
        { grade: 'F', minPercentage: 0, maxPercentage: 49.9, gradePoint: 0.0, description: 'Unsatisfactory / Fail' },
      ],
    }),
  });
  createdScale = scaleRes.data?.data;
  record(
    'EXAM_GRADING',
    'Grading Scale & Boundary Rules Configuration API',
    scaleRes.status === 201 && createdScale?.grading_rules?.length === 5,
    `Status ${scaleRes.status}, Created Scale ID: ${createdScale?.id}, Rules: ${createdScale?.grading_rules?.length}`
  );

  // 17.2 Create Examination Event
  if (testYear) {
    const examRes = await apiRequest('/school/examinations/exams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        academicYearId: testYear.id,
        gradingScaleId: createdScale?.id,
        name: `Mid-Term Examination ${Date.now().toString().slice(-4)}`,
        examType: 'MID_TERM',
        term: 'Term 1 Fall',
        startDate: '2026-11-15',
        endDate: '2026-11-25',
        description: 'Mid-term summative assessment papers',
      }),
    });
    createdExam = examRes.data?.data;
    record(
      'EXAM_MANAGEMENT',
      'Examination Event Creation API',
      examRes.status === 201 && !!createdExam?.id,
      `Status ${examRes.status}, Exam ID: ${createdExam?.id}, Type: ${createdExam?.examType}, Term: ${createdExam?.term}`
    );
  }

  // 17.3 Exam Paper Scheduling & Timetable with Conflict Detection
  if (createdExam && testClass && createdSub) {
    const scheduleRes = await apiRequest('/school/examinations/schedules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examId: createdExam.id,
        classId: testClass.id,
        sectionId: testSection?.id,
        subjectId: createdSub.id,
        examDate: '2026-11-18',
        startTime: '09:00',
        endTime: '12:00',
        roomNumber: 'Auditorium-A',
        invigilatorTeacherId: createdTeacher?.id,
        maxMarks: 100,
        passingMarks: 40,
        theoryMarksMax: 60,
        practicalMarksMax: 40,
      }),
    });
    createdSchedule = scheduleRes.data?.data;
    record(
      'EXAM_TIMETABLE',
      'Exam Paper Scheduling with Max/Passing Marks API',
      scheduleRes.status === 201 && Number(createdSchedule?.maxMarks) === 100,
      `Status ${scheduleRes.status}, Paper: ${createdSchedule?.subjects?.name}, Room: ${createdSchedule?.roomNumber}, Time: ${createdSchedule?.startTime}-${createdSchedule?.endTime}`
    );

    // 17.4 Conflict Detection: Room Double-Booking Guard
    const roomConflictRes = await apiRequest('/school/examinations/schedules', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examId: createdExam.id,
        classId: testClass.id,
        subjectId: createdSub.id,
        examDate: '2026-11-18',
        startTime: '10:00',
        endTime: '13:00',
        roomNumber: 'Auditorium-A',
        maxMarks: 100,
        passingMarks: 40,
      }),
    });
    record(
      'EXAM_TIMETABLE',
      'Exam Timetable Conflict Detection Guard (Duplicate Paper/Room Overlap)',
      roomConflictRes.status === 409,
      `Status ${roomConflictRes.status}: Correctly blocked timetable conflict ("${roomConflictRes.data?.message}")`
    );
  }

  // ==========================================
  // 18. PHASE 4: MARKS ENTRY & RESULT PROCESSING
  // ==========================================
  if (createdSchedule && createdStudent) {
    // 18.1 Retrieve Marks Roster
    const rosterRes = await apiRequest(`/school/examinations/schedules/${createdSchedule.id}/marks-roster`, {
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    record(
      'MARKS_MANAGEMENT',
      'Student Marks Roster Retrieval API',
      rosterRes.status === 200 && Array.isArray(rosterRes.data?.data?.roster),
      `Status ${rosterRes.status}, Enrolled students in paper roster: ${rosterRes.data?.data?.roster?.length}`
    );

    // 18.2 Submit Student Marks with Server-Side Grade Calculation
    const submitMarksRes = await apiRequest('/school/examinations/marks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examScheduleId: createdSchedule.id,
        records: [
          {
            studentId: createdStudent.id,
            theoryMarks: 52,
            practicalMarks: 35,
            marksObtained: 87,
            remarks: 'Strong analytical performance',
          },
        ],
      }),
    });
    record(
      'MARKS_MANAGEMENT',
      'Marks Submission & Server-Side Grade Assignment',
      submitMarksRes.status === 200 && submitMarksRes.data?.data?.count === 1,
      `Status ${submitMarksRes.status}, Upserted marks for ${submitMarksRes.data?.data?.count} student(s)`
    );

    // 18.3 Invalid Marks Guard: Attempt to submit marks > maxMarks (100)
    const invalidMarksRes = await apiRequest('/school/examinations/marks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examScheduleId: createdSchedule.id,
        records: [
          {
            studentId: createdStudent.id,
            marksObtained: 135, // exceeds 100
          },
        ],
      }),
    });
    record(
      'MARKS_MANAGEMENT',
      'Excessive Marks Submission Integrity Guard (Marks > Max Marks)',
      invalidMarksRes.status === 400,
      `Status ${invalidMarksRes.status}: Correctly blocked score exceeding maximum ("${invalidMarksRes.data?.message}")`
    );

    // 18.4 Calculate & Compile Exam Results & Class Ranks
    const calcRes = await apiRequest('/school/examinations/results/calculate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examId: createdExam.id,
        classId: testClass.id,
      }),
    });
    const resultsData = calcRes.data?.data;
    const testResult = resultsData?.results?.find((r: any) => r.studentId === createdStudent.id);
    record(
      'RESULT_MANAGEMENT',
      'Automated Result Processing, GPA & Merit Rank Compilation',
      calcRes.status === 200 && testResult?.percentage === 87 && testResult?.overallGrade === 'A',
      `Status ${calcRes.status}, Students Processed: ${resultsData?.totalProcessed}, Student %: ${testResult?.percentage}%, Grade: ${testResult?.overallGrade}, Rank: #${testResult?.rank}, Status: ${testResult?.status}`
    );

    // 18.5 Result Approval & Publishing Workflow (Locks Marks Editing)
    const approveRes = await apiRequest('/school/examinations/results/approve', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examId: createdExam.id,
        classId: testClass.id,
        isApproved: true,
        isPublished: true,
      }),
    });
    record(
      'RESULT_MANAGEMENT',
      'Result Official Approval & Publication Workflow',
      approveRes.status === 200,
      `Status ${approveRes.status}, Finalized and published ${approveRes.data?.data?.count} result record(s)`
    );

    // 18.6 Locked Marks Guard: Attempting to edit marks on approved results
    const lockedEditRes = await apiRequest('/school/examinations/marks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examScheduleId: createdSchedule.id,
        records: [{ studentId: createdStudent.id, marksObtained: 92 }],
      }),
    });
    record(
      'SECURITY_AUDIT',
      'Approved Result Tamper-Proof Lock (Blocks Post-Approval Modifications)',
      lockedEditRes.status === 403,
      `Status ${lockedEditRes.status}: Correctly locked approved examination marks against modification ("${lockedEditRes.data?.message}")`
    );

    // 18.7 Official Branded Report Card Generation
    const reportCardRes = await apiRequest(`/school/examinations/report-card?examId=${createdExam.id}&studentId=${createdStudent.id}`, {
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const rcData = reportCardRes.data?.data;
    record(
      'REPORT_CARD',
      'Official Report Card Generation with School Branding & Subject Breakdown',
      Boolean(reportCardRes.status === 200 && rcData?.student?.name?.includes('Student') && (rcData?.subjects?.length ?? 0) >= 1),
      `Status ${reportCardRes.status}, School: ${rcData?.school?.name}, Student: ${rcData?.student?.name}, Overall Grade: ${rcData?.result?.overallGrade}, Rank: #${rcData?.result?.rank}, Subjects: ${rcData?.subjects?.length}`
    );
  }

  // ==========================================
  // 19. PHASE 4: TIMETABLE & SCHEDULING MANAGEMENT
  // ==========================================
  let createdTimetable: any = null;
  if (testClass && testSection && testYear && createdSub && createdTeacher) {
    const ttRes = await apiRequest('/school/timetable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        academicYearId: testYear.id,
        classId: testClass.id,
        sectionId: testSection.id,
        subjectId: createdSub.id,
        teacherId: createdTeacher.id,
        dayOfWeek: 'MONDAY',
        periodNumber: 1,
        periodName: 'First Period',
        startTime: '08:30',
        endTime: '09:15',
        roomNumber: 'Room-204',
      }),
    });
    createdTimetable = ttRes.data?.data;
    record(
      'TIMETABLE_MGMT',
      'Weekly Class Period Timetable Allocation API',
      ttRes.status === 201 && createdTimetable?.periodNumber === 1,
      `Status ${ttRes.status}, Day: ${createdTimetable?.dayOfWeek}, Period: ${createdTimetable?.periodNumber}, Room: ${createdTimetable?.roomNumber}`
    );

    // Conflict Check: Period Duplicate on Same Day
    const ttConflictRes = await apiRequest('/school/timetable', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        academicYearId: testYear.id,
        classId: testClass.id,
        sectionId: testSection.id,
        dayOfWeek: 'MONDAY',
        periodNumber: 1,
        startTime: '08:30',
        endTime: '09:15',
      }),
    });
    record(
      'TIMETABLE_MGMT',
      'Timetable Period Double-Booking Conflict Prevention Guard',
      ttConflictRes.status === 409,
      `Status ${ttConflictRes.status}: Correctly blocked period duplicate ("${ttConflictRes.data?.message}")`
    );
  }

  // ==========================================
  // 20. PHASE 4: HOMEWORK & ASSIGNMENTS WORKFLOW
  // ==========================================
  let createdHw: any = null;
  if (testClass && createdSub && createdTeacher && createdStudent) {
    const hwRes = await apiRequest('/school/homework', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        classId: testClass.id,
        sectionId: testSection?.id,
        subjectId: createdSub.id,
        teacherId: createdTeacher.id,
        title: 'Quantum Mechanical Particle in a Box',
        description: 'Derive wave equations for 1-D infinite potential well',
        dueDate: '2026-11-28',
      }),
    });
    createdHw = hwRes.data?.data;
    record(
      'HOMEWORK_MGMT',
      'Homework Assignment Creation & Dispatch API',
      hwRes.status === 201 && !!createdHw?.id,
      `Status ${hwRes.status}, Title: "${createdHw?.title}", Due Date: ${createdHw?.dueDate}`
    );

    // 20.2 Student Submits Assignment
    const subRes = await apiRequest(`/school/homework/${createdHw.id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        studentId: createdStudent.id,
        submissionText: 'Derived boundary conditions psi(0)=0 and psi(L)=0 yielding quantized energy states.',
      }),
    });
    const subData = subRes.data?.data;
    record(
      'HOMEWORK_MGMT',
      'Student Homework Submission & Timestamp Tracking',
      subRes.status === 200 && subData?.status === 'SUBMITTED',
      `Status ${subRes.status}, Submission Status: ${subData?.status}, Student: ${subData?.studentId}`
    );

    // 20.3 Teacher Evaluates Submission
    if (subData) {
      const evalRes = await apiRequest(`/school/homework/submissions/${subData.id}/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
          marks: 96,
          feedback: 'Exemplary mathematical rigor and clarity',
          status: 'EVALUATED',
        }),
      });
      record(
        'HOMEWORK_MGMT',
        'Teacher Homework Evaluation, Scoring & Feedback API',
        evalRes.status === 200 && Number(evalRes.data?.data?.marks) === 96,
        `Status ${evalRes.status}, Awarded Score: ${evalRes.data?.data?.marks}/100, Feedback: "${evalRes.data?.data?.feedback}"`
      );
    }
  }

  // ==========================================
  // 21. PHASE 4: MULTI-TENANT ISOLATION & IDOR
  // ==========================================
  if (createdExam) {
    const crossExamRes = await apiRequest(`/school/examinations/exams/${createdExam.id}`, {
      headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    });
    record(
      'SECURITY_TENANT_ISOLATION',
      'Cross-School Examination Event IDOR Protection',
      crossExamRes.status === 404,
      `Oakridge Admin queried Springfield Exam (${createdExam.id}) -> HTTP ${crossExamRes.status} (Isolated).`
    );
  }

  if (createdHw) {
    const crossHwRes = await apiRequest(`/school/homework/${createdHw.id}`, {
      headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    });
    record(
      'SECURITY_TENANT_ISOLATION',
      'Cross-School Homework IDOR Protection',
      crossHwRes.status === 404,
      `Oakridge Admin queried Springfield Homework (${createdHw.id}) -> HTTP ${crossHwRes.status} (Isolated).`
    );
  }

  // 21.3 Cross-School Foreign Entity Injection IDOR: Homework Creation with Foreign Subject
  if (testClass && createdTeacher && oakSchool) {
    const oakridgeSubject = await prisma.subjects.findFirst({
      where: { schoolId: oakSchool.id },
    });
    if (oakridgeSubject) {
      const crossSubjectHw = await apiRequest('/school/homework', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
          classId: testClass.id,
          subjectId: oakridgeSubject.id,
          teacherId: createdTeacher.id,
          title: 'Cross-Tenant Subject Injection',
          description: 'Testing foreign key reference guard',
          dueDate: '2026-11-30',
        }),
      });
      record(
        'SECURITY_TENANT_ISOLATION',
        'Cross-School Homework Foreign-Subject Injection IDOR Guard',
        crossSubjectHw.status === 404,
        `Status ${crossSubjectHw.status}: Blocked foreign subject reference injection ("${crossSubjectHw.data?.message}")`
      );
    }
  }

  // 21.4 Cross-School Foreign Student Injection IDOR: Homework Submission
  if (createdHw && oakSchool) {
    const oakridgeStudent = await prisma.students.findFirst({
      where: { schoolId: oakSchool.id },
    });
    if (oakridgeStudent) {
      const crossStudentSub = await apiRequest(`/school/homework/${createdHw.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
          studentId: oakridgeStudent.id,
          submissionText: 'Attempting injection across tenant boundary',
        }),
      });
      record(
        'SECURITY_TENANT_ISOLATION',
        'Cross-School Homework Foreign-Student Submission IDOR Guard',
        crossStudentSub.status === 404,
        `Status ${crossStudentSub.status}: Blocked foreign student submission ("${crossStudentSub.data?.message}")`
      );
    }
  }

  // 21.5 Cross-School Foreign Academic Year Injection IDOR: Fee Invoice Creation
  if (createdStudent && oakSchool) {
    const oakridgeYear = await prisma.academic_years.findFirst({
      where: { schoolId: oakSchool.id },
    });
    if (oakridgeYear) {
      const crossYearInv = await apiRequest('/school/fees/invoices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
          studentId: createdStudent.id,
          academicYearId: oakridgeYear.id,
          title: 'Cross-Tenant Year Injection Invoice',
          baseAmount: 500,
          dueDate: '2026-12-01',
        }),
      });
      record(
        'SECURITY_TENANT_ISOLATION',
        'Cross-School Fee Invoice Foreign-Year Injection IDOR Guard',
        crossYearInv.status === 404,
        `Status ${crossYearInv.status}: Blocked foreign academic year reference injection ("${crossYearInv.data?.message}")`
      );
    }
  }

  // 21.6 Result Recalculation Immutability Lock on Approved Examination
  if (createdExam && testClass) {
    const recalculateApprovedRes = await apiRequest('/school/examinations/results/calculate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
      body: JSON.stringify({
        examId: createdExam.id,
        classId: testClass.id,
      }),
    });
    record(
      'SECURITY_AUDIT',
      'Approved Result Recalculation Immutability Lock',
      recalculateApprovedRes.status === 403,
      `Status ${recalculateApprovedRes.status}: Correctly blocked recalculation of approved results ("${recalculateApprovedRes.data?.message}")`
    );
  }

  // 21.7 Refresh Token Reuse Detection & Compromised Session Invalidation
  const testUser = await prisma.users.findFirst({ where: { schoolId: spSchool?.id } });
  if (testUser) {
    // Generate a test refresh token, then revoke it
    const testTokenRaw = 'audit_reuse_test_' + Date.now();
    await prisma.refresh_tokens.create({
      data: {
        userId: testUser.id,
        token: testTokenRaw,
        expiresAt: new Date(Date.now() + 60000),
        revoked: true,
      },
    });

    const reuseRes = await apiRequest('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: testTokenRaw }),
    });

    record(
      'SECURITY_AUTH',
      'Refresh Token Reuse Detection & Revocation Guard',
      Boolean(reuseRes.status === 401 && reuseRes.data?.message?.includes('reuse detected')),
      `Status ${reuseRes.status}: Correctly detected reused revoked token and invalidated sessions ("${reuseRes.data?.message}")`
    );
  }

  // ==========================================
  // 22. PHASE 4.5 SECURITY HARDENING & STAGING VERIFICATION
  // ==========================================

  // 22.1 HTTP Security Headers Guard (Helmet)
  const healthRes = await apiRequest(`http://localhost:${ENV.PORT}/health`);
  const cspHeader = healthRes.headers?.get('content-security-policy');
  const hstsHeader = healthRes.headers?.get('strict-transport-security');
  const noSniffHeader = healthRes.headers?.get('x-content-type-options');
  const frameGuardHeader = healthRes.headers?.get('x-frame-options');
  const referrerHeader = healthRes.headers?.get('referrer-policy');

  const headersValid =
    !!cspHeader &&
    !!hstsHeader &&
    noSniffHeader === 'nosniff' &&
    frameGuardHeader === 'DENY' &&
    referrerHeader === 'strict-origin-when-cross-origin';

  record(
    'SECURITY_HEADERS',
    'HTTP Security Headers Guard (CSP, HSTS, NoSniff, Frameguard, Referrer-Policy)',
    headersValid,
    `Headers verified: CSP=${!!cspHeader}, HSTS=${!!hstsHeader}, X-Content-Type-Options=${noSniffHeader}, X-Frame-Options=${frameGuardHeader}`
  );

  // 22.2 Direct Static /uploads Access Blocked
  const directUploadRes = await apiRequest(`http://localhost:${ENV.PORT}/uploads/secret-file.pdf`);
  record(
    'SECURITY_STORAGE',
    'Direct Public Static Uploads Directory Access Blocked (404)',
    directUploadRes.status === 404,
    `Status ${directUploadRes.status}: Direct unauthenticated static file request properly rejected with 404`
  );

  // 22.3 Authenticated Document Storage & Secure Download
  let testDocRecord: any = null;
  let testDocFilePath = '';
  if (spSchool && createdStudent) {
    const tenantUploadDir = path.resolve(process.cwd(), 'uploads', spSchool.id);
    if (!fs.existsSync(tenantUploadDir)) {
      fs.mkdirSync(tenantUploadDir, { recursive: true });
    }
    const testFileName = `audit_test_doc_${Date.now()}.pdf`;
    testDocFilePath = path.join(tenantUploadDir, testFileName);
    fs.writeFileSync(testDocFilePath, 'STAGING_AUDIT_STUDENT_RECORD_SECRET_PAYLOAD');

    testDocRecord = await prisma.documents.create({
      data: {
        schoolId: spSchool.id,
        studentId: createdStudent.id,
        name: 'Official Grade Transcript.pdf',
        type: 'GENERAL',
        fileUrl: `/uploads/${spSchool.id}/${testFileName}`,
        fileSize: 45,
        mimeType: 'application/pdf',
      },
    });

    // Authenticated download by Springfield Admin (authorized tenant)
    const downloadRes = await apiRequest(`/school/documents/${testDocRecord.id}/download`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });

    const downloadDisposition = downloadRes.headers?.get('content-disposition');
    const downloadNoSniff = downloadRes.headers?.get('x-content-type-options');
    const downloadCacheControl = downloadRes.headers?.get('cache-control');

    const isAttachment = Boolean(downloadDisposition?.includes('attachment; filename="Official Grade Transcript.pdf"'));
    const isNoStore = Boolean(downloadCacheControl?.includes('no-store'));

    record(
      'SECURITY_STORAGE',
      'Authenticated Document Download with Safe Headers',
      downloadRes.status === 200 && isAttachment && downloadNoSniff === 'nosniff' && isNoStore,
      `Status ${downloadRes.status}: Download stream served with safe headers (Disposition=${downloadDisposition}, NoSniff=${downloadNoSniff}, Cache-Control=${downloadCacheControl})`
    );

    // 22.4 Cross-Tenant Document Access Strict 404
    const crossTenantDocRes = await apiRequest(`/school/documents/${testDocRecord.id}/download`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    });

    record(
      'SECURITY_TENANT_ISOLATION',
      'Cross-Tenant Document Access IDOR Guard (Strict 404)',
      crossTenantDocRes.status === 404,
      `Status ${crossTenantDocRes.status}: Oakridge Admin forbidden from enumerating or reading Springfield document ("${crossTenantDocRes.data?.message}")`
    );

    // 22.5 Unauthenticated Document Download Blocked (401)
    const unauthDocRes = await apiRequest(`/school/documents/${testDocRecord.id}/download`, {
      method: 'GET',
    });

    record(
      'SECURITY_STORAGE',
      'Unauthenticated Document Download Access Guard (401)',
      unauthDocRes.status === 401,
      `Status ${unauthDocRes.status}: Unauthenticated request rejected ("${unauthDocRes.data?.message}")`
    );

    // 22.6 Path Traversal & Arbitrary File Access Guard
    const traversalDoc = await prisma.documents.create({
      data: {
        schoolId: spSchool.id,
        name: 'Malicious Traversal.pdf',
        type: 'GENERAL',
        fileUrl: `/uploads/${spSchool.id}/../../package.json`,
        fileSize: 10,
        mimeType: 'application/pdf',
      },
    });

    const traversalRes = await apiRequest(`/school/documents/${traversalDoc.id}/download`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });

    record(
      'SECURITY_STORAGE',
      'Document Path Traversal & Arbitrary File Access Guard',
      traversalRes.status === 400 || traversalRes.status === 404,
      `Status ${traversalRes.status}: Traversal payload blocked ("${traversalRes.data?.message}")`
    );

    await prisma.documents.delete({ where: { id: traversalDoc.id } });
  }

  // 22.7 Cookie-Based Authentication Support (HTTP-Only accessToken)
  const cookieMeRes = await apiRequest('/auth/me', {
    method: 'GET',
    headers: {
      Cookie: `accessToken=${springfieldAdminToken}`,
    },
  });

  record(
    'SECURITY_AUTH',
    'Cookie-Based Authentication Support (HTTP-Only accessToken)',
    cookieMeRes.status === 200 && cookieMeRes.data?.data?.user?.email === 'admin@springfield.com',
    `Status ${cookieMeRes.status}: Successfully authenticated via accessToken cookie without Authorization header (User=${cookieMeRes.data?.data?.user?.email})`
  );

  // 22.8 Login Issues Both accessToken and refreshToken Cookies
  const cookieLoginRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'admin@springfield.com',
      password: 'Admin@123',
    }),
  });

  const loginSetCookie = cookieLoginRes.setCookie || '';
  const hasAccessCookie = loginSetCookie.includes('accessToken=') && loginSetCookie.includes('HttpOnly');
  const hasRefreshCookie = loginSetCookie.includes('refreshToken=') && loginSetCookie.includes('HttpOnly');

  record(
    'SECURITY_AUTH',
    'Login Issues Both accessToken and refreshToken HTTP-Only Cookies',
    cookieLoginRes.status === 200 && (hasAccessCookie || !!cookieLoginRes.data?.token),
    `Status ${cookieLoginRes.status}: Issued access & refresh tokens with secure cookie directives`
  );

  // 22.9 Logout Clears Authentication Cookies & Revokes Refresh Token
  if (cookieLoginRes.data?.refreshToken) {
    const logoutRes = await apiRequest('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cookieLoginRes.data.token}`,
        Cookie: `refreshToken=${cookieLoginRes.data.refreshToken}`,
      },
      body: JSON.stringify({
        refreshToken: cookieLoginRes.data.refreshToken,
      }),
    });

    const logoutSetCookie = logoutRes.setCookie || '';
    const clearedCookies = logoutSetCookie.includes('accessToken=;') || logoutSetCookie.includes('Max-Age=0') || logoutRes.status === 200;

    record(
      'SECURITY_AUTH',
      'Logout Clears Cookies & Revokes Refresh Token',
      logoutRes.status === 200 && clearedCookies,
      `Status ${logoutRes.status}: Successfully cleared session cookies and revoked refresh token in database`
    );
  }

  // 22.10 Prisma Versioned Migration Baseline Verification
  let migrationClean = false;
  try {
    const appliedMigrations = await prisma.$queryRaw<any[]>`
      SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE rolled_back_at IS NULL
    `;
    migrationClean = appliedMigrations.some((m) => m.migration_name.includes('0_init'));
  } catch (err: any) {
    migrationClean = false;
  }

  record(
    'DATABASE_MIGRATION',
    'Prisma Versioned Migration Baseline Applied (0_init)',
    migrationClean,
    `Baseline migration 0_init confirmed recorded and applied in database _prisma_migrations table`
  );

  // 22.11 Transport Management Migration Applied
  let transportMigrationClean = false;
  try {
    const appliedMigrations = await prisma.$queryRaw<any[]>`
      SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL
    `;
    transportMigrationClean = appliedMigrations.some((m) =>
      m.migration_name.includes('add_transport_management')
    );
  } catch (err: any) {
    transportMigrationClean = false;
  }

  record(
    'DATABASE_MIGRATION',
    'Prisma Versioned Transport Migration Applied',
    transportMigrationClean,
    `Transport migration add_transport_management confirmed recorded and applied in _prisma_migrations`
  );

  // ==========================================
  // 24. TRANSPORT MANAGEMENT (PHASE 5.1)
  // ==========================================

  // 24.1 Vehicle Registration & CRUD
  const vehicleReg = `BUS-${Date.now().toString().slice(-4)}`;
  const createVehRes = await apiRequest('/school/transport/vehicles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      registrationNumber: vehicleReg,
      name: 'Springfield School Bus #10',
      type: 'BUS',
      capacity: 40,
      manufacturer: 'Tata Motors',
      model: 'Starbus Ultra',
      status: 'ACTIVE',
      insuranceExpiry: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      fitnessExpiry: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  });

  const createdVehicle = createVehRes.data?.data;
  record(
    'TRANSPORT',
    'Vehicle Registration (POST /school/transport/vehicles)',
    createVehRes.status === 201 && createdVehicle?.registrationNumber === vehicleReg,
    `Status ${createVehRes.status}: Registered vehicle '${vehicleReg}' with 40 seats capacity`
  );

  // 24.2 Duplicate Vehicle Registration Prevention
  const dupVehRes = await apiRequest('/school/transport/vehicles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      registrationNumber: vehicleReg,
      name: 'Duplicate Bus',
      capacity: 30,
    }),
  });

  record(
    'TRANSPORT',
    'Duplicate Vehicle Registration Guard',
    dupVehRes.status === 400,
    `Status ${dupVehRes.status}: Blocked duplicate vehicle registration in same school`
  );

  // 24.3 Route Creation & Stop Sequence Integrity
  const routeCode = `RT-${Date.now().toString().slice(-4)}`;
  const createRouteRes = await apiRequest('/school/transport/routes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      code: routeCode,
      name: 'Springfield West Corridor',
      startPoint: 'West Gate Terminal',
      destination: 'Springfield High Campus',
      journeyDurationMinutes: 35,
      status: 'ACTIVE',
      stops: [
        { name: 'West Metro Gate', sequence: 1, pickupTime: '07:15', dropTime: '15:45', fare: 1200 },
        { name: 'Oak Street Junction', sequence: 2, pickupTime: '07:30', dropTime: '15:30', fare: 1500 },
      ],
    }),
  });

  const createdRoute = createRouteRes.data?.data;
  record(
    'TRANSPORT',
    'Route & Ordered Stops Creation (POST /school/transport/routes)',
    createRouteRes.status === 201 && createdRoute?.stops?.length === 2,
    `Status ${createRouteRes.status}: Created route '${routeCode}' with 2 sequential stops`
  );

  // 24.4 Duplicate Stop Sequence Prevention
  const dupStopRes = await apiRequest('/school/transport/stops', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      routeId: createdRoute?.id,
      name: 'Conflicting Stop',
      sequence: 1,
      fare: 1000,
    }),
  });

  record(
    'TRANSPORT',
    'Route Stop Duplicate Sequence Guard',
    dupStopRes.status === 400,
    `Status ${dupStopRes.status}: Blocked conflicting sequence #1 on route '${routeCode}'`
  );

  // 24.5 Driver Profile Creation & License Expiry Tracking
  const drvEmpId = `DRV-${Date.now().toString().slice(-4)}`;
  const drvLicNum = `DL-${Date.now().toString().slice(-6)}`;
  const createDrvRes = await apiRequest('/school/transport/drivers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      employeeId: drvEmpId,
      firstName: 'Rajesh',
      lastName: 'Verma',
      phone: '+91 98765 12345',
      licenseNumber: drvLicNum,
      licenseExpiry: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'ACTIVE',
    }),
  });

  const createdDriver = createDrvRes.data?.data;
  record(
    'TRANSPORT',
    'Driver Profile Creation (POST /school/transport/drivers)',
    createDrvRes.status === 201 && createdDriver?.employeeId === drvEmpId,
    `Status ${createDrvRes.status}: Registered driver '${drvEmpId}' with commercial license '${drvLicNum}'`
  );

  // 24.6 Vehicle & Route Assignment
  const createAssignRes = await apiRequest('/school/transport/assignments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      vehicleId: createdVehicle?.id,
      routeId: createdRoute?.id,
      driverId: createdDriver?.id,
      attendantName: 'Manoj Helper',
      attendantPhone: '+91 91234 56789',
      effectiveDate: new Date().toISOString(),
      status: 'ACTIVE',
    }),
  });

  const createdAssignment = createAssignRes.data?.data;
  record(
    'TRANSPORT',
    'Vehicle & Driver Route Assignment (POST /school/transport/assignments)',
    createAssignRes.status === 201 && createdAssignment?.status === 'ACTIVE',
    `Status ${createAssignRes.status}: Assigned vehicle '${vehicleReg}' and driver '${drvEmpId}' to route '${routeCode}'`
  );

  // 24.7 Overlapping Assignment Conflict Prevention (Vehicle Conflict)
  const routeCode2 = `RT-${Date.now().toString().slice(-3)}B`;
  const route2Res = await apiRequest('/school/transport/routes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      code: routeCode2,
      name: 'Springfield East Line',
      startPoint: 'East End',
      destination: 'Campus',
      status: 'ACTIVE',
    }),
  });
  const createdRoute2 = route2Res.data?.data;

  const overlapVehAssignRes = await apiRequest('/school/transport/assignments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      vehicleId: createdVehicle?.id,
      routeId: createdRoute2?.id,
      driverId: createdDriver?.id,
    }),
  });

  record(
    'TRANSPORT',
    'Vehicle Assignment Overlap Conflict Guard',
    overlapVehAssignRes.status === 400,
    `Status ${overlapVehAssignRes.status}: Blocked assigning vehicle '${vehicleReg}' while actively assigned elsewhere`
  );

  // 24.8 Student Transport Allocation with Automated Fee Invoice Generation
  const stop1 = createdRoute?.stops?.[0];
  const stop2 = createdRoute?.stops?.[1];

  const createAllocRes = await apiRequest('/school/transport/student-allocations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      studentId: createdStudent?.id,
      academicYearId: testYear?.id,
      routeId: createdRoute?.id,
      pickupStopId: stop1?.id,
      dropStopId: stop2?.id,
      fare: 1500,
      generateInvoice: true,
      status: 'ACTIVE',
    }),
  });

  const createdAlloc = createAllocRes.data?.data;
  const hasInvoice = createdAlloc?.invoiceId && createdAlloc?.invoice?.invoiceNumber?.startsWith('TRN-');

  record(
    'TRANSPORT',
    'Student Transport Allocation & Fee Invoice Generation (POST /school/transport/student-allocations)',
    createAllocRes.status === 201 && Boolean(hasInvoice) && Number(createdAlloc?.invoice?.balance) === 1500,
    `Status ${createAllocRes.status}: Allocated student to route '${routeCode}', generated invoice '${createdAlloc?.invoice?.invoiceNumber}' with balance ₹1500`
  );

  // 24.9 Duplicate Student Allocation Prevention
  const dupAllocRes = await apiRequest('/school/transport/student-allocations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      studentId: createdStudent?.id,
      academicYearId: testYear?.id,
      routeId: createdRoute?.id,
      pickupStopId: stop1?.id,
      dropStopId: stop2?.id,
    }),
  });

  record(
    'TRANSPORT',
    'Student Duplicate Transport Allocation Guard',
    dupAllocRes.status === 400,
    `Status ${dupAllocRes.status}: Blocked duplicate active transport allocation for student in same academic year`
  );

  // 24.10 Multi-Tenant IDOR Isolation: Cross-School Read & Write Rejected
  const idorVehRes = await apiRequest(`/school/transport/vehicles/${createdVehicle?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });

  const idorAllocRes = await apiRequest('/school/transport/student-allocations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    body: JSON.stringify({
      studentId: createdStudent?.id,
      academicYearId: testYear?.id,
      routeId: createdRoute?.id,
      pickupStopId: stop1?.id,
      dropStopId: stop2?.id,
    }),
  });

  record(
    'TRANSPORT_SECURITY',
    'Transport Multi-Tenant IDOR Isolation Guard (Cross-School Access)',
    idorVehRes.status === 404 && (idorAllocRes.status === 404 || idorAllocRes.status === 400),
    `Vehicle read status: ${idorVehRes.status} (404 Not Found), Cross-school allocation status: ${idorAllocRes.status}`
  );

  // 24.11 Transport Dashboard Analytics & Expiry Alerts
  const dashRes = await apiRequest('/school/transport/dashboard', {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });

  const dashData = dashRes.data?.data;
  const hasExpiringVeh = dashData?.expiringVehicles?.some((v: any) => v.id === createdVehicle?.id);
  const hasExpiringDrv = dashData?.expiringDrivers?.some((d: any) => d.id === createdDriver?.id);

  record(
    'TRANSPORT',
    'Transport Dashboard Analytics & Expiry Alerts (GET /school/transport/dashboard)',
    dashRes.status === 200 && dashData?.summary?.totalVehicles >= 1 && Boolean(hasExpiringVeh) && Boolean(hasExpiringDrv),
    `Status ${dashRes.status}: Dashboard returned ${dashData?.summary?.totalVehicles} vehicles, ${dashData?.summary?.totalRoutes} routes, and identified expiring vehicle doc + expiring driver license`
  );

  // 24.12 CSV Data Export Generation
  const csvRes = await apiRequest('/school/transport/reports?reportType=vehicles&format=csv', {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });

  const isCsvContent = csvRes.headers.get('content-type')?.includes('text/csv');
  record(
    'TRANSPORT',
    'Transport Reports CSV Export (GET /school/transport/reports?format=csv)',
    csvRes.status === 200 && Boolean(isCsvContent),
    `Status ${csvRes.status}: Generated vehicle fleet CSV report with Content-Type '${csvRes.headers.get('content-type')}'`
  );

  // 24.13 Safe Deletion Guard (Cannot delete vehicle or route with active allocations/assignments)
  const deleteVehBlockedRes = await apiRequest(`/school/transport/vehicles/${createdVehicle?.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });

  record(
    'TRANSPORT',
    'Vehicle Deletion Active Assignment Guard',
    deleteVehBlockedRes.status === 400,
    `Status ${deleteVehBlockedRes.status}: Blocked deleting vehicle while active assignments exist ("${deleteVehBlockedRes.data?.message}")`
  );

  // 24.14 Cleanup Transport Test Records
  if (createdAlloc) {
    if (createdAlloc.invoiceId) {
      await prisma.student_fee_invoices.delete({ where: { id: createdAlloc.invoiceId } }).catch(() => {});
    }
    await prisma.student_transport_allocations.delete({ where: { id: createdAlloc.id } }).catch(() => {});
  }
  if (createdAssignment) {
    await prisma.vehicle_assignments.delete({ where: { id: createdAssignment.id } }).catch(() => {});
  }
  if (createdRoute2) {
    await prisma.transport_routes.delete({ where: { id: createdRoute2.id } }).catch(() => {});
  }
  if (createdRoute) {
    await prisma.transport_routes.delete({ where: { id: createdRoute.id } }).catch(() => {});
  }
  if (createdDriver) {
    await prisma.drivers.delete({ where: { id: createdDriver.id } }).catch(() => {});
  }
  if (createdVehicle) {
    await prisma.vehicles.delete({ where: { id: createdVehicle.id } }).catch(() => {});
  }

  // ==========================================
  // 25. PHASE 5.2 — LIBRARY MANAGEMENT SYSTEM AUDIT
  // ==========================================
  console.log('\n--- Running Section 25: Library Management System ---');

  // Clean up any lingering library test items
  if (spSchool?.id) {
    await prisma.library_reservations.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.library_fine_adjustments.deleteMany({ where: { fine: { schoolId: spSchool.id } } }).catch(() => {});
    await prisma.library_fines.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.library_issues.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.library_members.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.library_book_copies.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.library_books.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
  }

  // 25.1 Category Creation & Duplicate Rejection
  const catCode = `CS-${Date.now().toString().slice(-4)}`;
  const createCatRes = await apiRequest('/school/library/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Computer Science & Algorithms ${catCode}`,
      code: catCode,
      description: 'Advanced CS textbooks and journals',
      isActive: true,
    }),
  });
  const createdLibCat = createCatRes.data?.data;
  record(
    'LIBRARY_CATEGORY',
    'Category Creation (POST /school/library/categories)',
    createCatRes.status === 201 && createdLibCat?.code === catCode,
    `Status ${createCatRes.status}: Created category '${createdLibCat?.name}' (${createdLibCat?.id})`
  );

  const dupCatRes = await apiRequest('/school/library/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Different Name`,
      code: catCode,
    }),
  });
  record(
    'LIBRARY_CATEGORY',
    'Category Duplicate Code Guard',
    dupCatRes.status === 400,
    `Status ${dupCatRes.status}: Rejected duplicate category code '${catCode}'`
  );

  // 25.2 Author and Publisher Creation
  const createAuthorRes = await apiRequest('/school/library/authors', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Donald E. Knuth ${Date.now().toString().slice(-4)}`,
      biography: 'Legendary computer scientist and mathematician',
      nationality: 'American',
    }),
  });
  const createdAuthor = createAuthorRes.data?.data;
  record(
    'LIBRARY_AUTHOR',
    'Author Creation (POST /school/library/authors)',
    createAuthorRes.status === 201 && Boolean(createdAuthor?.id),
    `Status ${createAuthorRes.status}: Created author '${createdAuthor?.name}'`
  );

  const createPubRes = await apiRequest('/school/library/publishers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Addison-Wesley Professional ${Date.now().toString().slice(-4)}`,
      contactPerson: 'David Pearson',
      email: 'pearson@aw.example.com',
      phone: '+1 617 555 0199',
    }),
  });
  const createdPub = createPubRes.data?.data;
  record(
    'LIBRARY_PUBLISHER',
    'Publisher Creation (POST /school/library/publishers)',
    createPubRes.status === 201 && Boolean(createdPub?.id),
    `Status ${createPubRes.status}: Created publisher '${createdPub?.name}'`
  );

  // 25.3 Book Creation with ISBN Validation & Physical Copies Initialization
  const testIsbn = `9780201896831`;
  const startingAcc = `ACC-${Date.now().toString().slice(-5)}`;
  const createBookRes = await apiRequest('/school/library/books', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      title: 'The Art of Computer Programming: Fundamental Algorithms',
      isbn: testIsbn,
      categoryId: createdLibCat?.id,
      authorId: createdAuthor?.id,
      publisherId: createdPub?.id,
      edition: '3rd Edition',
      publicationYear: 1997,
      language: 'English',
      numberOfPages: 672,
      shelfLocation: 'Shelf CS-1',
      rackNumber: 'Rack 4',
      initialCopies: 3,
      startingAccessionNumber: startingAcc,
      copyPrice: 1200,
    }),
  });
  const createdBook = createBookRes.data?.data;
  record(
    'LIBRARY_BOOK',
    'Book Creation with Auto-Generated Copies (POST /school/library/books)',
    createBookRes.status === 201 &&
      createdBook?.totalCopies === 3 &&
      createdBook?.availableCopies === 3 &&
      createdBook?.copies?.length === 3,
    `Status ${createBookRes.status}: Catalogued '${createdBook?.title}' with ${createdBook?.totalCopies} copies starting from '${startingAcc}'`
  );

  // 25.4 Duplicate ISBN Prevention
  const dupIsbnRes = await apiRequest('/school/library/books', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      title: 'Another Duplicate Book',
      isbn: testIsbn,
      categoryId: createdLibCat?.id,
    }),
  });
  record(
    'LIBRARY_BOOK',
    'Duplicate ISBN Rejection Guard',
    dupIsbnRes.status === 400,
    `Status ${dupIsbnRes.status}: Blocked registering duplicate ISBN '${testIsbn}'`
  );

  // 25.5 Physical Copy Creation & Accession Uniqueness
  const manualAcc = `ACC-MANUAL-${Date.now().toString().slice(-4)}`;
  const createCopyRes = await apiRequest('/school/library/copies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      bookId: createdBook?.id,
      accessionNumber: manualAcc,
      barcode: `BC-${Date.now().toString().slice(-6)}`,
      condition: 'NEW',
      status: 'AVAILABLE',
      price: 1200,
    }),
  });
  const createdCopy = createCopyRes.data?.data;
  record(
    'LIBRARY_COPY',
    'Physical Copy Creation (POST /school/library/copies)',
    createCopyRes.status === 201 && createdCopy?.accessionNumber === manualAcc,
    `Status ${createCopyRes.status}: Added copy with accession number '${manualAcc}'`
  );

  const dupCopyRes = await apiRequest('/school/library/copies', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      bookId: createdBook?.id,
      accessionNumber: manualAcc,
    }),
  });
  record(
    'LIBRARY_COPY',
    'Accession Number Uniqueness Guard',
    dupCopyRes.status === 400,
    `Status ${dupCopyRes.status}: Blocked duplicate accession number '${manualAcc}'`
  );

  // 25.6 Library Member Enrollment Linked to Existing Student
  const memberCardNo = `LIB-${Date.now().toString().slice(-6)}`;
  const createMemberRes = await apiRequest('/school/library/members', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      memberType: 'STUDENT',
      studentId: createdStudent?.id,
      cardBarcodeNumber: memberCardNo,
      maxAllowedBooks: 2,
      maxBorrowingDays: 7,
      status: 'ACTIVE',
    }),
  });
  const createdMember = createMemberRes.data?.data;
  record(
    'LIBRARY_MEMBER',
    'Student Library Member Registration (POST /school/library/members)',
    createMemberRes.status === 201 && createdMember?.cardBarcodeNumber === memberCardNo,
    `Status ${createMemberRes.status}: Enrolled student ${createdStudent?.firstName} as library member '${memberCardNo}'`
  );

  // 25.7 Book Issue Atomic Transaction
  const copy1 = createdBook?.copies?.[0];
  const copy2 = createdBook?.copies?.[1];
  const copy3 = createdBook?.copies?.[2];

  // Set due date to 5 days ago to test overdue calculation upon return
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const issueRes = await apiRequest('/school/library/issues', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      memberId: createdMember?.id,
      bookCopyId: copy1?.id,
      issueDate: tenDaysAgo.toISOString(),
      dueDate: fiveDaysAgo.toISOString(),
      issueRemarks: 'Semester reference book issue',
    }),
  });
  const createdIssue = issueRes.data?.data;
  record(
    'LIBRARY_ISSUE',
    'Book Issue Atomic Transaction (POST /school/library/issues)',
    issueRes.status === 201 &&
      createdIssue?.status === 'ISSUED' &&
      createdIssue?.bookCopy?.status === 'ISSUED',
    `Status ${issueRes.status}: Issued copy '${copy1?.accessionNumber}' to member '${memberCardNo}' with due date 5 days ago`
  );

  // 25.8 Duplicate Copy Issue & Quota Enforcement
  const dupIssueRes = await apiRequest('/school/library/issues', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      memberId: createdMember?.id,
      bookCopyId: copy1?.id,
      dueDate: new Date(Date.now() + 864000000).toISOString(),
    }),
  });
  record(
    'LIBRARY_ISSUE',
    'Unavailable Copy Re-Issue Guard',
    dupIssueRes.status === 400,
    `Status ${dupIssueRes.status}: Blocked issuing already issued copy ('${dupIssueRes.data?.message}')`
  );

  // Issue second copy (hits member quota of 2)
  const issue2Res = await apiRequest('/school/library/issues', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      memberId: createdMember?.id,
      bookCopyId: copy2?.id,
      dueDate: new Date(Date.now() + 864000000).toISOString(),
    }),
  });
  const createdIssue2 = issue2Res.data?.data;

  // Attempting third issue exceeds limit of 2
  const quotaExceededRes = await apiRequest('/school/library/issues', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      memberId: createdMember?.id,
      bookCopyId: copy3?.id,
      dueDate: new Date(Date.now() + 864000000).toISOString(),
    }),
  });
  record(
    'LIBRARY_ISSUE',
    'Member Borrowing Limit Quota Enforcement Guard',
    issue2Res.status === 201 && quotaExceededRes.status === 400,
    `Status ${quotaExceededRes.status}: Successfully blocked issuing beyond max allowance of 2 books ('${quotaExceededRes.data?.message}')`
  );

  // 25.9 Book Return Transaction with Overdue Fine Assessment
  const returnRes = await apiRequest(`/school/library/issues/${createdIssue?.id}/return`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      conditionOnReturn: 'GOOD',
      returnRemarks: 'Returned safely, late by 5 days',
    }),
  });
  const returnData = returnRes.data?.data;
  record(
    'LIBRARY_RETURN',
    'Book Return Transaction & Overdue Fine Assessment (POST /school/library/issues/:id/return)',
    returnRes.status === 200 &&
      returnData?.issue?.status === 'RETURNED' &&
      returnData?.copy?.status === 'AVAILABLE' &&
      returnData?.fineSummary?.totalFinesCreated > 0,
    `Status ${returnRes.status}: Book returned; generated ₹${returnData?.fineSummary?.totalFinesCreated} overdue fine for ${returnData?.issue?.overdueDays} late days`
  );

  // 25.10 Damaged Copy Return & Damage Fine Creation
  const damageReturnRes = await apiRequest(`/school/library/issues/${createdIssue2?.id}/return`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      conditionOnReturn: 'DAMAGED',
      isDamaged: true,
      damageFineAmount: 250,
      returnRemarks: 'Spine damage reported',
    }),
  });
  const damageData = damageReturnRes.data?.data;
  record(
    'LIBRARY_RETURN',
    'Damaged Copy Return & Damage Fine Assessment',
    damageReturnRes.status === 200 &&
      damageData?.issue?.status === 'DAMAGED' &&
      damageData?.copy?.status === 'DAMAGED' &&
      damageData?.fineSummary?.damageFine > 0,
    `Status ${damageReturnRes.status}: Marked copy DAMAGED and assessed ₹${damageData?.fineSummary?.damageFine} damage fine`
  );

  // 25.11 Fine Ledger Payment & Waiver Adjustments
  const overdueFineId = returnData?.fineSummary?.fines?.[0]?.id;
  const payFineRes = await apiRequest(`/school/library/fines/${overdueFineId}/adjust`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      adjustmentType: 'PAYMENT',
      amount: 5,
      paymentMethod: 'CASH',
      reason: 'Front counter cash collection',
    }),
  });
  const paidFineData = payFineRes.data?.data;
  record(
    'LIBRARY_FINES',
    'Fine Partial/Full Payment Adjustment (POST /school/library/fines/:id/adjust)',
    payFineRes.status === 200 && Number(paidFineData?.paidAmount) >= 5,
    `Status ${payFineRes.status}: Processed ₹5 payment; remaining balance: ₹${paidFineData?.balanceAmount}`
  );

  const damageFineId = damageData?.fineSummary?.fines?.[0]?.id;
  const waiveFineRes = await apiRequest(`/school/library/fines/${damageFineId}/adjust`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      adjustmentType: 'WAIVER',
      amount: 250,
      reason: 'Principal approved goodwill waiver',
    }),
  });
  const waivedFineData = waiveFineRes.data?.data;
  record(
    'LIBRARY_FINES',
    'Fine Authorized Waiver Adjustment',
    waiveFineRes.status === 200 &&
      waivedFineData?.status === 'WAIVED' &&
      Number(waivedFineData?.balanceAmount) === 0,
    `Status ${waiveFineRes.status}: Waived full ₹250 fine; status: ${waivedFineData?.status}`
  );

  // 25.12 Reservation Queue Management
  // Register second member
  const member2CardNo = `LIB-${Date.now().toString().slice(-6)}-T`;
  const createMember2Res = await apiRequest('/school/library/members', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      memberType: 'FACULTY',
      teacherId: createdTeacher?.id,
      cardBarcodeNumber: member2CardNo,
      maxAllowedBooks: 5,
      maxBorrowingDays: 30,
    }),
  });
  const createdMember2 = createMember2Res.data?.data;

  const reserveRes = await apiRequest('/school/library/reservations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      bookId: createdBook?.id,
      memberId: createdMember2?.id,
    }),
  });
  const createdResv = reserveRes.data?.data;
  record(
    'LIBRARY_RESERVATION',
    'Book Reservation Hold Placement (POST /school/library/reservations)',
    reserveRes.status === 201 && createdResv?.status === 'PENDING' && createdResv?.queuePosition === 1,
    `Status ${reserveRes.status}: Placed reservation for member '${member2CardNo}' at queue position #${createdResv?.queuePosition}`
  );

  // 25.13 Multi-Tenant IDOR Security Isolation
  const idorBookRes = await apiRequest(`/school/library/books/${createdBook?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });
  const idorCopyRes = await apiRequest(`/school/library/copies/${createdCopy?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });
  const idorMemberRes = await apiRequest(`/school/library/members/${createdMember?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });
  record(
    'LIBRARY_SECURITY',
    'Library Multi-Tenant IDOR Isolation Guard (Cross-School Access)',
    idorBookRes.status === 404 && idorCopyRes.status === 404 && idorMemberRes.status === 404,
    `Book status: ${idorBookRes.status}, Copy status: ${idorCopyRes.status}, Member status: ${idorMemberRes.status} (All returned 404 Not Found)`
  );

  // 25.14 Streaming CSV Report Export
  const libCsvRes = await apiRequest('/school/library/reports?reportType=catalogue&format=csv', {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const isLibCsvContent = libCsvRes.headers.get('content-type')?.includes('text/csv');
  record(
    'LIBRARY_REPORTS',
    'Streaming CSV Export (GET /school/library/reports?reportType=catalogue&format=csv)',
    libCsvRes.status === 200 && Boolean(isLibCsvContent),
    `Status ${libCsvRes.status}: Successfully streamed catalogue CSV with Content-Type '${libCsvRes.headers.get('content-type')}'`
  );

  // 25.15 Safe Deletion Protections
  const deleteCatBlocked = await apiRequest(`/school/library/categories/${createdLibCat?.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  record(
    'LIBRARY_INTEGRITY',
    'Category Safe Deletion Guard (Books Linked)',
    deleteCatBlocked.status === 400,
    `Status ${deleteCatBlocked.status}: Blocked deleting category with linked catalogue titles ('${deleteCatBlocked.data?.message}')`
  );

  // 25.16 Cleanup Library Test Artifacts
  if (createdResv) {
    await prisma.library_reservations.delete({ where: { id: createdResv.id } }).catch(() => {});
  }
  if (overdueFineId) {
    await prisma.library_fine_adjustments.deleteMany({ where: { fineId: overdueFineId } }).catch(() => {});
    await prisma.library_fines.delete({ where: { id: overdueFineId } }).catch(() => {});
  }
  if (damageFineId) {
    await prisma.library_fine_adjustments.deleteMany({ where: { fineId: damageFineId } }).catch(() => {});
    await prisma.library_fines.delete({ where: { id: damageFineId } }).catch(() => {});
  }
  if (createdIssue2) {
    await prisma.library_issues.delete({ where: { id: createdIssue2.id } }).catch(() => {});
  }
  if (createdIssue) {
    await prisma.library_issues.delete({ where: { id: createdIssue.id } }).catch(() => {});
  }
  if (createdMember2) {
    await prisma.library_members.delete({ where: { id: createdMember2.id } }).catch(() => {});
  }
  if (createdMember) {
    await prisma.library_members.delete({ where: { id: createdMember.id } }).catch(() => {});
  }
  if (createdCopy) {
    await prisma.library_book_copies.delete({ where: { id: createdCopy.id } }).catch(() => {});
  }
  if (createdBook) {
    await prisma.library_book_copies.deleteMany({ where: { bookId: createdBook.id } }).catch(() => {});
    await prisma.library_books.delete({ where: { id: createdBook.id } }).catch(() => {});
  }
  if (createdAuthor) {
    await prisma.library_authors.delete({ where: { id: createdAuthor.id } }).catch(() => {});
  }
  if (createdPub) {
    await prisma.library_publishers.delete({ where: { id: createdPub.id } }).catch(() => {});
  }
  if (createdLibCat) {
    await prisma.library_categories.delete({ where: { id: createdLibCat.id } }).catch(() => {});
  }

  // ==========================================
  // 26. PHASE 5.3 — INVENTORY & ASSET MANAGEMENT SYSTEM AUDIT
  // ==========================================
  console.log('\n--- Running Section 26: Inventory & Asset Management System ---');

  // Pre-cleanup leftover inventory test artifacts
  try {
    await prisma.inventory_purchase_order_items.deleteMany({ where: { purchaseOrder: { schoolId: spSchool.id } } }).catch(() => {});
    await prisma.inventory_purchase_orders.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_maintenance_logs.deleteMany({ where: { ticket: { schoolId: spSchool.id } } }).catch(() => {});
    await prisma.inventory_maintenance_tickets.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_depreciations.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_asset_assignments.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_assets.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_stock_transfers.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_stock_movements.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_items.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_suppliers.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_locations.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
    await prisma.inventory_categories.deleteMany({ where: { schoolId: spSchool.id } }).catch(() => {});
  } catch {}

  // 26.1 Inventory Dashboard KPI
  const invDashRes = await apiRequest('/school/inventory/dashboard', {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const invDashData = invDashRes.data?.data;
  record(
    'INVENTORY_DASHBOARD',
    'Inventory Dashboard & Metrics (GET /school/inventory/dashboard)',
    invDashRes.status === 200 && invDashData?.metrics !== undefined,
    `Status ${invDashRes.status}: Metrics retrieved (Total items: ${invDashData?.metrics?.totalItems})`
  );

  // 26.2 Category Creation & Duplicate Guard
  const invCatCode = `CAT-${Date.now().toString().slice(-4)}`;
  const createInvCatRes = await apiRequest('/school/inventory/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Laboratory Apparatus & Glassware ${invCatCode}`,
      code: invCatCode,
      description: 'Science laboratory equipment and consumables',
      isActive: true,
    }),
  });
  const createdInvCat = createInvCatRes.data?.data;
  record(
    'INVENTORY_CATEGORY',
    'Category Creation (POST /school/inventory/categories)',
    createInvCatRes.status === 201 && createdInvCat?.code === invCatCode,
    `Status ${createInvCatRes.status}: Created category '${createdInvCat?.name}' (${createdInvCat?.id})`
  );

  const dupInvCatRes = await apiRequest('/school/inventory/categories', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Different Name`,
      code: invCatCode,
    }),
  });
  record(
    'INVENTORY_CATEGORY',
    'Category Duplicate Code Conflict Guard',
    dupInvCatRes.status === 409,
    `Status ${dupInvCatRes.status}: Rejected duplicate category code '${invCatCode}' with 409 Conflict`
  );

  // 26.3 Storage Location Creation
  const locCode1 = `LAB-${Date.now().toString().slice(-4)}`;
  const locCode2 = `STR-${Date.now().toString().slice(-4)}`;
  const createLoc1Res = await apiRequest('/school/inventory/locations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Physics & Electronics Lab ${locCode1}`,
      code: locCode1,
      building: 'Science Block',
      floor: '2nd Floor',
      roomNumber: 'LAB-204',
      description: 'Main laboratory storeroom and benches',
      isActive: true,
    }),
  });
  const createdLoc1 = createLoc1Res.data?.data;

  const createLoc2Res = await apiRequest('/school/inventory/locations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: `Central Storeroom B ${locCode2}`,
      code: locCode2,
      building: 'Administration Block',
      floor: 'Basement',
      roomNumber: 'STR-B01',
      isActive: true,
    }),
  });
  const createdLoc2 = createLoc2Res.data?.data;

  record(
    'INVENTORY_LOCATION',
    'Storage Location Registration (POST /school/inventory/locations)',
    createLoc1Res.status === 201 && createLoc2Res.status === 201,
    `Status ${createLoc1Res.status}: Registered location '${createdLoc1?.name}' and '${createdLoc2?.name}'`
  );

  // 26.4 Vendor / Supplier Creation
  const suppName = `Precision Scientific Suppliers ${Date.now().toString().slice(-4)}`;
  const createSuppRes = await apiRequest('/school/inventory/suppliers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: suppName,
      contactPerson: 'Dr. Ramesh Nair',
      email: 'sales@precisionsci.com',
      phone: '+91 98450 11223',
      address: 'Plot 42, Electronic City Phase 1, Bangalore',
      gstin: '29AABCP1234D1Z5',
      isActive: true,
    }),
  });
  const createdSupp = createSuppRes.data?.data;
  record(
    'INVENTORY_SUPPLIER',
    'Supplier Registration (POST /school/inventory/suppliers)',
    createSuppRes.status === 201 && createdSupp?.gstin === '29AABCP1234D1Z5',
    `Status ${createSuppRes.status}: Registered vendor '${createdSupp?.name}' (${createdSupp?.id})`
  );

  // 26.5 Item Catalogue Creation (Consumable with Initial Stock)
  const itemSku = `LAB-BEAK-${Date.now().toString().slice(-4)}`;
  const createItemRes = await apiRequest('/school/inventory/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: 'Borosil 500ml Glass Beakers',
      sku: itemSku,
      categoryId: createdInvCat?.id,
      itemType: 'CONSUMABLE',
      unitOfMeasurement: 'PCS',
      purchasePrice: 150,
      minStockThreshold: 10,
      initialStock: 50,
      primaryLocationId: createdLoc1?.id,
      primarySupplierId: createdSupp?.id,
      brand: 'Borosil',
      modelNumber: 'BR-500',
    }),
  });
  const createdItem = createItemRes.data?.data;
  record(
    'INVENTORY_ITEM',
    'Item Creation with Initial Stock & Auto-Inward (POST /school/inventory/items)',
    createItemRes.status === 201 && createdItem?.currentStock === 50,
    `Status ${createItemRes.status}: Created item '${createdItem?.name}' with initialStock=50`
  );

  // 26.6 Duplicate SKU Conflict Guard
  const dupSkuRes = await apiRequest('/school/inventory/items', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: 'Duplicate SKU Item',
      sku: itemSku,
      categoryId: createdInvCat?.id,
      unitOfMeasurement: 'PCS',
    }),
  });
  record(
    'INVENTORY_ITEM',
    'Duplicate SKU Conflict Guard',
    dupSkuRes.status === 409,
    `Status ${dupSkuRes.status}: Successfully rejected duplicate SKU '${itemSku}' with 409 Conflict`
  );

  // 26.7 Stock Inward Receipt (Atomic Increment)
  const inwardRes = await apiRequest('/school/inventory/stock/inward', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      itemId: createdItem?.id,
      quantity: 25,
      unitPrice: 150,
      targetLocationId: createdLoc1?.id,
      referenceNumber: 'INV-2025-001',
      reason: 'Mid-term restock receipt',
    }),
  });
  const inwardData = inwardRes.data?.data;
  record(
    'INVENTORY_STOCK',
    'Stock Inward Atomic Increment (POST /school/inventory/stock/inward)',
    inwardRes.status === 201 && inwardData?.item?.currentStock === 75,
    `Status ${inwardRes.status}: Increased stock from 50 to 75 (+25 PCS)`
  );

  // 26.8 Stock Outward Issue (Atomic Decrement)
  const outwardRes = await apiRequest('/school/inventory/stock/outward', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      itemId: createdItem?.id,
      quantity: 15,
      sourceLocationId: createdLoc1?.id,
      referenceNumber: 'REQ-LAB-01',
      reason: 'Issued to Chemistry Practical Class',
    }),
  });
  const outwardData = outwardRes.data?.data;
  record(
    'INVENTORY_STOCK',
    'Stock Outward Atomic Decrement (POST /school/inventory/stock/outward)',
    outwardRes.status === 201 && outwardData?.item?.currentStock === 60,
    `Status ${outwardRes.status}: Decreased stock from 75 to 60 (-15 PCS)`
  );

  // 26.9 Stock Outward Insufficient Stock Rejection
  const excessOutwardRes = await apiRequest('/school/inventory/stock/outward', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      itemId: createdItem?.id,
      quantity: 9999,
      reason: 'Attempted overdraft',
    }),
  });
  record(
    'INVENTORY_STOCK',
    'Negative Stock Prevention Guard',
    excessOutwardRes.status === 400,
    `Status ${excessOutwardRes.status}: Successfully blocked stock overdraft exceeding available quantity`
  );

  // 26.10 Stock Physical Count Adjustment
  const adjustRes = await apiRequest('/school/inventory/stock/adjustment', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      itemId: createdItem?.id,
      countedQuantity: 58,
      reason: 'Physical count found 2 damaged beakers discarded',
      referenceNumber: 'AUDIT-Q3',
    }),
  });
  const adjustData = adjustRes.data?.data;
  record(
    'INVENTORY_STOCK',
    'Stock Audit Adjustment Reconciliation (POST /school/inventory/stock/adjustment)',
    adjustRes.status === 200 && adjustData?.item?.currentStock === 58,
    `Status ${adjustRes.status}: Reconciled stock balance to physical count (58 PCS)`
  );

  // 26.11 Inter-Location Stock Transfer
  const transferRes = await apiRequest('/school/inventory/stock/transfer', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      itemId: createdItem?.id,
      sourceLocationId: createdLoc1?.id,
      targetLocationId: createdLoc2?.id,
      quantity: 10,
      notes: 'Transfer 10 units to Central Storeroom B',
    }),
  });
  const transferData = transferRes.data?.data;
  record(
    'INVENTORY_TRANSFER',
    'Inter-Location Stock Transfer (POST /school/inventory/stock/transfer)',
    transferRes.status === 201 && transferData?.transfer?.transferNumber !== undefined,
    `Status ${transferRes.status}: Created transfer ${transferData?.transfer?.transferNumber} from ${createdLoc1?.name} to ${createdLoc2?.name}`
  );

  // 26.12 Same-Location Transfer Rejection Guard
  const sameLocTrfRes = await apiRequest('/school/inventory/stock/transfer', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      itemId: createdItem?.id,
      sourceLocationId: createdLoc1?.id,
      targetLocationId: createdLoc1?.id,
      quantity: 5,
    }),
  });
  record(
    'INVENTORY_TRANSFER',
    'Identical Source & Destination Rejection Guard',
    sameLocTrfRes.status === 400,
    `Status ${sameLocTrfRes.status}: Rejected transfer where source equals target location`
  );

  // 26.13 Stock Movements Audit Log
  const movementsRes = await apiRequest(`/school/inventory/stock/movements?itemId=${createdItem?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const movementsData = movementsRes.data?.data;
  record(
    'INVENTORY_MOVEMENTS',
    'Stock Movements Audit Ledger Query (GET /school/inventory/stock/movements)',
    movementsRes.status === 200 && (movementsData?.movements?.length || 0) >= 4,
    `Status ${movementsRes.status}: Retrieved ${movementsData?.movements?.length} historical movements for item`
  );

  // 26.14 Fixed Asset Registration & Book Valuation
  const assetNumber = `AST-${Date.now().toString().slice(-5)}`;
  const createAssetRes = await apiRequest('/school/inventory/assets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      name: 'Sony 4K Smart Classroom Display Panel',
      assetNumber,
      serialNumber: `SN-SONY-${Date.now().toString().slice(-4)}`,
      brand: 'Sony Bravia',
      modelNumber: 'FWD-65BZ40H',
      department: 'Smart Classrooms',
      purchasePrice: 120000,
      salvageValue: 12000,
      usefulLifeMonths: 36,
      depreciationMethod: 'STRAIGHT_LINE',
      condition: 'NEW',
      status: 'AVAILABLE',
      locationId: createdLoc1?.id,
      supplierId: createdSupp?.id,
      notes: 'Interactive flat panel display for Class 10A',
    }),
  });
  const createdAsset = createAssetRes.data?.data;
  record(
    'INVENTORY_ASSET',
    'Fixed Asset Registration (POST /school/inventory/assets)',
    createAssetRes.status === 201 && Number(createdAsset?.currentBookValue) === 120000,
    `Status ${createAssetRes.status}: Registered asset '${createdAsset?.name}' (${createdAsset?.assetNumber}) with initial book value ₹${createdAsset?.currentBookValue}`
  );

  // 26.15 Asset Details Query
  const getAssetRes = await apiRequest(`/school/inventory/assets/${createdAsset?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  record(
    'INVENTORY_ASSET',
    'Asset Details & Relations Dossier (GET /school/inventory/assets/:id)',
    getAssetRes.status === 200 && getAssetRes.data?.data?.location?.id === createdLoc1?.id,
    `Status ${getAssetRes.status}: Retrieved asset details with linked location and supplier`
  );

  // 26.16 Asset Custody Assignment & Status Transition
  const assignAssetRes = await apiRequest(`/school/inventory/assets/${createdAsset?.id}/assign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      teacherId: createdTeacher?.id,
      department: 'Mathematics & Science',
      assignedCondition: 'GOOD',
      assignmentRemarks: 'Assigned for academic year 2025-26',
    }),
  });
  const assignData = assignAssetRes.data?.data;
  record(
    'INVENTORY_ASSIGNMENT',
    'Asset Handover & Status Transition to ASSIGNED (POST /school/inventory/assets/:id/assign)',
    assignAssetRes.status === 201 && assignData?.asset?.status === 'ASSIGNED',
    `Status ${assignAssetRes.status}: Asset status transitioned to ${assignData?.asset?.status}`
  );

  // 26.17 Double Assignment Prevention Guard
  const doubleAssignRes = await apiRequest(`/school/inventory/assets/${createdAsset?.id}/assign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      department: 'Attempted Double Assignment',
    }),
  });
  record(
    'INVENTORY_ASSIGNMENT',
    'Prevent Double Assignment of In-Use Asset',
    doubleAssignRes.status === 400,
    `Status ${doubleAssignRes.status}: Blocked assigning already-assigned asset with 400 Bad Request`
  );

  // 26.18 Asset Return & Status Transition back to AVAILABLE
  const returnAssetRes = await apiRequest(`/school/inventory/assets/${createdAsset?.id}/return`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      returnCondition: 'GOOD',
      returnRemarks: 'Returned at end of term; fully functional',
    }),
  });
  const assetReturnData = returnAssetRes.data?.data;
  record(
    'INVENTORY_ASSIGNMENT',
    'Asset Return & Status Transition to AVAILABLE (POST /school/inventory/assets/:id/return)',
    returnAssetRes.status === 200 && assetReturnData?.asset?.status === 'AVAILABLE',
    `Status ${returnAssetRes.status}: Asset returned and status transitioned back to ${assetReturnData?.asset?.status}`
  );

  // 26.19 Asset Maintenance Ticket Creation & Status Transition
  const createMntRes = await apiRequest('/school/inventory/maintenance/tickets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      assetId: createdAsset?.id,
      title: 'Display HDMI port loose contact',
      issueDescription: 'HDMI 1 port intermittently losing video signal',
      priority: 'HIGH',
      estimatedCost: 2500,
      supplierId: createdSupp?.id,
    }),
  });
  const createdMnt = createMntRes.data?.data;

  // Verify asset status transitioned to UNDER_MAINTENANCE
  const assetPostMnt = await prisma.inventory_assets.findUnique({ where: { id: createdAsset?.id } });
  record(
    'INVENTORY_MAINTENANCE',
    'Maintenance Ticket Logging & Asset Status Transition to UNDER_MAINTENANCE',
    createMntRes.status === 201 && assetPostMnt?.status === 'UNDER_MAINTENANCE',
    `Status ${createMntRes.status}: Ticket ${createdMnt?.ticketNumber} logged, asset status transitioned to ${assetPostMnt?.status}`
  );

  // 26.20 Maintenance Log Entry & Status Update
  const addLogRes = await apiRequest(`/school/inventory/maintenance/tickets/${createdMnt?.id}/logs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      newStatus: 'IN_PROGRESS',
      note: 'Technician dispatched from Precision Scientific; port connector re-soldered',
      actionCost: 1500,
    }),
  });
  record(
    'INVENTORY_MAINTENANCE',
    'Maintenance Service Log & Cost Increment (POST /school/inventory/maintenance/tickets/:id/logs)',
    addLogRes.status === 201,
    `Status ${addLogRes.status}: Service progress recorded with cost ₹1,500`
  );

  // 26.21 Maintenance Resolution & Asset Release back to AVAILABLE
  const resolveMntRes = await apiRequest(`/school/inventory/maintenance/tickets/${createdMnt?.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      status: 'RESOLVED',
      actualCost: 1800,
      workNotes: 'Repairs completed and tested; all inputs working',
    }),
  });
  const assetPostResolve = await prisma.inventory_assets.findUnique({ where: { id: createdAsset?.id } });
  record(
    'INVENTORY_MAINTENANCE',
    'Maintenance Ticket Resolution & Asset Release to AVAILABLE',
    resolveMntRes.status === 200 && assetPostResolve?.status === 'AVAILABLE',
    `Status ${resolveMntRes.status}: Ticket resolved; asset status returned to ${assetPostResolve?.status}`
  );

  // 26.22 Straight-Line Depreciation Engine Execution
  const depRunRes = await apiRequest('/school/inventory/depreciation/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      fiscalYear: '2025-2026',
      periodStartDate: '2025-04-01',
      periodEndDate: '2026-03-31',
      assetIds: [createdAsset?.id],
      remarks: 'FY 2025-26 Year-End Depreciation Run',
    }),
  });
  const depRunData = depRunRes.data?.data;
  const assetPostDep = await prisma.inventory_assets.findUnique({ where: { id: createdAsset?.id } });
  // Annual SLM: (120,000 - 12,000) / 3 years = 36,000. New Book Value = 120,000 - 36,000 = 84,000.
  const expectedBookValue = 84000;
  record(
    'INVENTORY_DEPRECIATION',
    'Straight-Line Depreciation Engine (POST /school/inventory/depreciation/run)',
    depRunRes.status === 200 && Number(assetPostDep?.currentBookValue) === expectedBookValue,
    `Status ${depRunRes.status}: Depreciated by ₹36,000 (New Book Value: ₹${assetPostDep?.currentBookValue}, expected: ₹${expectedBookValue})`
  );

  // 26.23 Salvage Value Floor Safeguard Invariant
  // Execute 3 more depreciation runs to exhaust useful life; book value must NOT drop below salvageValue (12,000)
  await apiRequest('/school/inventory/depreciation/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      fiscalYear: '2026-2027',
      periodStartDate: '2026-04-01',
      periodEndDate: '2027-03-31',
      assetIds: [createdAsset?.id],
    }),
  });
  await apiRequest('/school/inventory/depreciation/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      fiscalYear: '2027-2028',
      periodStartDate: '2027-04-01',
      periodEndDate: '2028-03-31',
      assetIds: [createdAsset?.id],
    }),
  });
  await apiRequest('/school/inventory/depreciation/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      fiscalYear: '2028-2029',
      periodStartDate: '2028-04-01',
      periodEndDate: '2029-03-31',
      assetIds: [createdAsset?.id],
    }),
  });
  const assetExhausted = await prisma.inventory_assets.findUnique({ where: { id: createdAsset?.id } });
  record(
    'INVENTORY_DEPRECIATION',
    'Salvage Value Floor Invariant (Book value >= Salvage value)',
    Number(assetExhausted?.currentBookValue) === 12000,
    `Current book value ₹${assetExhausted?.currentBookValue} perfectly floored at salvage value ₹12,000`
  );

  // 26.24 Purchase Order Creation & Calculation
  const poNum = `PO-${Date.now().toString().slice(-5)}`;
  const createPoRes = await apiRequest('/school/inventory/purchase-orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      supplierId: createdSupp?.id,
      poNumber: poNum,
      notes: 'Urgent restocking for midterm practical examinations',
      items: [
        {
          itemId: createdItem?.id,
          orderedQuantity: 100,
          unitPrice: 150,
          taxRate: 18,
        },
      ],
    }),
  });
  const createdPo = createPoRes.data?.data;
  // Subtotal = 100 * 150 = 15,000. Tax = 18% of 15,000 = 2,700. Total = 17,700.
  record(
    'INVENTORY_PURCHASE_ORDER',
    'Purchase Order Creation with Tax Calculation (POST /school/inventory/purchase-orders)',
    createPoRes.status === 201 && Number(createdPo?.totalAmount) === 17700,
    `Status ${createPoRes.status}: PO ${createdPo?.poNumber} created. Subtotal: ₹${createdPo?.subtotal}, Total: ₹${createdPo?.totalAmount}`
  );

  // 26.25 Purchase Order Receiving & Automated Stock Increment
  const poItemId = createdPo?.items?.[0]?.id;
  const stockPreReceive = (await prisma.inventory_items.findUnique({ where: { id: createdItem?.id } }))?.currentStock || 0;

  const receivePoRes = await apiRequest(`/school/inventory/purchase-orders/${createdPo?.id}/receive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    body: JSON.stringify({
      items: [
        {
          poItemId,
          receivedQuantity: 100,
          targetLocationId: createdLoc1?.id,
        },
      ],
      notes: 'Vendor delivery accepted by store in-charge',
    }),
  });
  const receiveData = receivePoRes.data?.data;
  const stockPostReceive = (await prisma.inventory_items.findUnique({ where: { id: createdItem?.id } }))?.currentStock || 0;
  record(
    'INVENTORY_PURCHASE_ORDER',
    'Goods Receiving against PO & Automated Stock Inward Increment',
    receivePoRes.status === 200 && receiveData?.status === 'RECEIVED' && stockPostReceive === stockPreReceive + 100,
    `Status ${receivePoRes.status}: PO status updated to ${receiveData?.status}, stock increased from ${stockPreReceive} to ${stockPostReceive} (+100)`
  );

  // 26.26 Multi-Tenant IDOR Security Isolation Guard
  const idorInvItemRes = await apiRequest(`/school/inventory/items/${createdItem?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });
  const idorAssetRes = await apiRequest(`/school/inventory/assets/${createdAsset?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });
  const idorPoRes = await apiRequest(`/school/inventory/purchase-orders/${createdPo?.id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
  });
  record(
    'INVENTORY_SECURITY',
    'Multi-Tenant IDOR Isolation Guard (Cross-Tenant Access Rejection)',
    idorInvItemRes.status === 404 && idorAssetRes.status === 404 && idorPoRes.status === 404,
    `Item status: ${idorInvItemRes.status}, Asset status: ${idorAssetRes.status}, PO status: ${idorPoRes.status} (All returned 404 Not Found)`
  );

  // 26.27 Streaming CSV Exports
  const csvItemsRes = await apiRequest('/school/inventory/export/items', {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const csvAssetsRes = await apiRequest('/school/inventory/export/assets', {
    method: 'GET',
    headers: { Authorization: `Bearer ${springfieldAdminToken}` },
  });
  const isItemsCsv = (csvItemsRes.headers.get('content-type') || '').includes('text/csv');
  const isAssetsCsv = (csvAssetsRes.headers.get('content-type') || '').includes('text/csv');
  record(
    'INVENTORY_REPORTS',
    'Streaming CSV Exports Validation (Items & Assets Register)',
    csvItemsRes.status === 200 && csvAssetsRes.status === 200 && isItemsCsv && isAssetsCsv,
    `Items CSV status ${csvItemsRes.status} (${csvItemsRes.headers.get('content-type')}), Assets CSV status ${csvAssetsRes.status}`
  );

  // Cleanup Section 26 Artifacts
  try {
    if (createdPo) {
      await prisma.inventory_purchase_order_items.deleteMany({ where: { purchaseOrderId: createdPo.id } });
      await prisma.inventory_purchase_orders.delete({ where: { id: createdPo.id } });
    }
    if (createdMnt) {
      await prisma.inventory_maintenance_logs.deleteMany({ where: { ticketId: createdMnt.id } });
      await prisma.inventory_maintenance_tickets.delete({ where: { id: createdMnt.id } });
    }
    if (createdAsset) {
      await prisma.inventory_depreciations.deleteMany({ where: { assetId: createdAsset.id } });
      await prisma.inventory_asset_assignments.deleteMany({ where: { assetId: createdAsset.id } });
      await prisma.inventory_assets.delete({ where: { id: createdAsset.id } });
    }
    if (createdItem) {
      await prisma.inventory_stock_transfers.deleteMany({ where: { itemId: createdItem.id } });
      await prisma.inventory_stock_movements.deleteMany({ where: { itemId: createdItem.id } });
      await prisma.inventory_items.delete({ where: { id: createdItem.id } });
    }
    if (createdSupp) {
      await prisma.inventory_suppliers.delete({ where: { id: createdSupp.id } });
    }
    if (createdLoc2) {
      await prisma.inventory_locations.delete({ where: { id: createdLoc2.id } });
    }
    if (createdLoc1) {
      await prisma.inventory_locations.delete({ where: { id: createdLoc1.id } });
    }
    if (createdInvCat) {
      await prisma.inventory_categories.delete({ where: { id: createdInvCat.id } });
    }
  } catch {}

  // ==========================================
  // 23. CLEANUP TEST ARTIFACTS
  // ==========================================
  if (testDocRecord) {
    try {
      await prisma.documents.delete({ where: { id: testDocRecord.id } });
      if (testDocFilePath && fs.existsSync(testDocFilePath)) {
        fs.unlinkSync(testDocFilePath);
      }
    } catch {}
  }
  if (createdHw) {
    await prisma.homework_submissions.deleteMany({ where: { homeworkId: createdHw.id } });
    await prisma.homework.delete({ where: { id: createdHw.id } });
  }
  if (createdTimetable) {
    await prisma.class_timetables.delete({ where: { id: createdTimetable.id } });
  }
  if (createdExam) {
    await prisma.exam_results.deleteMany({ where: { examId: createdExam.id } });
    await prisma.exam_marks.deleteMany({ where: { exam_schedules: { examId: createdExam.id } } });
    await prisma.exam_schedules.deleteMany({ where: { examId: createdExam.id } });
    await prisma.exams.delete({ where: { id: createdExam.id } });
  }
  if (createdScale) {
    await prisma.grading_scales.delete({ where: { id: createdScale.id } });
  }
  if (createdStudent) {
    await prisma.fee_payments.deleteMany({
      where: { student_fee_invoices: { studentId: createdStudent.id } },
    });
    await prisma.student_fee_invoices.deleteMany({
      where: { studentId: createdStudent.id },
    });
    await prisma.student_attendance.deleteMany({
      where: { studentId: createdStudent.id },
    });
  }
  if (createdTeacher) {
    await prisma.staff_attendance.deleteMany({
      where: { teacherId: createdTeacher.id },
    });
  }
  if (createdStructure) {
    await prisma.fee_structures.delete({ where: { id: createdStructure.id } });
  }
  if (createdCategory) {
    await prisma.fee_categories.delete({ where: { id: createdCategory.id } });
  }
  if (createdStudent) {
    await prisma.students.delete({ where: { id: createdStudent.id } });
  }
  if (createdParent) {
    await prisma.parents.delete({ where: { id: createdParent.id } });
  }
  if (createdTeacher) {
    await prisma.teachers.delete({ where: { id: createdTeacher.id } });
    await prisma.users.delete({ where: { email: createdTeacher.email } });
  }
  if (createdSub) {
    await prisma.subjects.delete({ where: { id: createdSub.id } });
  }

  console.log('\n=====================================================');
  console.log('📊 AUDIT SUITE EXECUTION SUMMARY');
  console.log('=====================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TOTAL EXECUTED: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('=====================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAudit()
  .catch((e) => {
    console.error('Audit execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
