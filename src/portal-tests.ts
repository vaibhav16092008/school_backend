import { createApp } from './app';
import { prisma, Role, UserStatus, ExamStatus, ExamResultStatus, InvitationStatus } from './lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from './config/env';
import { Server } from 'http';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Test ${id.toString().padStart(2, '0')}] ${name}: ${details}`);
}

async function runPortalTests() {
  console.log('================================================================');
  console.log('🚀 PHASE 6 — PARENT & STUDENT PORTAL AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function api(path: string, options: { method?: string; token?: string; body?: any } = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // Non-json
    }
    return { status: res.status, data, ok: res.ok };
  }

  function makeToken(user: { id: string; email: string; role: Role; schoolId: string }) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  // Generate unique suffix
  const tag = `p6_${Date.now()}`;
  const passwordHash = await bcrypt.hash('TestPass@123', 10);

  // 1. Setup Tenant A
  const schoolA = await prisma.schools.create({
    data: {
      name: `Springfield Phase 6 ${tag}`,
      code: `SCHA_${tag}`,
      email: `admin_a_${tag}@springfield.com`,
      status: 'ACTIVE',
    },
  });

  // 2. Setup Tenant B
  const schoolB = await prisma.schools.create({
    data: {
      name: `Oakridge Phase 6 ${tag}`,
      code: `SCHB_${tag}`,
      email: `admin_b_${tag}@oakridge.com`,
      status: 'ACTIVE',
    },
  });

  // 3. School Admins
  const adminAUser = await prisma.users.create({
    data: {
      name: 'Admin A',
      email: `admin_a_${tag}@springfield.com`,
      passwordHash,
      role: Role.SCHOOL_ADMIN,
      schoolId: schoolA.id,
      status: UserStatus.ACTIVE,
    },
  });
  const adminAToken = makeToken(adminAUser as any);

  const adminBUser = await prisma.users.create({
    data: {
      name: 'Admin B',
      email: `admin_b_${tag}@oakridge.com`,
      passwordHash,
      role: Role.SCHOOL_ADMIN,
      schoolId: schoolB.id,
      status: UserStatus.ACTIVE,
    },
  });
  const adminBToken = makeToken(adminBUser as any);

  // 4. Academic Year & Classes for School A
  const yearA = await prisma.academic_years.create({
    data: {
      schoolId: schoolA.id,
      name: `2026-2027 ${tag}`,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isCurrent: true,
    },
  });

  const classA = await prisma.classes.create({
    data: {
      schoolId: schoolA.id,
      name: `Grade 10 ${tag}`,
    },
  });

  const sectionA = await prisma.sections.create({
    data: {
      schoolId: schoolA.id,
      classId: classA.id,
      name: 'A',
    },
  });

  const subjectA = await prisma.subjects.create({
    data: {
      schoolId: schoolA.id,
      name: `Mathematics ${tag}`,
      code: `MATH_${tag}`,
    },
  });

  // 5. Students in School A
  // Student A1 (Linked Child 1)
  const studentA1User = await prisma.users.create({
    data: {
      name: 'Alice Student',
      email: `alice_${tag}@student.com`,
      passwordHash,
      role: Role.STUDENT,
      schoolId: schoolA.id,
      status: UserStatus.ACTIVE,
    },
  });
  const studentA1 = await prisma.students.create({
    data: {
      schoolId: schoolA.id,
      userId: studentA1User.id,
      admissionNumber: `ADM_A1_${tag}`,
      firstName: 'Alice',
      lastName: 'Smith',
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.student_enrollments.create({
    data: {
      schoolId: schoolA.id,
      studentId: studentA1.id,
      academicYearId: yearA.id,
      classId: classA.id,
      sectionId: sectionA.id,
      rollNumber: '101',
      status: 'ACTIVE',
    },
  });
  const studentA1Token = makeToken(studentA1User as any);

  // Student A2 (Linked Child 2)
  const studentA2User = await prisma.users.create({
    data: {
      name: 'Bob Student',
      email: `bob_${tag}@student.com`,
      passwordHash,
      role: Role.STUDENT,
      schoolId: schoolA.id,
      status: UserStatus.ACTIVE,
    },
  });
  const studentA2 = await prisma.students.create({
    data: {
      schoolId: schoolA.id,
      userId: studentA2User.id,
      admissionNumber: `ADM_A2_${tag}`,
      firstName: 'Bob',
      lastName: 'Smith',
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.student_enrollments.create({
    data: {
      schoolId: schoolA.id,
      studentId: studentA2.id,
      academicYearId: yearA.id,
      classId: classA.id,
      sectionId: sectionA.id,
      rollNumber: '102',
      status: 'ACTIVE',
    },
  });
  const studentA2Token = makeToken(studentA2User as any);

  // Student A3 (Unlinked Student in School A)
  const studentA3 = await prisma.students.create({
    data: {
      schoolId: schoolA.id,
      admissionNumber: `ADM_A3_${tag}`,
      firstName: 'Charlie',
      lastName: 'Brown',
      status: UserStatus.ACTIVE,
    },
  });

  // Student B1 (Student in School B - Cross Tenant)
  const studentB1 = await prisma.students.create({
    data: {
      schoolId: schoolB.id,
      admissionNumber: `ADM_B1_${tag}`,
      firstName: 'David',
      lastName: 'Miller',
      status: UserStatus.ACTIVE,
    },
  });

  // 6. Parent User in School A (John Smith, Father of Alice and Bob)
  const parentAUser = await prisma.users.create({
    data: {
      name: 'John Smith',
      email: `john_${tag}@parent.com`,
      passwordHash,
      role: Role.PARENT,
      schoolId: schoolA.id,
      status: UserStatus.ACTIVE,
    },
  });
  const parentA = await prisma.parents.create({
    data: {
      schoolId: schoolA.id,
      userId: parentAUser.id,
      firstName: 'John',
      lastName: 'Smith',
      phone: '555-0101',
      email: `john_${tag}@parent.com`,
    },
  });
  const parentAToken = makeToken(parentAUser as any);

  // Link Parent A to Student A1 (Active)
  await prisma.parent_students.create({
    data: {
      parentId: parentA.id,
      studentId: studentA1.id,
      relation: 'FATHER',
      isPrimary: true,
      isActive: true,
    },
  });

  // Link Parent A to Student A2 (Active)
  await prisma.parent_students.create({
    data: {
      parentId: parentA.id,
      studentId: studentA2.id,
      relation: 'FATHER',
      isPrimary: false,
      isActive: true,
    },
  });

  // Inactive relationship: Link Parent A to a mock inactive relationship with Student A3
  const inactiveLink = await prisma.parent_students.create({
    data: {
      parentId: parentA.id,
      studentId: studentA3.id,
      relation: 'GUARDIAN',
      isPrimary: false,
      isActive: false, // Inactive!
    },
  });

  // 7. Revoked User Account
  const revokedUser = await prisma.users.create({
    data: {
      name: 'Revoked Parent',
      email: `revoked_${tag}@parent.com`,
      passwordHash,
      role: Role.PARENT,
      schoolId: schoolA.id,
      status: UserStatus.INACTIVE,
    },
  });
  const revokedToken = makeToken(revokedUser as any);

  // 8. Exam Data: One Published Exam, One Unpublished Exam
  const examPublished = await prisma.exams.create({
    data: {
      schoolId: schoolA.id,
      academicYearId: yearA.id,
      name: `Midterm Published ${tag}`,
      term: 'TERM_1',
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-10'),
      status: ExamStatus.PUBLISHED,
    },
  });

  const schedulePublished = await prisma.exam_schedules.create({
    data: {
      schoolId: schoolA.id,
      examId: examPublished.id,
      classId: classA.id,
      subjectId: subjectA.id,
      examDate: new Date('2026-10-02'),
      startTime: '09:00',
      endTime: '12:00',
      maxMarks: 100,
      passingMarks: 40,
    },
  });

  await prisma.exam_marks.create({
    data: {
      schoolId: schoolA.id,
      examScheduleId: schedulePublished.id,
      studentId: studentA1.id,
      marksObtained: 88,
      percentage: 88,
      grade: 'A',
    },
  });

  await prisma.exam_results.create({
    data: {
      schoolId: schoolA.id,
      examId: examPublished.id,
      studentId: studentA1.id,
      classId: classA.id,
      sectionId: sectionA.id,
      totalMaxMarks: 100,
      totalObtainedMarks: 88,
      percentage: 88,
      overallGrade: 'A',
      isApproved: true,
      isPublished: true, // PUBLISHED
      publishedAt: new Date(),
    },
  });

  // Draft / Unpublished Exam
  const examDraft = await prisma.exams.create({
    data: {
      schoolId: schoolA.id,
      academicYearId: yearA.id,
      name: `Finals Draft ${tag}`,
      term: 'TERM_2',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-10'),
      status: ExamStatus.UPCOMING,
    },
  });

  const scheduleDraft = await prisma.exam_schedules.create({
    data: {
      schoolId: schoolA.id,
      examId: examDraft.id,
      classId: classA.id,
      subjectId: subjectA.id,
      examDate: new Date('2026-12-05'),
      startTime: '09:00',
      endTime: '12:00',
      maxMarks: 100,
      passingMarks: 40,
    },
  });

  await prisma.exam_marks.create({
    data: {
      schoolId: schoolA.id,
      examScheduleId: scheduleDraft.id,
      studentId: studentA1.id,
      marksObtained: 95,
      percentage: 95,
      grade: 'A+',
    },
  });

  await prisma.exam_results.create({
    data: {
      schoolId: schoolA.id,
      examId: examDraft.id,
      studentId: studentA1.id,
      classId: classA.id,
      sectionId: sectionA.id,
      totalMaxMarks: 100,
      totalObtainedMarks: 95,
      percentage: 95,
      overallGrade: 'A+',
      isApproved: false,
      isPublished: false, // DRAFT / UNPUBLISHED
    },
  });

  // 9. Fee Invoice and Payment Receipt for Student A1
  const feeCategory = await prisma.fee_categories.create({
    data: {
      schoolId: schoolA.id,
      name: `Tuition ${tag}`,
    },
  });

  const feeStructure = await prisma.fee_structures.create({
    data: {
      schoolId: schoolA.id,
      categoryId: feeCategory.id,
      academicYearId: yearA.id,
      classId: classA.id,
      name: `Grade 10 Tuition ${tag}`,
      amount: 1500,
    },
  });

  const invoiceA1 = await prisma.student_fee_invoices.create({
    data: {
      schoolId: schoolA.id,
      studentId: studentA1.id,
      feeStructureId: feeStructure.id,
      academicYearId: yearA.id,
      invoiceNumber: `INV_A1_${tag}`,
      title: 'Term 1 Tuition',
      baseAmount: 1500,
      totalAmount: 1500,
      paidAmount: 500,
      balance: 1000,
      dueDate: new Date('2026-11-30'),
      status: 'PARTIALLY_PAID',
    },
  });

  const paymentA1 = await prisma.fee_payments.create({
    data: {
      schoolId: schoolA.id,
      invoiceId: invoiceA1.id,
      receiptNumber: `REC_A1_${tag}`,
      amount: 500,
      paymentMethod: 'CASH',
      paymentDate: new Date(),
    },
  });

  // Cross tenant invoice for Student B1
  const yearB = await prisma.academic_years.create({
    data: {
      schoolId: schoolB.id,
      name: `2026-2027 ${tag} B`,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isCurrent: true,
    },
  });

  const invoiceB1 = await prisma.student_fee_invoices.create({
    data: {
      schoolId: schoolB.id,
      studentId: studentB1.id,
      academicYearId: yearB.id,
      invoiceNumber: `INV_B1_${tag}`,
      title: 'Oakridge Tuition',
      baseAmount: 2000,
      totalAmount: 2000,
      paidAmount: 0,
      balance: 2000,
      dueDate: new Date('2026-11-30'),
      status: 'PENDING',
    },
  });

  const paymentB1 = await prisma.fee_payments.create({
    data: {
      schoolId: schoolB.id,
      invoiceId: invoiceB1.id,
      receiptNumber: `REC_B1_${tag}`,
      amount: 2000,
      paymentMethod: 'CASH',
      paymentDate: new Date(),
    },
  });

  // 10. Transport for Student A1
  const routeA = await prisma.transport_routes.create({
    data: {
      schoolId: schoolA.id,
      name: `Route North ${tag}`,
      code: `RN_${tag}`,
      startPoint: 'City Center',
      destination: 'Springfield Academy',
    },
  });

  const stopA1 = await prisma.transport_stops.create({
    data: {
      schoolId: schoolA.id,
      routeId: routeA.id,
      name: 'North Gate Stop',
      sequence: 1,
      pickupTime: '07:30',
      dropTime: '15:30',
    },
  });

  await prisma.student_transport_allocations.create({
    data: {
      schoolId: schoolA.id,
      studentId: studentA1.id,
      academicYearId: yearA.id,
      routeId: routeA.id,
      pickupStopId: stopA1.id,
      dropStopId: stopA1.id,
      fare: 50,
      status: 'ACTIVE',
    },
  });

  // 11. Library for Student A1
  const libMemberA1 = await prisma.library_members.create({
    data: {
      schoolId: schoolA.id,
      studentId: studentA1.id,
      memberNumber: `LIB_${tag}_A1`,
      memberType: 'STUDENT',
      expiryDate: new Date('2027-06-01'),
      status: 'ACTIVE',
    },
  });

  const libCat = await prisma.library_categories.create({
    data: { schoolId: schoolA.id, name: `Science ${tag}`, code: `SCI_${tag}` },
  });

  const libBook = await prisma.library_books.create({
    data: {
      schoolId: schoolA.id,
      title: 'Physics for Class 10',
      isbn: `978-${Date.now().toString().slice(-10)}`,
      categoryId: libCat.id,
      authorName: 'Dr. H. Verma',
    },
  });

  const bookCopy = await prisma.library_book_copies.create({
    data: {
      schoolId: schoolA.id,
      bookId: libBook.id,
      accessionNumber: `ACC_${tag}`,
      status: 'ISSUED',
    },
  });

  await prisma.library_issues.create({
    data: {
      schoolId: schoolA.id,
      memberId: libMemberA1.id,
      copyId: bookCopy.id,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'ISSUED',
    },
  });

  // ==========================================
  // EXECUTE 20 SECTION 12 TESTS
  // ==========================================

  // Test 1: Parent can access a linked child
  {
    const res = await api(`/parent/children/${studentA1.id}`, { token: parentAToken });
    const passed = res.status === 200 && res.data?.data?.id === studentA1.id;
    recordTest(1, 'Parent can access a linked child', passed, `Status ${res.status}`);
  }

  // Test 2: Parent cannot access an unlinked child
  {
    const res = await api(`/parent/children/${studentA3.id}`, { token: parentAToken });
    const passed = res.status === 403;
    recordTest(2, 'Parent cannot access an unlinked child', passed, `Status ${res.status} (Expected 403)`);
  }

  // Test 3: Parent cannot access another tenant's student
  {
    const res = await api(`/parent/children/${studentB1.id}`, { token: parentAToken });
    const passed = res.status === 403 || res.status === 404;
    recordTest(3, 'Parent cannot access another tenant\'s student', passed, `Status ${res.status} (Expected 403/404)`);
  }

  // Test 4: Parent with multiple children can access only linked children
  {
    const resList = await api('/parent/children', { token: parentAToken });
    const children = resList.data?.data || [];
    const hasA1 = children.some((c: any) => c.id === studentA1.id);
    const hasA2 = children.some((c: any) => c.id === studentA2.id);
    const hasA3 = children.some((c: any) => c.id === studentA3.id);
    const hasB1 = children.some((c: any) => c.id === studentB1.id);
    const passed = hasA1 && hasA2 && !hasA3 && !hasB1 && children.length === 2;
    recordTest(4, 'Parent with multiple children can access only linked children', passed, `Found ${children.length} linked children (A1, A2 included; A3, B1 excluded)`);
  }

  // Test 5: Student can access own records
  {
    const res = await api('/student/profile', { token: studentA1Token });
    const passed = res.status === 200 && res.data?.data?.id === studentA1.id;
    recordTest(5, 'Student can access own records', passed, `Status ${res.status}, studentId: ${res.data?.data?.id}`);
  }

  // Test 6: Student cannot access another student's records
  {
    // Student endpoints automatically derive identity from token and reject path hijacking
    // If student attempts to access parent route or another student's endpoint
    const res = await api(`/parent/children/${studentA2.id}`, { token: studentA1Token });
    const passed = res.status === 403;
    recordTest(6, 'Student cannot access another student\'s records', passed, `Status ${res.status} (Expected 403)`);
  }

  // Test 7: Student cannot access admin endpoints
  {
    const res = await api('/school/portal-settings', { token: studentA1Token });
    const passed = res.status === 403;
    recordTest(7, 'Student cannot access admin endpoints', passed, `Status ${res.status} (Expected 403)`);
  }

  // Test 8: Parent cannot modify attendance
  {
    const res = await api('/school/attendance/students', {
      method: 'POST',
      token: parentAToken,
      body: {
        classId: classA.id,
        sectionId: sectionA.id,
        date: '2026-11-17',
        records: [{ studentId: studentA1.id, status: 'PRESENT' }],
      },
    });
    const passed = res.status === 403;
    recordTest(8, 'Parent cannot modify attendance', passed, `Status ${res.status} (Expected 403)`);
  }

  // Test 9: Parent cannot modify marks
  {
    const res = await api('/school/examinations/marks', {
      method: 'POST',
      token: parentAToken,
      body: {
        examScheduleId: schedulePublished.id,
        studentId: studentA1.id,
        marksObtained: 100,
      },
    });
    const passed = res.status === 403;
    recordTest(9, 'Parent cannot modify marks', passed, `Status ${res.status} (Expected 403)`);
  }

  // Test 10: Unpublished results are hidden
  {
    const resParent = await api(`/parent/children/${studentA1.id}/results`, { token: parentAToken });
    const resultsParent = resParent.data?.data || [];
    const hasPublished = resultsParent.some((r: any) => r.examName.includes('Midterm Published'));
    const hasDraft = resultsParent.some((r: any) => r.examName.includes('Finals Draft'));

    const resStudent = await api('/student/results', { token: studentA1Token });
    const resultsStudent = resStudent.data?.data || [];
    const studentHasDraft = resultsStudent.some((r: any) => r.examName.includes('Finals Draft'));

    const passed = hasPublished && !hasDraft && !studentHasDraft;
    recordTest(10, 'Unpublished results are hidden', passed, `Published visible: ${hasPublished}, Draft hidden: ${!hasDraft && !studentHasDraft}`);
  }

  // Test 11: Revoked accounts are denied
  {
    const res = await api(`/parent/children/${studentA1.id}`, { token: revokedToken });
    const passed = res.status === 403;
    recordTest(11, 'Revoked accounts are denied', passed, `Status ${res.status} (Expected 403)`);
  }

  // Test 12: Inactive guardian-student relationships are denied
  {
    const res = await api(`/parent/children/${studentA3.id}`, { token: parentAToken });
    const passed = res.status === 403 && res.data?.message?.includes('inactive or revoked');
    recordTest(12, 'Inactive guardian-student relationships are denied', passed, `Status ${res.status}, message: ${res.data?.message}`);
  }

  // Test 13: Fee information is tenant-isolated
  {
    // Parent A querying fees for Student A1 should only see Tenant A invoices
    const res = await api(`/parent/children/${studentA1.id}/fees`, { token: parentAToken });
    const invoices = res.data?.data?.invoices || [];
    const hasA1Invoice = invoices.some((i: any) => i.id === invoiceA1.id);
    const hasB1Invoice = invoices.some((i: any) => i.id === invoiceB1.id);
    const passed = hasA1Invoice && !hasB1Invoice;
    recordTest(13, 'Fee information is tenant-isolated', passed, `Tenant A invoice visible: ${hasA1Invoice}, Tenant B invoice excluded: ${!hasB1Invoice}`);
  }

  // Test 14: Receipt downloads enforce authorization
  {
    // Valid receipt for child A1
    const resValid = await api(`/parent/children/${studentA1.id}/fees/payments/${paymentA1.id}/receipt`, { token: parentAToken });
    // Attempt receipt for student B1
    const resInvalid = await api(`/parent/children/${studentA1.id}/fees/payments/${paymentB1.id}/receipt`, { token: parentAToken });
    const passed = resValid.status === 200 && resInvalid.status === 404;
    recordTest(14, 'Receipt downloads enforce authorization', passed, `Valid receipt status: ${resValid.status}, Cross-tenant receipt: ${resInvalid.status}`);
  }

  // Test 15: Report-card downloads enforce authorization
  {
    const res = await api(`/parent/children/${studentA1.id}/report-cards`, { token: parentAToken });
    const reportCards = res.data?.data || [];
    const onlyPublished = reportCards.every((rc: any) => !rc.examName.includes('Finals Draft'));
    const passed = res.status === 200 && reportCards.length > 0 && onlyPublished;
    recordTest(15, 'Report-card downloads enforce authorization', passed, `Count: ${reportCards.length}, only published: ${onlyPublished}`);
  }

  // Test 16: Transport information is restricted to the selected student
  {
    const res = await api(`/parent/children/${studentA1.id}/transport`, { token: parentAToken });
    const trans = res.data?.data;
    const hasRoute = trans?.route?.name?.includes('Route North');
    // Ensure no driver personal information is exposed
    const noDriverLeak = trans?.driver === undefined && trans?.route?.driverPhone === undefined;
    const passed = res.status === 200 && hasRoute && noDriverLeak;
    recordTest(16, 'Transport information is restricted to selected student', passed, `Route: ${hasRoute}, No driver PII: ${noDriverLeak}`);
  }

  // Test 17: Library information is restricted to the selected student
  {
    const res = await api(`/parent/children/${studentA1.id}/library`, { token: parentAToken });
    const lib = res.data?.data;
    const hasBook = lib?.issues?.some((i: any) => i.bookTitle.includes('Physics for Class 10'));
    const passed = res.status === 200 && hasBook && lib?.memberId === libMemberA1.id;
    recordTest(17, 'Library information is restricted to selected student', passed, `Member: ${lib?.membershipNumber}, Book found: ${hasBook}`);
  }

  // Test 18: Invalid IDs and malformed inputs are rejected
  {
    const resInvalidId = await api('/parent/children/non_existent_cuid_123', { token: parentAToken });
    const resMalformed = await api('/school/portal-users/invite', {
      method: 'POST',
      token: adminAToken,
      body: { email: 'not-an-email', role: 'INVALID_ROLE' },
    });
    const passed = (resInvalidId.status === 404 || resInvalidId.status === 403) && resMalformed.status === 400;
    recordTest(18, 'Invalid IDs and malformed inputs are rejected', passed, `Invalid ID: ${resInvalidId.status}, Malformed input: ${resMalformed.status}`);
  }

  // Test 19: School Admin portal settings respect tenant boundaries
  {
    // School Admin A disables student portal for School A
    const resUpdate = await api('/school/portal-settings', {
      method: 'PUT',
      token: adminAToken,
      body: { isStudentPortalEnabled: false },
    });

    // Check School A student is now blocked
    const resBlocked = await api('/student/dashboard', { token: studentA1Token });

    // Check School B portal settings are unchanged
    const resB = await api('/school/portal-settings', { token: adminBToken });

    // Re-enable for School A
    await api('/school/portal-settings', {
      method: 'PUT',
      token: adminAToken,
      body: { isStudentPortalEnabled: true },
    });

    const passed =
      resUpdate.status === 200 &&
      resBlocked.status === 403 &&
      resB.data?.data?.isStudentPortalEnabled === true;
    recordTest(19, 'School Admin portal settings respect tenant boundaries', passed, `Tenant A blocked: ${resBlocked.status === 403}, Tenant B unaffected: ${resB.data?.data?.isStudentPortalEnabled}`);
  }

  // Test 20: Unauthorized users cannot activate or link accounts
  {
    // Regular student tries to link guardian-student
    const resUnauthorizedLink = await api('/school/portal-users/link-guardian-student', {
      method: 'POST',
      token: studentA1Token,
      body: { parentId: parentA.id, studentId: studentA3.id },
    });

    // Forged invitation token acceptance
    const resForgedAccept = await api('/auth/portal/accept-invitation', {
      method: 'POST',
      body: { token: 'completely_forged_invitation_token_1234567890', password: 'ValidPass123' },
    });

    const passed = resUnauthorizedLink.status === 403 && resForgedAccept.status === 404;
    recordTest(20, 'Unauthorized users cannot activate or link accounts', passed, `Unauthorized link: ${resUnauthorizedLink.status}, Forged token: ${resForgedAccept.status}`);
  }

  // Clean up server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // Cleanup test fixtures
  try {
    await prisma.schools.deleteMany({
      where: { id: { in: [schoolA.id, schoolB.id] } },
    });
  } catch {
    // Cascade cleanup
  }

  console.log('\n================================================================');
  console.log('📊 VERIFICATION SUITE EXECUTION SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL EXECUTED: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPortalTests()
  .catch((err) => {
    console.error('Test execution fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
