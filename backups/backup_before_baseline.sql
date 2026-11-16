--
-- PostgreSQL database dump
--

\restrict 1g8PLUR2JJDqX73OFf2lkTzcrbLW2bRjscqffojCdsGa4e5YJKUFOQjv4MrwQV4

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AttendanceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AttendanceStatus" AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE',
    'HALF_DAY',
    'ON_LEAVE'
);


ALTER TYPE public."AttendanceStatus" OWNER TO postgres;

--
-- Name: DayOfWeek; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DayOfWeek" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);


ALTER TYPE public."DayOfWeek" OWNER TO postgres;

--
-- Name: EnrollmentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EnrollmentStatus" AS ENUM (
    'ACTIVE',
    'PROMOTED',
    'GRADUATED',
    'TRANSFERRED'
);


ALTER TYPE public."EnrollmentStatus" OWNER TO postgres;

--
-- Name: ExamResultStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ExamResultStatus" AS ENUM (
    'PASS',
    'FAIL',
    'WITHHELD',
    'PENDING'
);


ALTER TYPE public."ExamResultStatus" OWNER TO postgres;

--
-- Name: ExamStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ExamStatus" AS ENUM (
    'UPCOMING',
    'ONGOING',
    'COMPLETED',
    'PUBLISHED',
    'CANCELLED'
);


ALTER TYPE public."ExamStatus" OWNER TO postgres;

--
-- Name: ExamType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ExamType" AS ENUM (
    'ANNUAL',
    'HALF_YEARLY',
    'QUARTERLY',
    'UNIT_TEST',
    'MID_TERM',
    'FINAL',
    'ASSESSMENT'
);


ALTER TYPE public."ExamType" OWNER TO postgres;

--
-- Name: FeeFrequency; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."FeeFrequency" AS ENUM (
    'ONE_TIME',
    'MONTHLY',
    'TERM',
    'ANNUAL'
);


ALTER TYPE public."FeeFrequency" OWNER TO postgres;

--
-- Name: Gender; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Gender" AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER'
);


ALTER TYPE public."Gender" OWNER TO postgres;

--
-- Name: HomeworkStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."HomeworkStatus" AS ENUM (
    'PENDING',
    'SUBMITTED',
    'EVALUATED',
    'LATE'
);


ALTER TYPE public."HomeworkStatus" OWNER TO postgres;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'PENDING',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'CANCELLED'
);


ALTER TYPE public."InvoiceStatus" OWNER TO postgres;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'CARD',
    'BANK_TRANSFER',
    'ONLINE',
    'CHEQUE'
);


ALTER TYPE public."PaymentMethod" OWNER TO postgres;

--
-- Name: PaymentType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentType" AS ENUM (
    'PAYMENT',
    'REFUND'
);


ALTER TYPE public."PaymentType" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'SUPER_ADMIN',
    'SCHOOL_ADMIN',
    'TEACHER',
    'STUDENT',
    'PARENT'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: SchoolStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SchoolStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'PENDING'
);


ALTER TYPE public."SchoolStatus" OWNER TO postgres;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);


ALTER TYPE public."UserStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_years; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.academic_years (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    name text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    "isCurrent" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.academic_years OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "schoolId" text,
    "userId" text,
    action text NOT NULL,
    resource text NOT NULL,
    "resourceId" text,
    details jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: class_subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.class_subjects (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "classId" text NOT NULL,
    "subjectId" text NOT NULL,
    "teacherId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.class_subjects OWNER TO postgres;

--
-- Name: class_timetables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.class_timetables (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "academicYearId" text NOT NULL,
    "classId" text NOT NULL,
    "sectionId" text NOT NULL,
    "subjectId" text,
    "teacherId" text,
    "dayOfWeek" public."DayOfWeek" NOT NULL,
    "periodNumber" integer NOT NULL,
    "periodName" text DEFAULT 'Period'::text NOT NULL,
    "isBreak" boolean DEFAULT false NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "roomNumber" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.class_timetables OWNER TO postgres;

--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    name text NOT NULL,
    "order" integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text,
    "teacherId" text,
    name text NOT NULL,
    type text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: exam_marks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_marks (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "examScheduleId" text NOT NULL,
    "studentId" text NOT NULL,
    "theoryMarks" numeric(6,2),
    "practicalMarks" numeric(6,2),
    "internalMarks" numeric(6,2),
    "marksObtained" numeric(6,2) NOT NULL,
    percentage numeric(5,2) NOT NULL,
    grade text,
    "isAbsent" boolean DEFAULT false NOT NULL,
    remarks text,
    "gradedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.exam_marks OWNER TO postgres;

--
-- Name: exam_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_results (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "examId" text NOT NULL,
    "studentId" text NOT NULL,
    "classId" text NOT NULL,
    "sectionId" text,
    "totalMaxMarks" numeric(8,2) NOT NULL,
    "totalObtainedMarks" numeric(8,2) NOT NULL,
    percentage numeric(5,2) NOT NULL,
    gpa numeric(4,2),
    "overallGrade" text,
    rank integer,
    status public."ExamResultStatus" DEFAULT 'PENDING'::public."ExamResultStatus" NOT NULL,
    "teacherRemarks" text,
    "principalRemarks" text,
    "isApproved" boolean DEFAULT false NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    "approvedById" text,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.exam_results OWNER TO postgres;

--
-- Name: exam_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_schedules (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "examId" text NOT NULL,
    "classId" text NOT NULL,
    "sectionId" text,
    "subjectId" text NOT NULL,
    "examDate" timestamp(3) without time zone NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "roomNumber" text,
    "invigilatorTeacherId" text,
    "maxMarks" numeric(6,2) DEFAULT 100.00 NOT NULL,
    "passingMarks" numeric(6,2) DEFAULT 40.00 NOT NULL,
    "theoryMarksMax" numeric(6,2),
    "practicalMarksMax" numeric(6,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.exam_schedules OWNER TO postgres;

--
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "academicYearId" text NOT NULL,
    "gradingScaleId" text,
    name text NOT NULL,
    "examType" public."ExamType" DEFAULT 'MID_TERM'::public."ExamType" NOT NULL,
    term text NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone NOT NULL,
    status public."ExamStatus" DEFAULT 'UPCOMING'::public."ExamStatus" NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.exams OWNER TO postgres;

--
-- Name: fee_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fee_categories (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.fee_categories OWNER TO postgres;

--
-- Name: fee_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fee_payments (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "invoiceId" text NOT NULL,
    "receiptNumber" text NOT NULL,
    amount numeric(10,2) NOT NULL,
    "paymentType" public."PaymentType" DEFAULT 'PAYMENT'::public."PaymentType" NOT NULL,
    "paymentMethod" public."PaymentMethod" DEFAULT 'CASH'::public."PaymentMethod" NOT NULL,
    "transactionReference" text,
    remarks text,
    "paymentDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "recordedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.fee_payments OWNER TO postgres;

--
-- Name: fee_structures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fee_structures (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "categoryId" text NOT NULL,
    "classId" text,
    "academicYearId" text NOT NULL,
    name text NOT NULL,
    amount numeric(10,2) NOT NULL,
    frequency public."FeeFrequency" DEFAULT 'MONTHLY'::public."FeeFrequency" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.fee_structures OWNER TO postgres;

--
-- Name: grading_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grading_rules (
    id text NOT NULL,
    "gradingScaleId" text NOT NULL,
    grade text NOT NULL,
    "minPercentage" numeric(5,2) NOT NULL,
    "maxPercentage" numeric(5,2) NOT NULL,
    "gradePoint" numeric(4,2) DEFAULT 0 NOT NULL,
    description text,
    "order" integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.grading_rules OWNER TO postgres;

--
-- Name: grading_scales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grading_scales (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    name text NOT NULL,
    description text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.grading_scales OWNER TO postgres;

--
-- Name: homework; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.homework (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "classId" text NOT NULL,
    "sectionId" text,
    "subjectId" text NOT NULL,
    "teacherId" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "attachmentUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.homework OWNER TO postgres;

--
-- Name: homework_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.homework_submissions (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "homeworkId" text NOT NULL,
    "studentId" text NOT NULL,
    "submissionText" text,
    "attachmentUrl" text,
    status public."HomeworkStatus" DEFAULT 'PENDING'::public."HomeworkStatus" NOT NULL,
    marks numeric(5,2),
    feedback text,
    "submittedAt" timestamp(3) without time zone,
    "evaluatedAt" timestamp(3) without time zone,
    "evaluatedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.homework_submissions OWNER TO postgres;

--
-- Name: parent_students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parent_students (
    id text NOT NULL,
    "parentId" text NOT NULL,
    "studentId" text NOT NULL,
    relation text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.parent_students OWNER TO postgres;

--
-- Name: parents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parents (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "userId" text,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    phone text NOT NULL,
    email text,
    address text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "emergencyContact" boolean DEFAULT false NOT NULL,
    occupation text
);


ALTER TABLE public.parents OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: schools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schools (
    id text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    email text NOT NULL,
    phone text,
    logo text,
    address text,
    city text,
    state text,
    country text,
    status public."SchoolStatus" DEFAULT 'ACTIVE'::public."SchoolStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.schools OWNER TO postgres;

--
-- Name: sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sections (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "classId" text NOT NULL,
    name text NOT NULL,
    capacity integer DEFAULT 40 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "classTeacherId" text
);


ALTER TABLE public.sections OWNER TO postgres;

--
-- Name: staff_attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_attendance (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "teacherId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    status public."AttendanceStatus" DEFAULT 'PRESENT'::public."AttendanceStatus" NOT NULL,
    "checkInTime" timestamp(3) without time zone,
    "checkOutTime" timestamp(3) without time zone,
    remarks text,
    "markedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.staff_attendance OWNER TO postgres;

--
-- Name: student_attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_attendance (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text NOT NULL,
    "classId" text NOT NULL,
    "sectionId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    status public."AttendanceStatus" DEFAULT 'PRESENT'::public."AttendanceStatus" NOT NULL,
    remarks text,
    "markedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.student_attendance OWNER TO postgres;

--
-- Name: student_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_enrollments (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "studentId" text NOT NULL,
    "academicYearId" text NOT NULL,
    "classId" text NOT NULL,
    "sectionId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "rollNumber" text,
    status public."EnrollmentStatus" DEFAULT 'ACTIVE'::public."EnrollmentStatus" NOT NULL
);


ALTER TABLE public.student_enrollments OWNER TO postgres;

--
-- Name: student_fee_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.student_fee_invoices (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "invoiceNumber" text NOT NULL,
    "studentId" text NOT NULL,
    "feeStructureId" text,
    "academicYearId" text NOT NULL,
    title text NOT NULL,
    "baseAmount" numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0.00 NOT NULL,
    "discountReason" text,
    "lateFee" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "totalAmount" numeric(10,2) NOT NULL,
    "paidAmount" numeric(10,2) DEFAULT 0.00 NOT NULL,
    balance numeric(10,2) NOT NULL,
    status public."InvoiceStatus" DEFAULT 'PENDING'::public."InvoiceStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.student_fee_invoices OWNER TO postgres;

--
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "userId" text,
    "admissionNumber" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "dateOfBirth" timestamp(3) without time zone,
    gender public."Gender",
    phone text,
    email text,
    address text,
    "admissionDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "bloodGroup" text,
    "emergencyContact" text,
    photo text
);


ALTER TABLE public.students OWNER TO postgres;

--
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.subjects OWNER TO postgres;

--
-- Name: teachers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teachers (
    id text NOT NULL,
    "schoolId" text NOT NULL,
    "userId" text NOT NULL,
    "employeeId" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    phone text,
    email text NOT NULL,
    "joiningDate" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    department text,
    designation text,
    photo text,
    qualification text
);


ALTER TABLE public.teachers OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    "schoolId" text,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" NOT NULL,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: academic_years; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.academic_years (id, "schoolId", name, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt") FROM stdin;
cmt3yi1a30005ckk9hlxv7bmw	cmt3yi19q0001ckk9cq8rknzc	2025-2026	2025-08-01 00:00:00	2026-06-30 00:00:00	t	2026-08-22 05:47:24.796	2026-08-22 05:47:24.796
cmt3yi1c70011ckk9zzxslzkz	cmt3yi1c0000xckk9qvn7nqmx	2025-2026	2025-08-15 00:00:00	2026-06-15 00:00:00	t	2026-08-22 05:47:24.871	2026-08-22 05:47:24.871
cmw6qe8050002u0w30fn7rjrn	cmw6qe7z60000u0w3r1k7jy5x	2026-2027	2026-07-31 18:30:00	2027-06-29 18:30:00	t	2026-11-07 18:22:55.493	2026-11-07 18:22:55.493
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, "schoolId", "userId", action, resource, "resourceId", details, "ipAddress", "userAgent", "createdAt") FROM stdin;
cmw6syz700001sww3aapnxptf	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 19:35:03.084
cmw6syzk50003sww3c3gyv6ep	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 19:35:03.557
cmw6syzuc0005sww3ervq1vn9	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 19:35:03.924
cmw6syzzt0008sww3p28sksv8	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6syzzf0007sww35fxtj2ri	{"name": "Audit Student", "admissionNumber": "ADM-1794080104068"}	::1	node	2026-11-07 19:35:04.121
cmw6sz0fn000asww3bchqklxg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6sz0f60009sww3ot3bz167	{"studentId": "cmw6syzzf0007sww35fxtj2ri", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 19:35:04.691
cmw6sz0hg000dsww3kmo3c84v	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6sz0gy000bsww324293erw	{"relation": "FATHER", "studentId": "cmw6syzzf0007sww35fxtj2ri", "parentName": "Arthur Student"}	::1	node	2026-11-07 19:35:04.756
cmw6sz0sa000gsww3rbqd824q	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6sz0s0000fsww3w3a2k05s	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-4786", "designation": "Senior Faculty"}	::1	node	2026-11-07 19:35:05.146
cmw6sz0tx000isww3eu3pufr1	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6sz0tt000hsww3fio5nr32	{"code": "SUB-5180", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 19:35:05.205
cmw6t03j7000ksww32r0h60z6	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 19:35:55.363
cmw6t03v9000msww3uh9mu8io	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 19:35:55.797
cmw6t04dk000osww3z1aipo4s	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 19:35:56.456
cmw6t04vy000rsww3p45z1uf5	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6t04vr000qsww3qqrgxvot	{"name": "Audit Student", "admissionNumber": "ADM-1794080157078"}	::1	node	2026-11-07 19:35:57.118
cmw6t0573000tsww3abhjxn5x	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6t056t000ssww38eap8cqv	{"studentId": "cmw6t04vr000qsww3qqrgxvot", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 19:35:57.519
cmw6t058q000wsww39khmqssi	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6t058b000usww34wisj7d4	{"relation": "FATHER", "studentId": "cmw6t04vr000qsww3qqrgxvot", "parentName": "Arthur Student"}	::1	node	2026-11-07 19:35:57.578
cmw6t05gd000zsww3tebx637v	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6t05g6000ysww30bwdi9o9	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-7610", "designation": "Senior Faculty"}	::1	node	2026-11-07 19:35:57.853
cmw6t05hp0011sww3i9g0j9td	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6t05hl0010sww3l8m6gq03	{"code": "SUB-7882", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 19:35:57.901
cmw6tuoyc0001hgw3jth55ulf	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 19:59:42.804
cmw6tupdc0003hgw35diz7bds	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 19:59:43.344
cmw6tupms0005hgw3oieqk44j	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 19:59:43.684
cmw6tuq460008hgw3f9bh4gu0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6tuq3o0007hgw3xg7xq69u	{"name": "Audit Student", "admissionNumber": "ADM-1794081584233"}	::1	node	2026-11-07 19:59:44.31
cmw6tuqj8000ahgw39hr7a3oz	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6tuqit0009hgw3oy6tbd1c	{"studentId": "cmw6tuq3o0007hgw3xg7xq69u", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 19:59:44.852
cmw6tuqlk000dhgw3d6tldn2y	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6tuqky000bhgw3twbvtgyq	{"relation": "FATHER", "studentId": "cmw6tuq3o0007hgw3xg7xq69u", "parentName": "Arthur Student"}	::1	node	2026-11-07 19:59:44.936
cmw6tuqxl000ghgw36846dd6k	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6tuqxe000fhgw3rshadycs	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-4980", "designation": "Senior Faculty"}	::1	node	2026-11-07 19:59:45.369
cmw6tuqz2000ihgw3t07duk6f	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6tuqyy000hhgw3z60xliyj	{"code": "SUB-5400", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 19:59:45.422
cmw6tur61000khgw3wynvanvu	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 19:59:45.673
cmw6tur7x000mhgw33mu4w11q	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6tur7r000lhgw3qkh71mtw	{"name": "Tuition & Science Lab 5712"}	::1	node	2026-11-07 19:59:45.741
cmw6tur9n000ohgw3tztupech	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6tur8u000nhgw34palm1hk	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 19:59:45.803
cmw6turb4000qhgw3tq0k0pmg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6turah000phgw3yldiiz75	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-9672"}	::1	node	2026-11-07 19:59:45.856
cmw6turd1000shgw31a90ryeh	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6turc9000rhgw37xnmqgz7	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-9672", "receiptNumber": "REC-20261107-9578", "remainingBalance": 600}	::1	node	2026-11-07 19:59:45.925
cmw6tysmn000uhgw3t50wm5n7	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 20:02:54.191
cmw6tysuw000whgw3ceomc4en	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 20:02:54.488
cmw6tyt6p000yhgw3s4clc661	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 20:02:54.913
cmw6tytyh0011hgw355hfdw9o	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6tyty80010hgw3durlk2lx	{"name": "Audit Student", "admissionNumber": "ADM-1794081775855"}	::1	node	2026-11-07 20:02:55.913
cmw6tyu6d0013hgw3o4vu9qn6	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6tyu600012hgw34wyo4aki	{"studentId": "cmw6tyty80010hgw3durlk2lx", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 20:02:56.197
cmw6tyu7w0016hgw3dl8m314i	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6tyu7o0014hgw34exnldgf	{"relation": "FATHER", "studentId": "cmw6tyty80010hgw3durlk2lx", "parentName": "Arthur Student"}	::1	node	2026-11-07 20:02:56.252
cmw6tyugi0019hgw30a9lwwzv	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6tyugd0018hgw3rsz5zy1p	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-6287", "designation": "Senior Faculty"}	::1	node	2026-11-07 20:02:56.562
cmw6tyuhp001bhgw3ccxw7xsc	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6tyuhm001ahgw34lusxydq	{"code": "SUB-6586", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:02:56.605
cmw6tyuk0001dhgw32hj6izej	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:02:56.688
cmw6tyukr001fhgw3n116kt8l	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:02:56.715
cmw6tyun4001hhgw3si9nvzov	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 20:02:56.8
cmw6tyuoh001jhgw3g5kfbtfd	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6tyuoe001ihgw3cxuhu6bw	{"name": "Tuition & Science Lab 6826"}	::1	node	2026-11-07 20:02:56.849
cmw6tyuq3001lhgw3yln9sq3s	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6tyupa001khgw3t4v74k1v	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 20:02:56.907
cmw6tyur3001nhgw39cl8umvm	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6tyuqm001mhgw3zl6kjcov	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-7573"}	::1	node	2026-11-07 20:02:56.943
cmw6tyut6001phgw3wgc7ylta	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6tyus8001ohgw3bqiucn0z	{"status": "PARTIALLY_PAID", "amountPaid": 800, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-7573", "receiptNumber": "REC-20261107-3434", "remainingBalance": 250}	::1	node	2026-11-07 20:02:57.018
cmw6u0peh001rhgw3sl195kyz	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 20:04:23.321
cmw6u0pn5001thgw3ifd8055q	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 20:04:23.634
cmw6u0pur001vhgw393yrl76a	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 20:04:23.907
cmw6u0qs9001yhgw3eoic2dg1	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6u0qrw001xhgw32r9denfk	{"name": "Audit Student", "admissionNumber": "ADM-1794081865050"}	::1	node	2026-11-07 20:04:25.113
cmw6u0qzt0020hgw3fx4169zg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6u0qzg001zhgw3fd4gecnu	{"studentId": "cmw6u0qrw001xhgw32r9denfk", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 20:04:25.385
cmw6u0r1f0023hgw32m629rpi	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6u0r170021hgw3m58w3d7v	{"relation": "FATHER", "studentId": "cmw6u0qrw001xhgw32r9denfk", "parentName": "Arthur Student"}	::1	node	2026-11-07 20:04:25.443
cmw6u0rap0026hgw3ft9wgv6n	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6u0raj0025hgw39s2gdzga	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-5468", "designation": "Senior Faculty"}	::1	node	2026-11-07 20:04:25.777
cmw6u0rc20028hgw3jymgrcjb	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6u0rbz0027hgw3w9ykiook	{"code": "SUB-5800", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:04:25.826
cmw6u0rep002ahgw3azgzfw6n	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:04:25.921
cmw6u0rfl002chgw3zhe52goh	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:04:25.953
cmw6u0ri6002ehgw3mcm3txjo	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 20:04:26.046
cmw6u0rji002ghgw3kaduwh98	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6u0rjf002fhgw304hy2jmw	{"name": "Tuition & Science Lab 6072"}	::1	node	2026-11-07 20:04:26.094
cmw6u0rkn002ihgw3mldjxbej	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6u0rk0002hhgw35hnlvn13	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 20:04:26.135
cmw6u0rls002khgw3v8ozq54f	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6u0rl6002jhgw349vxz1rt	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-2162"}	::1	node	2026-11-07 20:04:26.176
cmw6u0rn7002mhgw38wz8vbnj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6u0rmj002lhgw3021xh3u0	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-2162", "receiptNumber": "REC-20261107-7065", "remainingBalance": 600}	::1	node	2026-11-07 20:04:26.227
cmw6umask000ohsw39gvsuen3	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 20:21:10.82
cmw6u0rq3002ohgw3d4xa4xef	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw6u0rpr002nhgw384i5irhv	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261107-2162", "refundReceipt": "REF-20261107-7888", "originalReceipt": "REC-20261107-7065"}	::1	node	2026-11-07 20:04:26.331
cmw6u0rrx002qhgw3eocvl0ml	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw6u0rrj002phgw3628m40cj	{"reason": "Attempting excessive refund", "refundAmount": 400, "invoiceNumber": "INV-20261107-2162", "refundReceipt": "REF-20261107-7819", "originalReceipt": "REC-20261107-7065"}	::1	node	2026-11-07 20:04:26.397
cmw6u1riw0001r0w3geeph4ir	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 20:05:12.728
cmw6u1rxq0003r0w3192wio1q	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 20:05:13.262
cmw6u1s5i0005r0w3zstl2o3r	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 20:05:13.542
cmw6u1sm70008r0w3ga7scd95	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6u1slt0007r0w3qct0i2ks	{"name": "Audit Student", "admissionNumber": "ADM-1794081914071"}	::1	node	2026-11-07 20:05:14.143
cmw6u1t2o000ar0w3wf04kvmq	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6u1t260009r0w3fpzxq93d	{"studentId": "cmw6u1slt0007r0w3qct0i2ks", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 20:05:14.736
cmw6u1t4y000dr0w3xfbf78b2	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6u1t4m000br0w3iaxgmp0f	{"relation": "FATHER", "studentId": "cmw6u1slt0007r0w3qct0i2ks", "parentName": "Arthur Student"}	::1	node	2026-11-07 20:05:14.818
cmw6u1tfx000gr0w3swt3ubio	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6u1tfr000fr0w3894mmeji	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-4873", "designation": "Senior Faculty"}	::1	node	2026-11-07 20:05:15.213
cmw6u1thn000ir0w3p6nomjxe	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6u1thj000hr0w3typrdw5a	{"code": "SUB-5245", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:05:15.275
cmw6u1tkv000kr0w3xkxp7vpq	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:05:15.391
cmw6u1tlw000mr0w31urh1n0l	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:05:15.428
cmw6u1tpc000or0w3qrdysbzb	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 20:05:15.552
cmw6u1trc000qr0w31ncevbfo	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6u1tr8000pr0w3rndkja6q	{"name": "Tuition & Science Lab 5590"}	::1	node	2026-11-07 20:05:15.624
cmw6u1tt7000sr0w3hip5w6sn	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6u1tse000rr0w3m6a309cs	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 20:05:15.691
cmw6u1tvr000ur0w3p8j3yjh2	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6u1tue000tr0w3o1ml0d2g	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-8862"}	::1	node	2026-11-07 20:05:15.783
cmw6u1tyi000wr0w3j8wt8dme	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6u1txu000vr0w3jmmylomg	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-8862", "receiptNumber": "REC-20261107-5774", "remainingBalance": 600}	::1	node	2026-11-07 20:05:15.882
cmw6u1u1d000yr0w3822tfd97	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw6u1u12000xr0w34iwzu6te	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261107-8862", "refundReceipt": "REF-20261107-1353", "originalReceipt": "REC-20261107-5774"}	::1	node	2026-11-07 20:05:15.985
cmw6um81h0001hsw3grvauwm6	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 20:21:07.253
cmw6um8lm0003hsw3mab0s531	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 20:21:07.978
cmw6um8xk0005hsw3sl9qg69s	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 20:21:08.408
cmw6um9e30008hsw33a8y274z	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6um9dn0007hsw3t8xhw19x	{"name": "Audit Student", "admissionNumber": "ADM-1794082868942"}	::1	node	2026-11-07 20:21:09.003
cmw6um9vm000ahsw3ir78bk5b	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6um9v60009hsw3vw7wq7r9	{"studentId": "cmw6um9dn0007hsw3t8xhw19x", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 20:21:09.634
cmw6um9ya000dhsw3cagm9tz6	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6um9xf000bhsw3651dbaya	{"relation": "FATHER", "studentId": "cmw6um9dn0007hsw3t8xhw19x", "parentName": "Arthur Student"}	::1	node	2026-11-07 20:21:09.73
cmw6umaez000ghsw3nos670h2	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6umaep000fhsw3i0g8ffnr	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-9778", "designation": "Senior Faculty"}	::1	node	2026-11-07 20:21:10.331
cmw6umah6000ihsw3f7u1uh42	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6umagz000hhsw3aykykadh	{"code": "SUB-0365", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:21:10.41
cmw6umani000khsw3fasuv6s0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:21:10.638
cmw6umaon000mhsw3n3wqe6ab	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:21:10.679
cmw6umauf000qhsw3pw9fzn6x	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6umaua000phsw3hhyg35td	{"name": "Tuition & Science Lab 0856"}	::1	node	2026-11-07 20:21:10.887
cmw6umawf000shsw3lofh0osj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6umavm000rhsw3yez0x2a0	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 20:21:10.959
cmw6umaxx000uhsw3gp14p9lq	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6umax9000thsw3ovofoej2	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-9773"}	::1	node	2026-11-07 20:21:11.013
cmw6umazn000whsw3jt7nujqi	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6umayx000vhsw37hhb0map	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-9773", "receiptNumber": "REC-20261107-7503", "remainingBalance": 600}	::1	node	2026-11-07 20:21:11.075
cmw6umb33000yhsw37pk1cfpi	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw6umb2q000xhsw395ccxnh5	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261107-9773", "refundReceipt": "REF-20261107-1631", "originalReceipt": "REC-20261107-7503"}	::1	node	2026-11-07 20:21:11.199
cmw6umbdp0015hsw36nvf0ibp	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw6umbd1000zhsw3p1cbpn11	{"name": "Academic Standard Scale 1441", "rulesCount": 5}	::1	node	2026-11-07 20:21:11.581
cmw6umbf20017hsw3mnf0tv7r	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw6umbem0016hsw3lst68qca	{"name": "Mid-Term Examination 1590", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-07 20:21:11.63
cmw6umbiy0019hsw3tjr0z4tv	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw6umbhs0018hsw3xp2yaxa4	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 1590", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:21:11.77
cmw6umbnk001bhsw3jyr0p23x	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw6umbhs0018hsw3xp2yaxa4	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-07 20:21:11.936
cmw6umbr7001fhsw31j7aub5o	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw6umbem0016hsw3lst68qca	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 3}	::1	node	2026-11-07 20:21:12.067
cmw6umbs5001ghsw3tk0txwin	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw6umbem0016hsw3lst68qca	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 3}	::1	node	2026-11-07 20:21:12.101
cmw6umc2k001ihsw3fvoqu9r6	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw6umc13001hhsw3n3ob8sib	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-07 20:21:12.476
cmw6umc4q001khsw3h3kvp16y	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw6umc3z001jhsw368x3mh6m	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:21:12.554
cmw6uo39a0001q0w3cjj2b3ah	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 20:22:34.366
cmw6uo3st0003q0w3hi0fu47i	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 20:22:35.069
cmw6uo4hp0005q0w3digjd9vt	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 20:22:35.965
cmw6uo5480008q0w33lryawtg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6uo53s0007q0w38dafhh65	{"name": "Audit Student", "admissionNumber": "ADM-1794082956694"}	::1	node	2026-11-07 20:22:36.776
cmw6uo5ow000aq0w3o4udn4r0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6uo5of0009q0w3rbeaaspt	{"studentId": "cmw6uo53s0007q0w38dafhh65", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 20:22:37.52
cmw6uo5ra000dq0w3uk8ykw75	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6uo5qo000bq0w3i7w7m0y5	{"relation": "FATHER", "studentId": "cmw6uo53s0007q0w38dafhh65", "parentName": "Arthur Student"}	::1	node	2026-11-07 20:22:37.606
cmw6uo676000gq0w3tobt4gvv	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6uo66v000fq0w3qu3psaxh	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-7656", "designation": "Senior Faculty"}	::1	node	2026-11-07 20:22:38.178
cmw6uo68u000iq0w3n40tjvu2	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6uo68p000hq0w3jejk3ktq	{"code": "SUB-8212", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:22:38.238
cmw6uo6d4000kq0w36vlvpd8p	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:22:38.392
cmw6uo6e9000mq0w375inowig	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:22:38.433
cmw6uo6i0000oq0w32hrqg0ej	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 20:22:38.568
cmw6uo6jv000qq0w3ezlljjmr	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6uo6jr000pq0w3kw9z034g	{"name": "Tuition & Science Lab 8603"}	::1	node	2026-11-07 20:22:38.635
cmw6uo6lx000sq0w3uy622hvv	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6uo6l2000rq0w3k6xo7ooz	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 20:22:38.709
cmw6uo6nl000uq0w30h4rqid3	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6uo6my000tq0w3lojbzpdr	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-2428"}	::1	node	2026-11-07 20:22:38.769
cmw6uo6pl000wq0w372vsebzq	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6uo6ot000vq0w34uoylpou	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-2428", "receiptNumber": "REC-20261107-4287", "remainingBalance": 600}	::1	node	2026-11-07 20:22:38.841
cmw6uo6tc000yq0w3347yh40o	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw6uo6t0000xq0w3qiiz98xl	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261107-2428", "refundReceipt": "REF-20261107-9246", "originalReceipt": "REC-20261107-4287"}	::1	node	2026-11-07 20:22:38.977
cmw6uo74g0015q0w3r5d8w1fk	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw6uo73o000zq0w3cmkzk7us	{"name": "Academic Standard Scale 9242", "rulesCount": 5}	::1	node	2026-11-07 20:22:39.376
cmw6uo76u0017q0w3r5v9iqei	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw6uo7680016q0w3xa1am9i7	{"name": "Mid-Term Examination 9406", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-07 20:22:39.462
cmw6uo7a50019q0w3pjseyftn	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw6uo79h0018q0w3jq2j499n	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 9406", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:22:39.581
cmw6uo7ea001bq0w3vofvj05a	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw6uo79h0018q0w3jq2j499n	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-07 20:22:39.73
cmw6uo7ih001fq0w3kn7ku9hr	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw6uo7680016q0w3xa1am9i7	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 3}	::1	node	2026-11-07 20:22:39.881
cmw6uo7ji001gq0w377tdu8o0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw6uo7680016q0w3xa1am9i7	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 3}	::1	node	2026-11-07 20:22:39.918
cmw6uo7qa001iq0w3hr93fodm	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw6uo7pi001hq0w31v41gn0l	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-07 20:22:40.162
cmw6uo7sd001kq0w3ury0u707	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw6uo7rq001jq0w3nzek4xdj	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:22:40.237
cmw6uo7uq001mq0w3hmfv0pfw	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw6uo7t5001lq0w3fqq97luq	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-07 20:22:40.322
cmw6up42x001oq0w3nob9ylj2	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 20:23:22.089
cmw6up4b4001qq0w3rp6ox0vf	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 20:23:22.384
cmw6up4ly001sq0w3dd092c9y	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 20:23:22.774
cmw6up511001vq0w3a5ryjhtc	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6up50s001uq0w3v3r0nfny	{"name": "Audit Student", "admissionNumber": "ADM-1794083003275"}	::1	node	2026-11-07 20:23:23.317
cmw6up5ca001xq0w3ban7ushk	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6up5bx001wq0w3mnpzqeck	{"studentId": "cmw6up50s001uq0w3v3r0nfny", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 20:23:23.722
cmw6up5dv0020q0w31hq7fzdl	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6up5do001yq0w3uzuiltok	{"relation": "FATHER", "studentId": "cmw6up50s001uq0w3v3r0nfny", "parentName": "Arthur Student"}	::1	node	2026-11-07 20:23:23.779
cmw6up5nd0023q0w354t2dyn8	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6up5n70022q0w3qcbmu094	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-3823", "designation": "Senior Faculty"}	::1	node	2026-11-07 20:23:24.121
cmw6up5oy0025q0w3dtgycgem	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6up5ov0024q0w32mtevq1p	{"code": "SUB-4152", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:23:24.178
cmw6up5ru0027q0w3js6r11ec	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:23:24.283
cmw6up5sz0029q0w3jgreg49b	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:23:24.323
cmw6up5vu002bq0w3xh0m8fus	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 20:23:24.427
cmw6up5xj002dq0w3nc6w80ks	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6up5xf002cq0w370v7fzq5	{"name": "Tuition & Science Lab 4461"}	::1	node	2026-11-07 20:23:24.487
cmw6up5yt002fq0w37cn4it5d	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6up5y6002eq0w3g00olhfx	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 20:23:24.533
cmw6up603002hq0w3e284rg6k	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6up5zj002gq0w3nt3s79ln	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-7065"}	::1	node	2026-11-07 20:23:24.579
cmw6up61k002jq0w34j88bq2a	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6up60v002iq0w3tlfr4vkg	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-7065", "receiptNumber": "REC-20261107-8210", "remainingBalance": 600}	::1	node	2026-11-07 20:23:24.632
cmw6up641002lq0w3a7w85j0a	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw6up63s002kq0w3dolipdiy	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261107-7065", "refundReceipt": "REF-20261107-8120", "originalReceipt": "REC-20261107-8210"}	::1	node	2026-11-07 20:23:24.721
cmw6up6bv002sq0w3dvulkpqv	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw6up6bd002mq0w3p2punv27	{"name": "Academic Standard Scale 4955", "rulesCount": 5}	::1	node	2026-11-07 20:23:25.003
cmw6up6dg002uq0w3efewntpf	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw6up6cy002tq0w3nckh55yh	{"name": "Mid-Term Examination 5014", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-07 20:23:25.06
cmw6up6fr002wq0w352vi6tsc	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw6up6f9002vq0w3stvk114z	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 5014", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:23:25.143
cmw6up6iq002yq0w32mxkk4sj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw6up6f9002vq0w3stvk114z	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-07 20:23:25.25
cmw6up6lc0032q0w38msmojjt	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw6up6cy002tq0w3nckh55yh	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 3}	::1	node	2026-11-07 20:23:25.344
cmw6up6m90033q0w30p3odbvi	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw6up6cy002tq0w3nckh55yh	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 3}	::1	node	2026-11-07 20:23:25.377
cmw6up6qy0035q0w3xd1s4wdb	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw6up6q20034q0w3f8p0z751	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-07 20:23:25.546
cmw6up6tl0037q0w3rhucbhnx	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw6up6t30036q0w3fxyj72py	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:23:25.641
cmw6up6v30039q0w37rfu7bcd	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw6up6u20038q0w3ifotll7x	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-07 20:23:25.695
cmw6vab9c003bq0w3mvu7xdgd	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-07 20:39:51.168
cmw6vabil003dq0w3aznlfyfk	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-07 20:39:51.501
cmw6vabvu003fq0w3ahc1crur	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-07 20:39:51.978
cmw6vacfy003iq0w3hq594kl0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw6vacfr003hq0w3tgzkg40t	{"name": "Audit Student", "admissionNumber": "ADM-1794083992658"}	::1	node	2026-11-07 20:39:52.702
cmw7trunw003fpww37ndpkcpg	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-08 12:45:16.412
cmw6vacqe003kq0w3460gmn40	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw6vacq2003jq0w3fsgbotsl	{"studentId": "cmw6vacfr003hq0w3tgzkg40t", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-07 20:39:53.078
cmw6vacrz003nq0w37vqlxunf	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw6vacrs003lq0w3z3ls03ne	{"relation": "FATHER", "studentId": "cmw6vacfr003hq0w3tgzkg40t", "parentName": "Arthur Student"}	::1	node	2026-11-07 20:39:53.136
cmw6vad5c003qq0w3rprbwwod	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw6vad56003pq0w3oxqr8hux	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-3159", "designation": "Senior Faculty"}	::1	node	2026-11-07 20:39:53.616
cmw6vad6k003sq0w3nknq1pbj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw6vad6h003rq0w3nvuimfwy	{"code": "SUB-3639", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:39:53.66
cmw6vad9b003uq0w31o7q5toc	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:39:53.759
cmw6vada1003wq0w30japvo8h	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-07 20:39:53.786
cmw6vadck003yq0w3s7i1d8cp	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-07 20:39:53.876
cmw6vaddq0040q0w3p2fu9mle	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw6vaddm003zq0w3rnnz7wob	{"name": "Tuition & Science Lab 3899"}	::1	node	2026-11-07 20:39:53.918
cmw6vadf50042q0w3k4qk88nb	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw6vadei0041q0w3k8jezotm	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-07 20:39:53.969
cmw6vadg90044q0w3c20iov56	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw6vadfo0043q0w3sbn3njt7	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261107-3612"}	::1	node	2026-11-07 20:39:54.009
cmw6vadhl0046q0w35vy25f7r	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw6vadgz0045q0w3ixtn57p6	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261107-3612", "receiptNumber": "REC-20261107-8217", "remainingBalance": 600}	::1	node	2026-11-07 20:39:54.057
cmw6vadju0048q0w3htoyg9jj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw6vadjl0047q0w3lte9rjqa	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261107-3612", "refundReceipt": "REF-20261107-1376", "originalReceipt": "REC-20261107-8217"}	::1	node	2026-11-07 20:39:54.138
cmw6vadqk004fq0w3awt7fzrl	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw6vadps0049q0w3ai1q3oj4	{"name": "Academic Standard Scale 4324", "rulesCount": 5}	::1	node	2026-11-07 20:39:54.38
cmw6vadrp004hq0w3lmtc9aah	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw6vadrc004gq0w36lyg8qdt	{"name": "Mid-Term Examination 4389", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-07 20:39:54.421
cmw6vadty004jq0w3mk150dpg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw6vadt8004iq0w302zicbgg	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 4389", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:39:54.502
cmw6vadx1004lq0w350y6xd0m	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw6vadt8004iq0w302zicbgg	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-07 20:39:54.613
cmw6vadzb004pq0w3epdqhzrr	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw6vadrc004gq0w36lyg8qdt	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 3}	::1	node	2026-11-07 20:39:54.695
cmw6vae00004qq0w3gdxs8sba	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw6vadrc004gq0w36lyg8qdt	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 3}	::1	node	2026-11-07 20:39:54.72
cmw6vae8b004sq0w3k784ylg6	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw6vae75004rq0w3tgjq4lfu	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-07 20:39:55.019
cmw6vaead004uq0w39ei47ac8	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw6vae9l004tq0w3ysizo2rt	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-07 20:39:55.093
cmw6vaed7004wq0w3jj4nriug	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw6vaebn004vq0w37hyjlc43	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-07 20:39:55.195
cmw7tfm810001a8w3g2wn0twp	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-08 12:35:45.601
cmw7tfmhz0003a8w3f3nbyihh	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-08 12:35:45.96
cmw7tfmq10005a8w3wyv1ox85	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-08 12:35:46.249
cmw7tfni90008a8w384x3fo7l	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw7tfnhn0007a8w38szgm7yh	{"name": "Audit Student", "admissionNumber": "ADM-1794141347193"}	::1	node	2026-11-08 12:35:47.265
cmw7tfnvf000aa8w35i1w4a8z	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw7tfnuy0009a8w3nnhb97co	{"studentId": "cmw7tfnhn0007a8w38szgm7yh", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-08 12:35:47.739
cmw7tfnxy000da8w3jnldo1y1	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw7tfnx5000ba8w3jm7ankio	{"relation": "FATHER", "studentId": "cmw7tfnhn0007a8w38szgm7yh", "parentName": "Arthur Student"}	::1	node	2026-11-08 12:35:47.83
cmw7tfoby000ga8w3v7wriis9	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw7tfobt000fa8w3mnkd8698	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-7874", "designation": "Senior Faculty"}	::1	node	2026-11-08 12:35:48.334
cmw7tfoeh000ia8w3x5vjm8ko	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw7tfoed000ha8w3vbxywv0p	{"code": "SUB-8361", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:35:48.425
cmw7tfoi8000ma8w34qm08gbk	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:35:48.56
cmw7tfome000qa8w3i6bkq4tg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw7tfomb000pa8w3a5e80q3v	{"name": "Tuition & Science Lab 8684"}	::1	node	2026-11-08 12:35:48.71
cmw7tfohf000ka8w3uqwjah98	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:35:48.531
cmw7tfokp000oa8w372dwpdzr	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-08 12:35:48.649
cmw7tfoo9000sa8w338af03v5	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw7tfonf000ra8w38kh64k8g	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-08 12:35:48.777
cmw7tfopr000ua8w3vnnaxhwg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw7tfop2000ta8w37bmv5kr5	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261108-7788"}	::1	node	2026-11-08 12:35:48.831
cmw7tform000wa8w3u24ly9wh	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw7tfoqu000va8w3d8srh9y4	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261108-7788", "receiptNumber": "REC-20261108-7806", "remainingBalance": 600}	::1	node	2026-11-08 12:35:48.898
cmw7tfoui000ya8w3uqmi453g	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw7tfou8000xa8w3hkr9on3u	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261108-7788", "refundReceipt": "REF-20261108-2371", "originalReceipt": "REC-20261108-7806"}	::1	node	2026-11-08 12:35:49.002
cmw7tfp7q0015a8w3ibyxkykf	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw7tfp74000za8w3ejci940a	{"name": "Academic Standard Scale 9373", "rulesCount": 5}	::1	node	2026-11-08 12:35:49.478
cmw7tfp970017a8w3leo1pgak	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw7tfp8s0016a8w3216yh86e	{"name": "Mid-Term Examination 9486", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-08 12:35:49.531
cmw7tfpui001ia8w3i025asax	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw7tfptj001ha8w394fdea64	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-08 12:35:50.298
cmw7tfpwy001ka8w3dg39r5qn	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw7tfpwa001ja8w367qefp7t	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:35:50.386
cmw7tfpzb001ma8w3x2xwvedu	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw7tfpxt001la8w3408lmf6e	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-08 12:35:50.471
cmw7tfpby0019a8w3wyi7s84z	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw7tfpbh0018a8w3m7wt4n3g	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 9486", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:35:49.63
cmw7tfpgq001ba8w3ad6qf8sy	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw7tfpbh0018a8w3m7wt4n3g	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-08 12:35:49.802
cmw7tfpkt001fa8w3myfuzyxo	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw7tfp8s0016a8w3216yh86e	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 3}	::1	node	2026-11-08 12:35:49.949
cmw7tfplp001ga8w36b0c96f4	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw7tfp8s0016a8w3216yh86e	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 3}	::1	node	2026-11-08 12:35:49.982
cmw7tm5mw0001pww3y9nedvq3	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-08 12:40:50.696
cmw7tm5vx0003pww3v0sitobv	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-08 12:40:51.021
cmw7tm6440005pww3own9moan	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-08 12:40:51.316
cmw7tm6u60008pww3fcwxu7n3	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw7tm6tp0007pww3yxucli6e	{"name": "Audit Student", "admissionNumber": "ADM-1794141652135"}	::1	node	2026-11-08 12:40:52.254
cmw7tm7m8000apww3vhrsvgm6	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw7tm7lk0009pww3f623j2sz	{"studentId": "cmw7tm6tp0007pww3yxucli6e", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-08 12:40:53.264
cmw7tm7oh000dpww3kboiyvcq	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw7tm7o1000bpww3lmtto9ks	{"relation": "FATHER", "studentId": "cmw7tm6tp0007pww3yxucli6e", "parentName": "Arthur Student"}	::1	node	2026-11-08 12:40:53.346
cmw7tm81n000gpww3zqovc85n	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw7tm81f000fpww3dygbmx5z	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-3390", "designation": "Senior Faculty"}	::1	node	2026-11-08 12:40:53.819
cmw7tm83e000ipww30nfy5uc5	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw7tm83a000hpww3i8gfj75o	{"code": "SUB-3854", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:40:53.882
cmw7tm87f000kpww3mm2eiwpi	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:40:54.027
cmw7tm88i000mpww3kzam3e8g	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:40:54.066
cmw7tm8c8000opww30ocs3h0d	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-08 12:40:54.2
cmw7tm8e3000qpww3b80qn1c8	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw7tm8dz000ppww3w1158eyo	{"name": "Tuition & Science Lab 4237"}	::1	node	2026-11-08 12:40:54.267
cmw7tm8fz000spww3v583ehfw	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw7tm8f7000rpww3rpmlhdg5	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-08 12:40:54.335
cmw7tm8hn000upww3f573x7dj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw7tm8h1000tpww3xdemh6af	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261108-4995"}	::1	node	2026-11-08 12:40:54.395
cmw7tm8ji000wpww3vke7jnlz	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw7tm8is000vpww3msfs0g9q	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261108-4995", "receiptNumber": "REC-20261108-9906", "remainingBalance": 600}	::1	node	2026-11-08 12:40:54.462
cmw7tm8mq000ypww3fxs04xyn	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw7tm8me000xpww3cq6bbt6c	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261108-4995", "refundReceipt": "REF-20261108-2879", "originalReceipt": "REC-20261108-9906"}	::1	node	2026-11-08 12:40:54.578
cmw7tm8ws0015pww3uwj2df0i	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw7tm8w4000zpww3o15ln88n	{"name": "Academic Standard Scale 4835", "rulesCount": 5}	::1	node	2026-11-08 12:40:54.94
cmw7tm8y50017pww3lmkkeken	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw7tm8xq0016pww3h08k0sad	{"name": "Mid-Term Examination 4952", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-08 12:40:54.989
cmw7tm91z0019pww3z5q3i3je	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw7tm91l0018pww3tw76lu3d	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 4952", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:40:55.127
cmw7tm973001bpww3r72upnvb	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw7tm91l0018pww3tw76lu3d	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-08 12:40:55.311
cmw7tm9au001fpww3to1a0iu4	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw7tm8xq0016pww3h08k0sad	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 3}	::1	node	2026-11-08 12:40:55.446
cmw7tm9c2001gpww32yeo5ej3	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw7tm8xq0016pww3h08k0sad	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 3}	::1	node	2026-11-08 12:40:55.49
cmw7tm9nw001ipww3zauw7sk9	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw7tm9ne001hpww3xnmo5faw	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-08 12:40:55.916
cmw7tm9qv001kpww3j79wrdjf	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw7tm9q8001jpww34sd333sg	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:40:56.023
cmw7tm9t7001mpww3cwrwoptl	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw7tm9rq001lpww3r1qqtvqi	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-08 12:40:56.107
cmw7tqcsk001opww3sngyrvrt	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-08 12:44:06.596
cmw7tqd0i001qpww3h49h0t4i	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-08 12:44:06.882
cmw7tqd8r001spww307741da9	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-08 12:44:07.179
cmw7tqdlu001vpww3q9fq6q1i	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw7tqdln001upww3dy60bd4p	{"name": "Audit Student", "admissionNumber": "ADM-1794141847611"}	::1	node	2026-11-08 12:44:07.65
cmw7tqdvm001xpww32me2iwg3	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw7tqdvc001wpww3k69hhev8	{"studentId": "cmw7tqdln001upww3dy60bd4p", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-08 12:44:08.002
cmw7tqdxm0020pww3n3m27zqy	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw7tqdx3001ypww3r564icgq	{"relation": "FATHER", "studentId": "cmw7tqdln001upww3dy60bd4p", "parentName": "Arthur Student"}	::1	node	2026-11-08 12:44:08.074
cmw7tqeg60023pww3aln8qtfj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw7tqefy0022pww3v2hpk5gl	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-8120", "designation": "Senior Faculty"}	::1	node	2026-11-08 12:44:08.742
cmw7tqeho0025pww3ett7u12c	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw7tqehj0024pww3xkms4drv	{"code": "SUB-8774", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:44:08.796
cmw7tqell0027pww3s7lsk5ra	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:44:08.937
cmw7tqeml0029pww3c87z9bs7	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:44:08.973
cmw7tqept002bpww3lqelggc0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-08 12:44:09.089
cmw7tqerc002dpww3nz1l5uy9	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw7tqer9002cpww3f94mlc10	{"name": "Tuition & Science Lab 9122"}	::1	node	2026-11-08 12:44:09.144
cmw7tqesj002fpww3fwcenlpy	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw7tqerw002epww36555qzau	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-08 12:44:09.187
cmw7tqett002hpww3hwx94u0g	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw7tqet7002gpww3fewezwfu	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261108-4882"}	::1	node	2026-11-08 12:44:09.233
cmw7tqevb002jpww314waexr7	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw7tqeuo002ipww37s65rri7	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261108-4882", "receiptNumber": "REC-20261108-6254", "remainingBalance": 600}	::1	node	2026-11-08 12:44:09.287
cmw7tqexl002lpww3z2a4trf3	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw7tqexe002kpww31dvmap1d	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261108-4882", "refundReceipt": "REF-20261108-7517", "originalReceipt": "REC-20261108-6254"}	::1	node	2026-11-08 12:44:09.369
cmw7tqf4e002spww3xfylvz4j	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw7tqf3s002mpww3zs34zfjh	{"name": "Academic Standard Scale 9566", "rulesCount": 5}	::1	node	2026-11-08 12:44:09.614
cmw7tqf5l002upww3nf3y74rx	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw7tqf58002tpww3ooqmfcya	{"name": "Mid-Term Examination 9625", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-08 12:44:09.657
cmw7tqf8t002wpww3hsj8l73d	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw7tqf8g002vpww3au989f0w	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 9625", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:44:09.773
cmw7tqfco002ypww3asydj6u6	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw7tqf8g002vpww3au989f0w	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-08 12:44:09.912
cmw7tqfeh0032pww3uolfdu5f	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw7tqf58002tpww3ooqmfcya	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 3}	::1	node	2026-11-08 12:44:09.977
cmw7tqffa0033pww3160akxws	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw7tqf58002tpww3ooqmfcya	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 3}	::1	node	2026-11-08 12:44:10.006
cmw7tqfkp0035pww36g66sls3	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw7tqfk50034pww3yb9vvegv	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-08 12:44:10.201
cmw7tqfm90037pww3f8qntut7	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw7tqflv0036pww36i57es4s	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:44:10.257
cmw7tqfnp0039pww3q6t0u3hu	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw7tqfmq0038pww3cmvoba9g	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-08 12:44:10.309
cmw7tru8a003bpww3kgare1zy	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-08 12:45:15.85
cmw7truge003dpww3e6je01bw	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-08 12:45:16.142
cmw7truys003ipww3py1yaidm	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw7truym003hpww3eszvpph2	{"name": "Audit Student", "admissionNumber": "ADM-1794141916770"}	::1	node	2026-11-08 12:45:16.804
cmw7trv7x003kpww306t79e89	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw7trv7o003jpww3av4dfl4j	{"studentId": "cmw7truym003hpww3eszvpph2", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-08 12:45:17.133
cmw7trv9h003npww34o9mon3j	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw7trv90003lpww32timtbyp	{"relation": "FATHER", "studentId": "cmw7truym003hpww3eszvpph2", "parentName": "Arthur Student"}	::1	node	2026-11-08 12:45:17.189
cmw7trvhb003qpww3sv4u2qwg	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw7trvh4003ppww36wqjm2z6	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-7223", "designation": "Senior Faculty"}	::1	node	2026-11-08 12:45:17.471
cmw7trvif003spww3w6slqcmk	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw7trvic003rpww3h1a3x48f	{"code": "SUB-7493", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:45:17.511
cmw7trvl8003upww3k2vlvryn	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:45:17.612
cmw7trvly003wpww3omk9nlig	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:45:17.638
cmw7trvoj003ypww3v95fl3k2	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-08 12:45:17.731
cmw7trvpq0040pww3oyc5kn2o	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw7trvpn003zpww3cb8iqu8w	{"name": "Tuition & Science Lab 7755"}	::1	node	2026-11-08 12:45:17.774
cmw7trvr20042pww3krcmvku6	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw7trvqc0041pww37wefxp6q	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-08 12:45:17.823
cmw7trvsh0044pww3g76cfxlr	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw7trvrw0043pww3d37utqqk	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261108-3686"}	::1	node	2026-11-08 12:45:17.873
cmw7trvtx0046pww3rz7ioaq7	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw7trvtb0045pww3dlql79tq	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261108-3686", "receiptNumber": "REC-20261108-5648", "remainingBalance": 600}	::1	node	2026-11-08 12:45:17.925
cmw7trvwi0048pww35gaux17n	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw7trvw90047pww3uil5gxwz	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261108-3686", "refundReceipt": "REF-20261108-6424", "originalReceipt": "REC-20261108-5648"}	::1	node	2026-11-08 12:45:18.018
cmw7trw3q004fpww319wnluma	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw7trw340049pww3dtyca9n5	{"name": "Academic Standard Scale 8225", "rulesCount": 5}	::1	node	2026-11-08 12:45:18.278
cmw7trw55004hpww3rn57xja4	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw7trw4o004gpww372ekwovb	{"name": "Mid-Term Examination 8287", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-08 12:45:18.329
cmw7trwbr004jpww38zjbn15g	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw7trwb2004ipww3upekmr0a	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:45:18.567
cmw7trwdt004lpww3ba1weg16	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw7trwci004kpww3qjegzx2u	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-08 12:45:18.641
cmw7tudz6004npww3j9vp2pqj	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-08 12:47:14.754
cmw7tue84004ppww37ud2lieo	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-08 12:47:15.077
cmw7tuegp004rpww3i12jg5v8	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-08 12:47:15.385
cmw7tuete004upww3znmnxbxe	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw7tuet8004tpww325ye8j76	{"name": "Audit Student", "admissionNumber": "ADM-1794142035804"}	::1	node	2026-11-08 12:47:15.842
cmw7tuf3d004wpww30387yy23	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw7tuf31004vpww3gfnrln89	{"studentId": "cmw7tuet8004tpww325ye8j76", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-08 12:47:16.201
cmw7tuf4u004zpww3qxdxu8bc	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw7tuf4m004xpww3lczq05jh	{"relation": "FATHER", "studentId": "cmw7tuet8004tpww325ye8j76", "parentName": "Arthur Student"}	::1	node	2026-11-08 12:47:16.254
cmw7tufdt0052pww38zm0w2f4	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw7tufdo0051pww31oei2syp	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-6288", "designation": "Senior Faculty"}	::1	node	2026-11-08 12:47:16.578
cmw7tuff70054pww3jd3f3b3i	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw7tuff40053pww3zmr2xgw1	{"code": "SUB-6604", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:47:16.627
cmw7tufhz0056pww32lgw6439	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:47:16.727
cmw7tufiv0058pww3eh9tzkxa	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:47:16.759
cmw7tuflm005apww33uwuz98z	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-08 12:47:16.858
cmw7tufn4005cpww3aasyje34	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw7tufn0005bpww3mbgjy0k2	{"name": "Tuition & Science Lab 6884"}	::1	node	2026-11-08 12:47:16.912
cmw7tufoq005epww3ta91ttv0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw7tufny005dpww3ovwkpsda	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-08 12:47:16.97
cmw7tufq4005gpww36zdwed1o	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw7tufpi005fpww3tj2i43cf	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261108-6400"}	::1	node	2026-11-08 12:47:17.02
cmw7tufrk005ipww3g8n486vj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw7tufqx005hpww345h3o4rs	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261108-6400", "receiptNumber": "REC-20261108-9836", "remainingBalance": 600}	::1	node	2026-11-08 12:47:17.072
cmw7tufu9005kpww3xogui14o	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw7tuftz005jpww34rploagw	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261108-6400", "refundReceipt": "REF-20261108-8125", "originalReceipt": "REC-20261108-9836"}	::1	node	2026-11-08 12:47:17.169
cmw7tug2a005rpww3ckz9auas	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw7tug1n005lpww3b9kkoeg6	{"name": "Academic Standard Scale 7406", "rulesCount": 5}	::1	node	2026-11-08 12:47:17.458
cmw7tug3q005tpww32lkcwyx2	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw7tug3a005spww3nh4yh5oa	{"name": "Mid-Term Examination 7469", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-08 12:47:17.51
cmw7tugcb005vpww3iln36oyf	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw7tugbn005upww3q4uxekvd	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:47:17.819
cmw7tuge9005xpww3dkhoy4s1	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw7tugd0005wpww3iyu0majg	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-08 12:47:17.889
cmw7u1665005zpww3lpi2n2ow	\N	cmt3yi19g0000ckk93r0adndy	USER_LOGIN	users	cmt3yi19g0000ckk93r0adndy	{"role": "SUPER_ADMIN", "email": "superadmin@schoolerp.com"}	::1	node	2026-11-08 12:52:31.229
cmw7u16du0061pww3ljo257f0	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	USER_LOGIN	users	cmt3yi19w0003ckk97pdcbs9k	{"role": "SCHOOL_ADMIN", "email": "admin@springfield.com"}	::1	node	2026-11-08 12:52:31.506
cmw7u16lm0063pww3kihtvnvy	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1c3000zckk9r0pkyt4q	USER_LOGIN	users	cmt3yi1c3000zckk9r0pkyt4q	{"role": "SCHOOL_ADMIN", "email": "admin@oakridge.com"}	::1	node	2026-11-08 12:52:31.786
cmw7u172y0066pww3s8xkxhrn	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_ENROLLED	students	cmw7u172q0065pww3lqs83vp7	{"name": "Audit Student", "admissionNumber": "ADM-1794142352370"}	::1	node	2026-11-08 12:52:32.411
cmw7u17i30068pww3pv2kwm2w	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STUDENT_PROMOTED	student_enrollments	cmw7u17hp0067pww3oa673g4p	{"studentId": "cmw7u172q0065pww3lqs83vp7", "targetClass": "Grade 9", "academicYear": "2025-2026", "targetSection": "Section A"}	::1	node	2026-11-08 12:52:32.955
cmw7u17jv006bpww3dbbd0fes	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	PARENT_REGISTERED	parents	cmw7u17jn0069pww3feqod6zo	{"relation": "FATHER", "studentId": "cmw7u172q0065pww3lqs83vp7", "parentName": "Arthur Student"}	::1	node	2026-11-08 12:52:33.019
cmw7u17yt006epww32zfb6tae	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TEACHER_CREATED	teachers	cmw7u17ym006dpww343a6nlap	{"name": "Eleanor Vance", "department": "Science", "employeeId": "EMP-TEST-3047", "designation": "Senior Faculty"}	::1	node	2026-11-08 12:52:33.557
cmw7u1808006gpww3q59h6n77	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	SUBJECT_CREATED	subjects	cmw7u1804006fpww37pl0521z	{"code": "SUB-3584", "name": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:52:33.608
cmw7u182n006ipww3kqm3zl2u	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:52:33.695
cmw7u183i006kpww33pp6p9ix	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	ATTENDANCE_MARKED	student_attendance	cmt3yi1a80007ckk93b27hqdy_cmt3yi1ai000bckk9xd3iusjj_2026-11-08	{"date": "2026-11-08", "className": "Grade 9", "sectionName": "Section A", "totalMarked": 1}	::1	node	2026-11-08 12:52:33.726
cmw7u185s006mpww3vzezlwmy	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	STAFF_ATTENDANCE_MARKED	staff_attendance	2026-11-08	{"date": "2026-11-08", "totalMarked": 1}	::1	node	2026-11-08 12:52:33.808
cmw7u186v006opww38suw5y60	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_CATEGORY_CREATED	fee_categories	cmw7u186t006npww355924m7x	{"name": "Tuition & Science Lab 3828"}	::1	node	2026-11-08 12:52:33.847
cmw7u1889006qpww3ydows7gy	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_STRUCTURE_CREATED	fee_structures	cmw7u187m006ppww3blrcnmqu	{"name": "Grade 10 Standard Annual Fee", "amount": 2500, "frequency": "ANNUAL"}	::1	node	2026-11-08 12:52:33.897
cmw7u189m006spww39vvv4ja7	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	INVOICE_GENERATED	student_fee_invoices	cmw7u1892006rpww30jbtqw7q	{"studentName": "Audit Student", "totalAmount": 1050, "invoiceNumber": "INV-20261108-4555"}	::1	node	2026-11-08 12:52:33.946
cmw7u18at006upww36kwt7yys	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_RECORDED	fee_payments	cmw7u18ab006tpww35litzwg3	{"status": "PARTIALLY_PAID", "amountPaid": 450, "studentName": "Audit Student", "invoiceNumber": "INV-20261108-4555", "receiptNumber": "REC-20261108-6353", "remainingBalance": 600}	::1	node	2026-11-08 12:52:33.989
cmw7u18d1006wpww3gqy5j0so	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	FEE_PAYMENT_REFUNDED	fee_payments	cmw7u18cu006vpww36f1vqz73	{"reason": "Duplicate lab course fee adjustment", "refundAmount": 150, "invoiceNumber": "INV-20261108-4555", "refundReceipt": "REF-20261108-3698", "originalReceipt": "REC-20261108-6353"}	::1	node	2026-11-08 12:52:34.069
cmw7u18kt0073pww312e92rid	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	GRADING_SCALE_CREATED	grading_scales	cmw7u18k8006xpww3s922pbf4	{"name": "Academic Standard Scale 4298", "rulesCount": 5}	::1	node	2026-11-08 12:52:34.349
cmw7u18m20075pww34o499j6a	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_CREATED	exams	cmw7u18ln0074pww36ezvhs7f	{"name": "Mid-Term Examination 4359", "term": "Term 1 Fall", "examType": "MID_TERM"}	::1	node	2026-11-08 12:52:34.394
cmw7u18p10077pww3dfym0c2x	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_SCHEDULE_CREATED	exam_schedules	cmw7u18os0076pww3uh7melyi	{"date": "2026-11-18", "time": "09:00 - 12:00", "examName": "Mid-Term Examination 4359", "className": "Grade 9", "subjectName": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:52:34.501
cmw7u18sh0079pww3g2l54a1u	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_MARKS_SUBMITTED	exam_marks	cmw7u18os0076pww3uh7melyi	{"maxMarks": 100, "recordsCount": 1}	::1	node	2026-11-08 12:52:34.625
cmw7u18vj007epww3e0d5k6n4	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_COMPILED	exam_results	cmw7u18ln0074pww36ezvhs7f	{"classId": "cmt3yi1a80007ckk93b27hqdy", "passCount": 1, "studentsProcessed": 4}	::1	node	2026-11-08 12:52:34.735
cmw7u18wb007fpww3862izyxu	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	EXAM_RESULTS_PUBLISHED	exam_results	cmw7u18ln0074pww36ezvhs7f	{"classId": "cmt3yi1a80007ckk93b27hqdy", "isPublished": true, "updatedCount": 4}	::1	node	2026-11-08 12:52:34.763
cmw7u1952007hpww39al699tu	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	TIMETABLE_ENTRY_CREATED	class_timetables	cmw7u194h007gpww3ibd448er	{"day": "MONDAY", "time": "08:30-09:15", "class": "Grade 9", "period": 1, "section": "Section A"}	::1	node	2026-11-08 12:52:35.078
cmw7u197q007jpww3035objcx	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_CREATED	homework	cmw7u1972007ipww32rtxekln	{"class": "Grade 9", "title": "Quantum Mechanical Particle in a Box", "dueDate": "2026-11-28", "subject": "Advanced Quantum Mechanics"}	::1	node	2026-11-08 12:52:35.174
cmw7u199n007lpww3pmlyfw50	cmt3yi19q0001ckk9cq8rknzc	cmt3yi19w0003ckk97pdcbs9k	HOMEWORK_EVALUATED	homework_submissions	cmw7u198q007kpww350g2zse8	{"marks": 96, "studentName": "Audit Student", "homeworkTitle": "Quantum Mechanical Particle in a Box"}	::1	node	2026-11-08 12:52:35.243
\.


--
-- Data for Name: class_subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.class_subjects (id, "schoolId", "classId", "subjectId", "teacherId", "createdAt") FROM stdin;
\.


--
-- Data for Name: class_timetables; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.class_timetables (id, "schoolId", "academicYearId", "classId", "sectionId", "subjectId", "teacherId", "dayOfWeek", "periodNumber", "periodName", "isBreak", "startTime", "endTime", "roomNumber", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classes (id, "schoolId", name, "order", "createdAt", "updatedAt") FROM stdin;
cmt3yi1a80007ckk93b27hqdy	cmt3yi19q0001ckk9cq8rknzc	Grade 9	9	2026-08-22 05:47:24.801	2026-08-22 05:47:24.801
cmt3yi1af0009ckk9u92twcvy	cmt3yi19q0001ckk9cq8rknzc	Grade 10	10	2026-08-22 05:47:24.807	2026-08-22 05:47:24.807
cmt3yi1ca0013ckk9s6524cfz	cmt3yi1c0000xckk9qvn7nqmx	Grade 10	10	2026-08-22 05:47:24.874	2026-08-22 05:47:24.874
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, "schoolId", "studentId", "teacherId", name, type, "fileUrl", "fileSize", "mimeType", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: exam_marks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_marks (id, "schoolId", "examScheduleId", "studentId", "theoryMarks", "practicalMarks", "internalMarks", "marksObtained", percentage, grade, "isAbsent", remarks, "gradedById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_results (id, "schoolId", "examId", "studentId", "classId", "sectionId", "totalMaxMarks", "totalObtainedMarks", percentage, gpa, "overallGrade", rank, status, "teacherRemarks", "principalRemarks", "isApproved", "isPublished", "approvedById", "publishedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: exam_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_schedules (id, "schoolId", "examId", "classId", "sectionId", "subjectId", "examDate", "startTime", "endTime", "roomNumber", "invigilatorTeacherId", "maxMarks", "passingMarks", "theoryMarksMax", "practicalMarksMax", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exams (id, "schoolId", "academicYearId", "gradingScaleId", name, "examType", term, "startDate", "endDate", status, description, "createdAt", "updatedAt") FROM stdin;
cmw7tqf58002tpww3ooqmfcya	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1a30005ckk9hlxv7bmw	cmw7tqf3s002mpww3zs34zfjh	Mid-Term Examination 9625	MID_TERM	Term 1 Fall	2026-11-15 00:00:00	2026-11-25 00:00:00	PUBLISHED	Mid-term summative assessment papers	2026-11-08 12:44:09.644	2026-11-08 12:44:10.002
\.


--
-- Data for Name: fee_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fee_categories (id, "schoolId", name, description, "createdAt", "updatedAt") FROM stdin;
cmw6tur7r000lhgw3qkh71mtw	cmt3yi19q0001ckk9cq8rknzc	Tuition & Science Lab 5712	Term tuition and laboratory usage fee structure	2026-11-07 19:59:45.735	2026-11-07 19:59:45.735
cmw7tqer9002cpww3f94mlc10	cmt3yi19q0001ckk9cq8rknzc	Tuition & Science Lab 9122	Term tuition and laboratory usage fee structure	2026-11-08 12:44:09.141	2026-11-08 12:44:09.141
\.


--
-- Data for Name: fee_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fee_payments (id, "schoolId", "invoiceId", "receiptNumber", amount, "paymentType", "paymentMethod", "transactionReference", remarks, "paymentDate", "recordedById", "createdAt", "updatedAt") FROM stdin;
cmw6turc9000rhgw37xnmqgz7	cmt3yi19q0001ckk9cq8rknzc	cmw6turah000phgw3yldiiz75	REC-20261107-9578	450.00	PAYMENT	CASH	\N	First installment via Visa portal	2026-11-07 19:59:45.897	cmt3yi19w0003ckk97pdcbs9k	2026-11-07 19:59:45.897	2026-11-07 19:59:45.897
cmw7tqeuo002ipww37s65rri7	cmt3yi19q0001ckk9cq8rknzc	cmw7tqet7002gpww3fewezwfu	REC-20261108-6254	450.00	PAYMENT	CARD	TXN-849239	First installment via Visa portal	2026-11-08 12:44:09.264	cmt3yi19w0003ckk97pdcbs9k	2026-11-08 12:44:09.264	2026-11-08 12:44:09.264
cmw7tqexe002kpww31dvmap1d	cmt3yi19q0001ckk9cq8rknzc	cmw7tqet7002gpww3fewezwfu	REF-20261108-7517	150.00	REFUND	CARD	REFUND_FOR_REC-20261108-6254	Duplicate lab course fee adjustment	2026-11-08 12:44:09.362	cmt3yi19w0003ckk97pdcbs9k	2026-11-08 12:44:09.362	2026-11-08 12:44:09.362
\.


--
-- Data for Name: fee_structures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fee_structures (id, "schoolId", "categoryId", "classId", "academicYearId", name, amount, frequency, "dueDate", "createdAt", "updatedAt") FROM stdin;
cmw6tur8u000nhgw34palm1hk	cmt3yi19q0001ckk9cq8rknzc	cmw6tur7r000lhgw3qkh71mtw	cmt3yi1a80007ckk93b27hqdy	cmt3yi1a30005ckk9hlxv7bmw	Grade 10 Standard Annual Fee	2500.00	ANNUAL	\N	2026-11-07 19:59:45.774	2026-11-07 19:59:45.774
cmw7tqerw002epww36555qzau	cmt3yi19q0001ckk9cq8rknzc	cmw7tqer9002cpww3f94mlc10	cmt3yi1a80007ckk93b27hqdy	cmt3yi1a30005ckk9hlxv7bmw	Grade 10 Standard Annual Fee	2500.00	ANNUAL	\N	2026-11-08 12:44:09.164	2026-11-08 12:44:09.164
\.


--
-- Data for Name: grading_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grading_rules (id, "gradingScaleId", grade, "minPercentage", "maxPercentage", "gradePoint", description, "order", "createdAt", "updatedAt") FROM stdin;
cmw7tqf3u002npww33mwm3bpc	cmw7tqf3s002mpww3zs34zfjh	A+	90.00	100.00	4.00	Outstanding	1	2026-11-08 12:44:09.592	2026-11-08 12:44:09.592
cmw7tqf3u002opww3g85touhk	cmw7tqf3s002mpww3zs34zfjh	A	80.00	89.90	3.70	Excellent	1	2026-11-08 12:44:09.592	2026-11-08 12:44:09.592
cmw7tqf3u002ppww3cph3djv0	cmw7tqf3s002mpww3zs34zfjh	B	70.00	79.90	3.00	Very Good	1	2026-11-08 12:44:09.592	2026-11-08 12:44:09.592
cmw7tqf3u002qpww3s0hjyo00	cmw7tqf3s002mpww3zs34zfjh	C	50.00	69.90	2.00	Satisfactory	1	2026-11-08 12:44:09.592	2026-11-08 12:44:09.592
cmw7tqf3u002rpww3qn3385zc	cmw7tqf3s002mpww3zs34zfjh	F	0.00	49.90	0.00	Unsatisfactory / Fail	1	2026-11-08 12:44:09.592	2026-11-08 12:44:09.592
\.


--
-- Data for Name: grading_scales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grading_scales (id, "schoolId", name, description, "isDefault", "createdAt", "updatedAt") FROM stdin;
cmw7tqf3s002mpww3zs34zfjh	cmt3yi19q0001ckk9cq8rknzc	Academic Standard Scale 9566	Standard 4.0 GPA and Letter Grade mapping	f	2026-11-08 12:44:09.592	2026-11-08 12:45:18.252
\.


--
-- Data for Name: homework; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.homework (id, "schoolId", "classId", "sectionId", "subjectId", "teacherId", title, description, "dueDate", "attachmentUrl", "createdAt", "updatedAt") FROM stdin;
cmw7tqflv0036pww36i57es4s	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1a80007ckk93b27hqdy	cmt3yi1ai000bckk9xd3iusjj	cmw7tqehj0024pww3xkms4drv	cmw7tqefy0022pww3v2hpk5gl	Quantum Mechanical Particle in a Box	Derive wave equations for 1-D infinite potential well	2026-11-28 00:00:00	\N	2026-11-08 12:44:10.243	2026-11-08 12:44:10.243
\.


--
-- Data for Name: homework_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.homework_submissions (id, "schoolId", "homeworkId", "studentId", "submissionText", "attachmentUrl", status, marks, feedback, "submittedAt", "evaluatedAt", "evaluatedById", "createdAt", "updatedAt") FROM stdin;
cmw7tqfmq0038pww3cmvoba9g	cmt3yi19q0001ckk9cq8rknzc	cmw7tqflv0036pww36i57es4s	cmw7tqdln001upww3dy60bd4p	Derived boundary conditions psi(0)=0 and psi(L)=0 yielding quantized energy states.	\N	EVALUATED	96.00	Exemplary mathematical rigor and clarity	2026-11-08 12:44:10.273	2026-11-08 12:44:10.299	cmt3yi19w0003ckk97pdcbs9k	2026-11-08 12:44:10.274	2026-11-08 12:44:10.301
\.


--
-- Data for Name: parent_students; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parent_students (id, "parentId", "studentId", relation, "createdAt", "isPrimary") FROM stdin;
cmt3yi1bv000wckk9fs608d8s	cmt3yi1bp000uckk9vtau04qn	cmt3yi1b9000ockk9eqh21iul	Father	2026-08-22 05:47:24.859	f
cmw6tuql6000chgw31s6r859s	cmw6tuqky000bhgw3twbvtgyq	cmw6tuq3o0007hgw3xg7xq69u	FATHER	2026-11-07 19:59:44.922	t
cmw7tqdx9001zpww3p7mwl5r6	cmw7tqdx3001ypww3r564icgq	cmw7tqdln001upww3dy60bd4p	FATHER	2026-11-08 12:44:08.061	t
\.


--
-- Data for Name: parents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parents (id, "schoolId", "userId", "firstName", "lastName", phone, email, address, "createdAt", "updatedAt", "emergencyContact", occupation) FROM stdin;
cmt3yi1bp000uckk9vtau04qn	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1bm000sckk9hecs9cnd	Homer	Simpson	+1-555-0100	parent.homer@springfield.com	\N	2026-08-22 05:47:24.853	2026-08-22 05:47:24.853	f	\N
cmw6tuqky000bhgw3twbvtgyq	cmt3yi19q0001ckk9cq8rknzc	\N	Arthur	Student	+15559998888	arthur.1794081584889@example.com	\N	2026-11-07 19:59:44.914	2026-11-07 19:59:44.914	t	Mechanical Engineer
cmw7tqdx3001ypww3r564icgq	cmt3yi19q0001ckk9cq8rknzc	\N	Arthur	Student	+15559998888	arthur.1794141848038@example.com	\N	2026-11-08 12:44:08.055	2026-11-08 12:44:08.055	t	Mechanical Engineer
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, "userId", token, "expiresAt", revoked, "createdAt") FROM stdin;
cmw6syz5y0000sww39bdeis00	cmt3yi19g0000ckk93r0adndy	fafbb4bad5b8652dc67c897c9181de7d9e58208b7a018e41bc98cb39c54e8261fb55830749d2abc5	2026-11-14 19:35:02.982	f	2026-11-07 19:35:03.046
cmw6syzu90004sww3hc34389s	cmt3yi1c3000zckk9r0pkyt4q	2d64f6d83e94899e974877699451c70aadbb82427ddafa83848927c978de7ce775d1f91cd618e9be	2026-11-14 19:35:03.919	f	2026-11-07 19:35:03.921
cmw6t03ix000jsww3ubt8ik4g	cmt3yi19g0000ckk93r0adndy	ea7b27b0bfef145a4ad7e7a97114ea6b06ca4744fc9abaec697d24ceded0c193b1e0be9d6f3d0a59	2026-11-14 19:35:55.352	f	2026-11-07 19:35:55.353
cmw6t04dg000nsww3j6blq4d1	cmt3yi1c3000zckk9r0pkyt4q	56042af012dbd2e824ca9da64cddaf9331b72de6424f071eb2102caa7a5876b0996c142ff6d2e537	2026-11-14 19:35:56.451	f	2026-11-07 19:35:56.452
cmw6syzjw0002sww3zn00855m	cmt3yi19w0003ckk97pdcbs9k	08caa49c2675bd6a048454af76332e1c4316fc0816320fac673fa0aae31b64024e6695a8ce36a654	2026-11-14 19:35:03.547	t	2026-11-07 19:35:03.548
cmw6tuoxq0000hgw3ylvcrvhn	cmt3yi19g0000ckk93r0adndy	2dd03493530086f2e781f550dd2232a7c3cd4acb7fca594b11e75877be68dfbae969089315f639f8	2026-11-14 19:59:42.718	f	2026-11-07 19:59:42.782
cmw6tupmk0004hgw3tjih9ogv	cmt3yi1c3000zckk9r0pkyt4q	9de19b2860b18d53034cd6010e9f0c713e2e68fe9b3826a08b64a1f4a96f15a6278d8a9773660910	2026-11-14 19:59:43.675	f	2026-11-07 19:59:43.676
cmw6tysmf000thgw3aub2k3i6	cmt3yi19g0000ckk93r0adndy	78cf4557c3e55343eb9b879ce5d997837b33f4c550ecc5e979b77ffe555b205b97fcd188635db001	2026-11-14 20:02:54.182	f	2026-11-07 20:02:54.183
cmw6tyt6f000xhgw3aeok3q3a	cmt3yi1c3000zckk9r0pkyt4q	7b953dca203b67cca294c84fda257477e9e6e05bd7411350bb5adee0f69f915eb53030d97aabd705	2026-11-14 20:02:54.902	f	2026-11-07 20:02:54.903
cmw6u0pe9001qhgw3atv0upc9	cmt3yi19g0000ckk93r0adndy	8f2e9785b740e3ee914e913f7864cdcc886814d059d7705d31a4923fd8d7cce37fe781f5f1f97973	2026-11-14 20:04:23.312	f	2026-11-07 20:04:23.313
cmw6u0puo001uhgw360mwcgcq	cmt3yi1c3000zckk9r0pkyt4q	dd84dba353dbfd12d61d9a677239cee5d748ece241abcfd77a908ff832e39118f033cb7af474bf0b	2026-11-14 20:04:23.904	f	2026-11-07 20:04:23.904
cmw6u1ria0000r0w3x7bw0xgy	cmt3yi19g0000ckk93r0adndy	1c13b44b761256df652c06a40376c560050113111ec864de0bad543faec975c7fb543f96e2951664	2026-11-14 20:05:12.612	f	2026-11-07 20:05:12.706
cmw6u1s5f0004r0w357my5mug	cmt3yi1c3000zckk9r0pkyt4q	efb857a491cc9da59270e866563bcc465442ba66cae4c7b3d95bbbdf24703f03f0d097151b3b9440	2026-11-14 20:05:13.538	f	2026-11-07 20:05:13.539
cmw6um80y0000hsw36bvx0nfj	cmt3yi19g0000ckk93r0adndy	84790a10a8d8afccdefbce0dbb49fd28e05fae79708bf6087de4d5228e301c5b3b6fcecce070dbd6	2026-11-14 20:21:07.203	f	2026-11-07 20:21:07.234
cmw6um8xf0004hsw3g9s3gv1c	cmt3yi1c3000zckk9r0pkyt4q	8938daa1dc2594c39b703486b9a0e453371c6f168dbaf227708457961c835ffd2083283aa88da433	2026-11-14 20:21:08.402	f	2026-11-07 20:21:08.403
cmw6uo38l0000q0w39aeimi2z	cmt3yi19g0000ckk93r0adndy	a3de660150b2cf609a29dfb3d679b9567ec55f75793723d65b388f41c44e8d1848c9a53a56267192	2026-11-14 20:22:34.264	f	2026-11-07 20:22:34.344
cmw6uo4hj0004q0w3bco4eh2y	cmt3yi1c3000zckk9r0pkyt4q	7fc8461b1283cd80a83123e1122155bd5d997547ceb720d019cbd6146c847f267420b417ccb20611	2026-11-14 20:22:35.957	f	2026-11-07 20:22:35.959
cmw6up42p001nq0w3z38yii0t	cmt3yi19g0000ckk93r0adndy	7be39bb97699cfbc3d34098afef725d6a83d5d8cd7f8f7f8152fb9748bb245c13b2fc037d002ffc8	2026-11-14 20:23:22.08	f	2026-11-07 20:23:22.081
cmw6up4lt001rq0w3m5rk4ape	cmt3yi1c3000zckk9r0pkyt4q	7bae05d15765d0fb0f4863aa0e89724334f808420f9268ff11b55d555dfeed874f7da139b2afa0b7	2026-11-14 20:23:22.768	f	2026-11-07 20:23:22.769
cmw6vab95003aq0w3yw1h05aa	cmt3yi19g0000ckk93r0adndy	bc8f3530af7ab2bc3ac2f1774a64289c41c2456234583311ab655ef9d5b3a07d7381e5ef794f69cf	2026-11-14 20:39:51.161	f	2026-11-07 20:39:51.161
cmw6vabvr003eq0w3w1n57wm6	cmt3yi1c3000zckk9r0pkyt4q	4786ecf39f12903f3629b1578dfbd7ac9eab1b8cb05a9847162254f494a7f4b3677085f897926567	2026-11-14 20:39:51.973	f	2026-11-07 20:39:51.975
cmw7tfm6p0000a8w3faxht70r	cmt3yi19g0000ckk93r0adndy	178185b1ad3944df98ca06731b1241489aafc33f000eca34a5aef47291c48114cd1b224228393759	2026-11-15 12:35:45.521	f	2026-11-08 12:35:45.553
cmw7tfmpx0004a8w3odywfkno	cmt3yi1c3000zckk9r0pkyt4q	8d6e709e6263adba8c5b64c7eeb0358b8a892fe0e3ee79e4827c1372eacca44936c59c996dc4535b	2026-11-15 12:35:46.244	f	2026-11-08 12:35:46.245
cmw7tm5m60000pww3j2flgzw9	cmt3yi19g0000ckk93r0adndy	71d2c7908c14bce7b794df9404739a77a17bcda8e1fae0006c31cd8920a83ebdbc77dac2295f3ce8	2026-11-15 12:40:50.642	f	2026-11-08 12:40:50.67
cmw7tm6400004pww3jnyknbpo	cmt3yi1c3000zckk9r0pkyt4q	c7f8c32dbca4f9e372f2bac2546fcb841254a9b6e6edec6fdef853742b981ad501d02187f7255f17	2026-11-15 12:40:51.311	f	2026-11-08 12:40:51.312
cmw7tqcse001npww3w3qooag0	cmt3yi19g0000ckk93r0adndy	74cc5347ec21e1033e17ce8584096bd7498a8a427b4631575d87bcc5f8ea2953486b89d7c6b50f17	2026-11-15 12:44:06.589	f	2026-11-08 12:44:06.59
cmw7tqd8o001rpww3gefaj8se	cmt3yi1c3000zckk9r0pkyt4q	5d308705615b9f0ec1ca80184d19748ba3ee7ff2a35da7ce4f63d4554461688d7a3561956a9289ea	2026-11-15 12:44:07.176	f	2026-11-08 12:44:07.176
cmw7tru83003apww37tjz4kla	cmt3yi19g0000ckk93r0adndy	35e6d4a7109f117af73cd6434e10c7787249b70b35aabeb735f8c54ac145d254bf3b19dab85dc442	2026-11-15 12:45:15.843	f	2026-11-08 12:45:15.843
cmw7trunt003epww3mszjb0ih	cmt3yi1c3000zckk9r0pkyt4q	84871e55af809628a4be7444fa4f6b3b88899b7cc232cf9342f769675ff81089a42a363d28ea115c	2026-11-15 12:45:16.409	f	2026-11-08 12:45:16.41
cmw6syzvl0006sww3tbiss9rc	cmt3yi19w0003ckk97pdcbs9k	9cc53802f2f5d427cab5f3ba65342c0ef1c8f4a028c19a8e4537b810c3b7166eeca094fef0cf847d	2026-11-14 19:35:03.967	t	2026-11-07 19:35:03.969
cmw6t03uz000lsww3dirbudkr	cmt3yi19w0003ckk97pdcbs9k	b0c2834cb7c24d05eb8d822dc46f88385ae8d6439fba51ce36ad7793369bb8a1d6e4c282430f34ca	2026-11-14 19:35:55.786	t	2026-11-07 19:35:55.787
cmw6t04eo000psww36qwhtxh8	cmt3yi19w0003ckk97pdcbs9k	cce6c08e6e94470df63e9cd1940336adaa62c4bf8114f6dd4b885680a36cb80a26dea3eaeea66a84	2026-11-14 19:35:56.495	t	2026-11-07 19:35:56.496
cmw6tupd60002hgw3vdnpapvn	cmt3yi19w0003ckk97pdcbs9k	b8da7ece81962ce5dac5651baf608e0b0f89f0350452be55fe7c975dd902e6e5cfe4c46ee97a564f	2026-11-14 19:59:43.337	t	2026-11-07 19:59:43.338
cmw6tupob0006hgw34nakndsp	cmt3yi19w0003ckk97pdcbs9k	e1789875e151c0a6ba0252f1c0abe7da6af3c933a855837fa11cfdffc30a9f50cd5b6673cb12a4fa	2026-11-14 19:59:43.739	t	2026-11-07 19:59:43.739
cmw6tysut000vhgw3eqvgc9wb	cmt3yi19w0003ckk97pdcbs9k	39342e80d44252c3e1066dc4cfd9e21199cc5d961ffa1ff7288d62579e04b89164f4bc864acee016	2026-11-14 20:02:54.484	t	2026-11-07 20:02:54.485
cmw6tyt7q000zhgw30zood3im	cmt3yi19w0003ckk97pdcbs9k	4d2d0a4e82e95e9fb3851e28b553bc3ebd643a03577aaa8b37e5ab789e02152fe0ea4a3b089862aa	2026-11-14 20:02:54.949	t	2026-11-07 20:02:54.95
cmw6u0pn2001shgw3rf6npbee	cmt3yi19w0003ckk97pdcbs9k	0b28d9c5a1c7eaf3306fb87435a85fe290f87d8f2fa8d031a9931c18027f4910f308e5f61c74045f	2026-11-14 20:04:23.629	t	2026-11-07 20:04:23.63
cmw6u0pvj001whgw37pvoxtln	cmt3yi19w0003ckk97pdcbs9k	06505a70ee42e926c6a6ebbb5c69a66493c5ef1f13bdc37fab1206abd43a484fbb62bd393c88793a	2026-11-14 20:04:23.935	t	2026-11-07 20:04:23.935
cmw6u1rxk0002r0w3ptyb2uw9	cmt3yi19w0003ckk97pdcbs9k	5de67a39a63b1b0002857d140427066db5fe8c22d042a021696c63b57b9ae556169cf65b461b4ea6	2026-11-14 20:05:13.254	t	2026-11-07 20:05:13.256
cmw6u1s6p0006r0w3f00boh8x	cmt3yi19w0003ckk97pdcbs9k	9684d8e8e881dd4e2693f75898f14ae7457f5625319b8df3f41759c98f443652754c5937d5aed18e	2026-11-14 20:05:13.584	t	2026-11-07 20:05:13.585
cmw6um8le0002hsw33o1kvza9	cmt3yi19w0003ckk97pdcbs9k	cc1aad14d99133a0c91e29e886977913590e04be670bfecf5b1ced8d384e3a3195016e46c6e1b0cd	2026-11-14 20:21:07.968	t	2026-11-07 20:21:07.97
cmw7tudyy004mpww3sic9rluv	cmt3yi19g0000ckk93r0adndy	f62a5bcfe32bf062099b935a12b54459b1d856b5124b93a2d15c5c696e74eb03a7a9a7c5ba871022	2026-11-15 12:47:14.746	f	2026-11-08 12:47:14.746
cmw7tuegj004qpww3rvcy2yzu	cmt3yi1c3000zckk9r0pkyt4q	327903e7fe6fe9a03fc18915d2539a03c3d3f67f1dd0e3e2e70bcf22205a6059b3074922e518b0e5	2026-11-15 12:47:15.379	f	2026-11-08 12:47:15.379
cmw7u165g005ypww39sse2xpr	cmt3yi19g0000ckk93r0adndy	87b2be1ff11c7246599b68b3c0b0e85f3408dd29e46b30727e3594ebd13dcaaba515642f53f2f38d	2026-11-15 12:52:31.204	f	2026-11-08 12:52:31.204
cmw7u16lk0062pww3ka9iovkh	cmt3yi1c3000zckk9r0pkyt4q	6b65f340ceece652c09e0cf4a2a9d5f0103d2bdd1e8c2f997bc1bdf5ccc497278f90764cca714237	2026-11-15 12:52:31.783	f	2026-11-08 12:52:31.784
cmw6um8z40006hsw31mt7vgds	cmt3yi19w0003ckk97pdcbs9k	4a48081b1b24eedd0352f480ad93ada2d94d15b4af8066656d95cdd999bbbe16a99e97da8b2bd5e4	2026-11-14 20:21:08.463	t	2026-11-07 20:21:08.464
cmw6uo3sj0002q0w3mcq1dq8j	cmt3yi19w0003ckk97pdcbs9k	39a42c3da1d55006e7269758ddd1d9c8d96d0e61c547704dd11845a896fcb8afa5c9c68aedf28073	2026-11-14 20:22:35.057	t	2026-11-07 20:22:35.059
cmw6uo4jj0006q0w31i0t4h2h	cmt3yi19w0003ckk97pdcbs9k	42bbdc96d697cce9f08f4460625843c72aeceb603997730d7240a7233e4ea8fad6a31f6159322c4a	2026-11-14 20:22:36.031	t	2026-11-07 20:22:36.031
cmw6up4b1001pq0w3h0ftflqe	cmt3yi19w0003ckk97pdcbs9k	81d8428c507cfcde65d54eef7efab5c4eb9ad2e2db60893a66d0e5175c78c0f3d2e9c0aaa2f98706	2026-11-14 20:23:22.38	t	2026-11-07 20:23:22.381
cmw6up4my001tq0w3ino711gp	cmt3yi19w0003ckk97pdcbs9k	d437f93bf0b625f2dd9eb3a4079dff3bbc2e8705b5f3e791611ef8da348451ae07ed9614d6dc0c49	2026-11-14 20:23:22.81	t	2026-11-07 20:23:22.811
cmw6vabih003cq0w3wyk0zl46	cmt3yi19w0003ckk97pdcbs9k	cea427936cb93d62e35c3c5857af4e366bb58bb078b79c0589b55ba4b685232ef3b65ae782042ae0	2026-11-14 20:39:51.497	t	2026-11-07 20:39:51.497
cmw6vabws003gq0w3ivqshlch	cmt3yi19w0003ckk97pdcbs9k	4991a4224ddfc7915762ef4455b16aa7ead251b57c8ee9e249d763c428aa450be2675190e6b4d784	2026-11-14 20:39:52.011	t	2026-11-07 20:39:52.012
cmw7tfmhq0002a8w3snkgapwa	cmt3yi19w0003ckk97pdcbs9k	711abaf4c6a1ae0c425e21301e7ce493dac5ccb95f4d4ad92da010be1ec767b455f06f744d1fc67e	2026-11-15 12:35:45.949	t	2026-11-08 12:35:45.95
cmw7tfmrd0006a8w3tzunddr2	cmt3yi19w0003ckk97pdcbs9k	90055d23eb47e46439b342ab53173efd39e213515544bb0a1adf328169f92fc155584690cff0b875	2026-11-15 12:35:46.296	t	2026-11-08 12:35:46.297
cmw7tm5vs0002pww3zxpfvg6m	cmt3yi19w0003ckk97pdcbs9k	6413af9f0eb84f2ebfb508547a4db529ed31c37671065e2006915c38a22389e88a8411d483b94c2a	2026-11-15 12:40:51.015	t	2026-11-08 12:40:51.016
cmw7tm65i0006pww3vgw523wp	cmt3yi19w0003ckk97pdcbs9k	fb429beb3a0c1806420a91f520ada34533a035a1b2629f2e3f96217585ce8c523ce424590d7b4eb4	2026-11-15 12:40:51.366	t	2026-11-08 12:40:51.366
cmw7tqd0e001ppww3y6ebwvkl	cmt3yi19w0003ckk97pdcbs9k	1b03401e482961e4129148a2fe7dac7ce942c9698445d2d062bf27a469628bffdde017d04f4ff7c2	2026-11-15 12:44:06.878	t	2026-11-08 12:44:06.878
cmw7tqd9o001tpww31szubqgw	cmt3yi19w0003ckk97pdcbs9k	525dac80c6e5cc54f4efca0ff9d8827c6f1a42ee18e7b220bc4b6d24056e149eff181ceb35cb93d6	2026-11-15 12:44:07.211	t	2026-11-08 12:44:07.212
cmw7trugb003cpww3p3gval8x	cmt3yi19w0003ckk97pdcbs9k	0bd99430a08952d3487bc15c68ab78888bdc89adca17d23387ed1fc795259cea3d4bb923acdbbf2e	2026-11-15 12:45:16.138	t	2026-11-08 12:45:16.139
cmw7truop003gpww3ltmlncne	cmt3yi19w0003ckk97pdcbs9k	5f6980a71787f9f4eb4496a0d91ce0cfc10fde2c75e8144109fb8bb12ea19d43b01093f8b4b680af	2026-11-15 12:45:16.441	t	2026-11-08 12:45:16.441
cmw7trwlo0000kkw3qd0qwsbx	cmt3yi19w0003ckk97pdcbs9k	audit_reuse_test_1794141918893	2026-11-08 12:46:18.893	t	2026-11-08 12:45:18.924
cmw7tue82004opww3hd4aardj	cmt3yi19w0003ckk97pdcbs9k	06d665fd472691ca0e3d8f8ee61f803e503b265e6a2e001ff3050d1322b205d597384d9e339629c3	2026-11-15 12:47:15.073	t	2026-11-08 12:47:15.074
cmw7tuehk004spww35h5ufuid	cmt3yi19w0003ckk97pdcbs9k	a31d8f50831058753e85de1b4be84bb9c7b41d684fc083eabe415e9c20b58a02f6459b98d5bef57d	2026-11-15 12:47:15.415	t	2026-11-08 12:47:15.416
cmw7tugla0000cgw31x3bsmyb	cmt3yi19w0003ckk97pdcbs9k	audit_reuse_test_1794142038118	2026-11-08 12:48:18.118	t	2026-11-08 12:47:18.143
cmw7u16dr0060pww3s799kfhn	cmt3yi19w0003ckk97pdcbs9k	e8db95873299d277f5d2a10c7d79970413459daeaf8911246890daf48643ba1ffb387239b7dac621	2026-11-15 12:52:31.502	t	2026-11-08 12:52:31.503
cmw7u16mh0064pww3zcgordqu	cmt3yi19w0003ckk97pdcbs9k	af7a2e957ea745e2ab78fc9fba1883db7698a3df543a5596c069b33d97ce7be3de98788bcc4cbf07	2026-11-15 12:52:31.816	t	2026-11-08 12:52:31.817
cmw7u19f0000004w31e4l8ozw	cmt3yi19w0003ckk97pdcbs9k	audit_reuse_test_1794142355421	2026-11-08 12:53:35.421	t	2026-11-08 12:52:35.436
\.


--
-- Data for Name: schools; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schools (id, name, code, email, phone, logo, address, city, state, country, status, "createdAt", "updatedAt") FROM stdin;
cmt3yi19q0001ckk9cq8rknzc	Springfield Academy	SPRINGFIELD	info@springfieldacademy.edu	+1-555-0199	\N	742 Evergreen Terrace	Springfield	IL	USA	ACTIVE	2026-08-22 05:47:24.782	2026-08-22 05:47:24.782
cmt3yi1c0000xckk9qvn7nqmx	Oakridge High School	OAKRIDGE	contact@oakridgehigh.edu	+1-555-0299	\N	100 Academic Parkway	Oakridge	CA	USA	ACTIVE	2026-08-22 05:47:24.864	2026-08-22 05:47:24.864
cmw6qe7z60000u0w3r1k7jy5x	Greenwood International	GREENWOOD	info@greenwood.edu	+1 555-9012	\N	\N	Seattle	WA	USA	ACTIVE	2026-11-07 18:22:55.458	2026-11-07 18:23:07.34
\.


--
-- Data for Name: sections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sections (id, "schoolId", "classId", name, capacity, "createdAt", "updatedAt", "classTeacherId") FROM stdin;
cmt3yi1ai000bckk9xd3iusjj	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1a80007ckk93b27hqdy	Section A	35	2026-08-22 05:47:24.81	2026-08-22 05:47:24.81	\N
cmt3yi1an000dckk9qzkahycu	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1af0009ckk9u92twcvy	Section A	35	2026-08-22 05:47:24.815	2026-08-22 05:47:24.815	\N
cmt3yi1cd0015ckk9immttbi3	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1ca0013ckk9s6524cfz	Section A	30	2026-08-22 05:47:24.878	2026-08-22 05:47:24.878	\N
\.


--
-- Data for Name: staff_attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_attendance (id, "schoolId", "teacherId", date, status, "checkInTime", "checkOutTime", remarks, "markedById", "createdAt", "updatedAt") FROM stdin;
cmw6tur5q000jhgw3kieyk5dd	cmt3yi19q0001ckk9cq8rknzc	cmw6tuqxe000fhgw3rshadycs	2026-11-08 00:00:00	PRESENT	2026-11-08 08:15:00	2026-11-08 16:30:00	Full day faculty session	cmt3yi19w0003ckk97pdcbs9k	2026-11-07 19:59:45.662	2026-11-07 19:59:45.662
cmw7tqepm002apww3yf6ulsuf	cmt3yi19q0001ckk9cq8rknzc	cmw7tqefy0022pww3v2hpk5gl	2026-11-08 00:00:00	PRESENT	2026-11-08 08:15:00	2026-11-08 16:30:00	Full day faculty session	cmt3yi19w0003ckk97pdcbs9k	2026-11-08 12:44:09.082	2026-11-08 12:44:09.082
\.


--
-- Data for Name: student_attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.student_attendance (id, "schoolId", "studentId", "classId", "sectionId", date, status, remarks, "markedById", "createdAt", "updatedAt") FROM stdin;
cmw7tqel50026pww34ayl5gu8	cmt3yi19q0001ckk9cq8rknzc	cmw7tqdln001upww3dy60bd4p	cmt3yi1a80007ckk93b27hqdy	cmt3yi1ai000bckk9xd3iusjj	2026-11-08 00:00:00	LATE	Updated arrival to Late	cmt3yi19w0003ckk97pdcbs9k	2026-11-08 12:44:08.921	2026-11-08 12:44:08.967
\.


--
-- Data for Name: student_enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.student_enrollments (id, "schoolId", "studentId", "academicYearId", "classId", "sectionId", "createdAt", "updatedAt", "rollNumber", status) FROM stdin;
cmt3yi1bg000qckk9rbictfoq	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1b9000ockk9eqh21iul	cmt3yi1a30005ckk9hlxv7bmw	cmt3yi1a80007ckk93b27hqdy	cmt3yi1ai000bckk9xd3iusjj	2026-08-22 05:47:24.844	2026-08-22 05:47:24.844	\N	ACTIVE
cmt3yi1cn001bckk9pi60tpmh	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1cj0019ckk9o6hbc03s	cmt3yi1c70011ckk9zzxslzkz	cmt3yi1ca0013ckk9s6524cfz	cmt3yi1cd0015ckk9immttbi3	2026-08-22 05:47:24.887	2026-08-22 05:47:24.887	\N	ACTIVE
cmw6tuqit0009hgw3oy6tbd1c	cmt3yi19q0001ckk9cq8rknzc	cmw6tuq3o0007hgw3xg7xq69u	cmt3yi1a30005ckk9hlxv7bmw	cmt3yi1a80007ckk93b27hqdy	cmt3yi1ai000bckk9xd3iusjj	2026-11-07 19:59:44.837	2026-11-07 19:59:44.837	15	ACTIVE
cmw7tqdvc001wpww3k69hhev8	cmt3yi19q0001ckk9cq8rknzc	cmw7tqdln001upww3dy60bd4p	cmt3yi1a30005ckk9hlxv7bmw	cmt3yi1a80007ckk93b27hqdy	cmt3yi1ai000bckk9xd3iusjj	2026-11-08 12:44:07.992	2026-11-08 12:44:07.992	15	ACTIVE
\.


--
-- Data for Name: student_fee_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.student_fee_invoices (id, "schoolId", "invoiceNumber", "studentId", "feeStructureId", "academicYearId", title, "baseAmount", discount, "discountReason", "lateFee", "totalAmount", "paidAmount", balance, status, "dueDate", "createdAt", "updatedAt") FROM stdin;
cmw6turah000phgw3yldiiz75	cmt3yi19q0001ckk9cq8rknzc	INV-20261107-9672	cmw6tuq3o0007hgw3xg7xq69u	cmw6tur8u000nhgw34palm1hk	cmt3yi1a30005ckk9hlxv7bmw	Fall Term Tuition Fee	1200.00	200.00	Merit Academic Scholarship	50.00	1050.00	450.00	600.00	PARTIALLY_PAID	2026-12-01 00:00:00	2026-11-07 19:59:45.833	2026-11-07 19:59:45.919
cmw7tqet7002gpww3fewezwfu	cmt3yi19q0001ckk9cq8rknzc	INV-20261108-4882	cmw7tqdln001upww3dy60bd4p	cmw7tqerw002epww36555qzau	cmt3yi1a30005ckk9hlxv7bmw	Fall Term Tuition Fee	1200.00	200.00	Merit Academic Scholarship	50.00	1050.00	300.00	750.00	PARTIALLY_PAID	2026-12-01 00:00:00	2026-11-08 12:44:09.211	2026-11-08 12:44:09.366
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.students (id, "schoolId", "userId", "admissionNumber", "firstName", "lastName", "dateOfBirth", gender, phone, email, address, "admissionDate", status, "createdAt", "updatedAt", "bloodGroup", "emergencyContact", photo) FROM stdin;
cmt3yi1b9000ockk9eqh21iul	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1b6000mckk942nfw70e	ADM-2025-001	Bart	Simpson	2011-04-01 00:00:00	MALE	\N	student.bart@springfield.com	\N	2026-08-22 05:47:24.838	ACTIVE	2026-08-22 05:47:24.838	2026-08-22 05:47:24.838	\N	\N	\N
cmt3yi1cj0019ckk9o6hbc03s	cmt3yi1c0000xckk9qvn7nqmx	cmt3yi1cg0017ckk9micbrqih	ADM-2025-001	Alice	Walker	2010-09-12 00:00:00	FEMALE	\N	student.alice@oakridge.com	\N	2026-08-22 05:47:24.884	ACTIVE	2026-08-22 05:47:24.884	2026-08-22 05:47:24.884	\N	\N	\N
cmw6tuq3o0007hgw3xg7xq69u	cmt3yi19q0001ckk9cq8rknzc	\N	ADM-1794081584233	Audit	Student	2012-05-14 00:00:00	MALE	+15550001111	audit.student.1794081584234@springfield.edu	742 Evergreen Terrace	2026-11-07 19:59:44.284	ACTIVE	2026-11-07 19:59:44.293	2026-11-07 19:59:44.293	\N	\N	\N
cmw7tqdln001upww3dy60bd4p	cmt3yi19q0001ckk9cq8rknzc	\N	ADM-1794141847611	Audit	Student	2012-05-14 00:00:00	MALE	+15550001111	audit.student.1794141847611@springfield.edu	742 Evergreen Terrace	2026-11-08 12:44:07.642	ACTIVE	2026-11-08 12:44:07.643	2026-11-08 12:44:07.643	\N	\N	\N
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subjects (id, "schoolId", name, code, description, "createdAt", "updatedAt") FROM stdin;
cmt3yi1aq000eckk9qnnk8pdd	cmt3yi19q0001ckk9cq8rknzc	Mathematics	MATH101	Algebra and Geometry	2026-08-22 05:47:24.818	2026-08-22 05:47:24.818
cmt3yi1aq000fckk9453cm77i	cmt3yi19q0001ckk9cq8rknzc	General Science	SCI101	Physics & Chemistry Basics	2026-08-22 05:47:24.818	2026-08-22 05:47:24.818
cmt3yi1aq000gckk99qdk2j9u	cmt3yi19q0001ckk9cq8rknzc	English Literature	ENG101	Grammar and Literature	2026-08-22 05:47:24.818	2026-08-22 05:47:24.818
cmw6tuqyy000hhgw3z60xliyj	cmt3yi19q0001ckk9cq8rknzc	Advanced Quantum Mechanics	SUB-5400	Senior grade physical sciences curriculum	2026-11-07 19:59:45.418	2026-11-07 19:59:45.418
cmw7tqehj0024pww3xkms4drv	cmt3yi19q0001ckk9cq8rknzc	Advanced Quantum Mechanics	SUB-8774	Senior grade physical sciences curriculum	2026-11-08 12:44:08.792	2026-11-08 12:44:08.792
\.


--
-- Data for Name: teachers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teachers (id, "schoolId", "userId", "employeeId", "firstName", "lastName", phone, email, "joiningDate", status, "createdAt", "updatedAt", department, designation, photo, qualification) FROM stdin;
cmt3yi1b0000kckk9ldo2u494	cmt3yi19q0001ckk9cq8rknzc	cmt3yi1ax000ickk99e95rllz	EMP-SF-001	Edna	Krabappel	+1-555-0122	teacher.edna@springfield.com	2026-08-22 05:47:24.828	ACTIVE	2026-08-22 05:47:24.828	2026-08-22 05:47:24.828	\N	\N	\N	\N
cmw6tuqxe000fhgw3rshadycs	cmt3yi19q0001ckk9cq8rknzc	cmw6tuqx6000ehgw3cbvbv4b6	EMP-TEST-4980	Eleanor	Vance	+15557776666	eleanor.1794081584980@springfield.edu	2026-11-07 19:59:45.357	ACTIVE	2026-11-07 19:59:45.362	2026-11-07 19:59:45.362	Science	Senior Faculty	\N	Ph.D. in Physics
cmw7tqefy0022pww3v2hpk5gl	cmt3yi19q0001ckk9cq8rknzc	cmw7tqefr0021pww3xbg5f8wr	EMP-TEST-8120	Eleanor	Vance	+15557776666	eleanor.1794141848120@springfield.edu	2026-11-08 12:44:08.733	ACTIVE	2026-11-08 12:44:08.734	2026-11-08 12:44:08.734	Science	Senior Faculty	\N	Ph.D. in Physics
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, "schoolId", name, email, "passwordHash", role, status, "createdAt", "updatedAt") FROM stdin;
cmt3yi1ax000ickk99e95rllz	cmt3yi19q0001ckk9cq8rknzc	Edna Krabappel	teacher.edna@springfield.com	$2a$10$mbylR8Vwqv9XhsfwZR56u.K6Mus21RlqNRQBypNGKhFWHgwje1AJa	TEACHER	ACTIVE	2026-08-22 05:47:24.825	2026-08-22 05:47:24.825
cmt3yi1b6000mckk942nfw70e	cmt3yi19q0001ckk9cq8rknzc	Bart Simpson	student.bart@springfield.com	$2a$10$mbylR8Vwqv9XhsfwZR56u.K6Mus21RlqNRQBypNGKhFWHgwje1AJa	STUDENT	ACTIVE	2026-08-22 05:47:24.834	2026-08-22 05:47:24.834
cmt3yi1bm000sckk9hecs9cnd	cmt3yi19q0001ckk9cq8rknzc	Homer Simpson	parent.homer@springfield.com	$2a$10$mbylR8Vwqv9XhsfwZR56u.K6Mus21RlqNRQBypNGKhFWHgwje1AJa	PARENT	ACTIVE	2026-08-22 05:47:24.85	2026-08-22 05:47:24.85
cmt3yi1cg0017ckk9micbrqih	cmt3yi1c0000xckk9qvn7nqmx	Alice Walker	student.alice@oakridge.com	$2a$10$mbylR8Vwqv9XhsfwZR56u.K6Mus21RlqNRQBypNGKhFWHgwje1AJa	STUDENT	ACTIVE	2026-08-22 05:47:24.88	2026-08-22 05:47:24.88
cmt3yi19g0000ckk93r0adndy	\N	System Super Admin	superadmin@schoolerp.com	$2b$10$4N/wR.H4jr2uSxPkWvdNvu4AMcputN3UmfCNXyo9tdB9v9cMms7Ye	SUPER_ADMIN	ACTIVE	2026-08-22 05:47:24.772	2026-11-07 18:11:33.349
cmt3yi19w0003ckk97pdcbs9k	cmt3yi19q0001ckk9cq8rknzc	Principal Seymour Skinner	admin@springfield.com	$2b$10$KBNwzqBR3QEk6llZRQcV8.BgRkfn7Gz.koUWs3qmU17SWYQn6p0Oa	SCHOOL_ADMIN	ACTIVE	2026-08-22 05:47:24.788	2026-11-07 18:11:33.538
cmt3yi1c3000zckk9r0pkyt4q	cmt3yi1c0000xckk9qvn7nqmx	Principal Arthur Vance	admin@oakridge.com	$2b$10$KBNwzqBR3QEk6llZRQcV8.BgRkfn7Gz.koUWs3qmU17SWYQn6p0Oa	SCHOOL_ADMIN	ACTIVE	2026-08-22 05:47:24.867	2026-11-07 18:11:33.547
cmw6qe7ze0001u0w38ywcmz1k	cmw6qe7z60000u0w3r1k7jy5x	Dr. Robert Wilson	admin@greenwood.edu	$2b$10$TZNfX9yhdnPS01yLltVtW./l0jhckBpMUy5HDUlab8BKamwD.xhBa	SCHOOL_ADMIN	ACTIVE	2026-11-07 18:22:55.466	2026-11-07 18:22:55.466
cmw6tuqx6000ehgw3cbvbv4b6	cmt3yi19q0001ckk9cq8rknzc	Eleanor Vance	eleanor.1794081584980@springfield.edu	$2b$10$9VxK/5V34akdQ02bhgg53ursM.B8Mjcna3HxC9Ogh58qY.KiS22Ii	TEACHER	ACTIVE	2026-11-07 19:59:45.354	2026-11-07 19:59:45.354
cmw7tqefr0021pww3xbg5f8wr	cmt3yi19q0001ckk9cq8rknzc	Eleanor Vance	eleanor.1794141848120@springfield.edu	$2b$10$D5sg1rqEIazkPGYgigPRR.F8IV.HzxnCo0EyoVFttE5T9qEs5H5qe	TEACHER	ACTIVE	2026-11-08 12:44:08.727	2026-11-08 12:44:08.727
\.


--
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: class_subjects class_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT class_subjects_pkey PRIMARY KEY (id);


--
-- Name: class_timetables class_timetables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_timetables
    ADD CONSTRAINT class_timetables_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: exam_marks exam_marks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_marks
    ADD CONSTRAINT exam_marks_pkey PRIMARY KEY (id);


--
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (id);


--
-- Name: exam_schedules exam_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_schedules
    ADD CONSTRAINT exam_schedules_pkey PRIMARY KEY (id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: fee_categories fee_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_categories
    ADD CONSTRAINT fee_categories_pkey PRIMARY KEY (id);


--
-- Name: fee_payments fee_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);


--
-- Name: fee_structures fee_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_pkey PRIMARY KEY (id);


--
-- Name: grading_rules grading_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grading_rules
    ADD CONSTRAINT grading_rules_pkey PRIMARY KEY (id);


--
-- Name: grading_scales grading_scales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grading_scales
    ADD CONSTRAINT grading_scales_pkey PRIMARY KEY (id);


--
-- Name: homework homework_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_pkey PRIMARY KEY (id);


--
-- Name: homework_submissions homework_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT homework_submissions_pkey PRIMARY KEY (id);


--
-- Name: parent_students parent_students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_pkey PRIMARY KEY (id);


--
-- Name: parents parents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


--
-- Name: staff_attendance staff_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_attendance
    ADD CONSTRAINT staff_attendance_pkey PRIMARY KEY (id);


--
-- Name: student_attendance student_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT student_attendance_pkey PRIMARY KEY (id);


--
-- Name: student_enrollments student_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_enrollments
    ADD CONSTRAINT student_enrollments_pkey PRIMARY KEY (id);


--
-- Name: student_fee_invoices student_fee_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_fee_invoices
    ADD CONSTRAINT student_fee_invoices_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: academic_years_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "academic_years_schoolId_idx" ON public.academic_years USING btree ("schoolId");


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_schoolId_idx" ON public.audit_logs USING btree ("schoolId");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: class_subjects_classId_subjectId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "class_subjects_classId_subjectId_key" ON public.class_subjects USING btree ("classId", "subjectId");


--
-- Name: class_subjects_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "class_subjects_schoolId_idx" ON public.class_subjects USING btree ("schoolId");


--
-- Name: class_timetables_schoolId_academicYearId_classId_sectionId__key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "class_timetables_schoolId_academicYearId_classId_sectionId__key" ON public.class_timetables USING btree ("schoolId", "academicYearId", "classId", "sectionId", "dayOfWeek", "periodNumber");


--
-- Name: class_timetables_schoolId_classId_sectionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "class_timetables_schoolId_classId_sectionId_idx" ON public.class_timetables USING btree ("schoolId", "classId", "sectionId");


--
-- Name: class_timetables_schoolId_teacherId_dayOfWeek_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "class_timetables_schoolId_teacherId_dayOfWeek_idx" ON public.class_timetables USING btree ("schoolId", "teacherId", "dayOfWeek");


--
-- Name: classes_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "classes_schoolId_idx" ON public.classes USING btree ("schoolId");


--
-- Name: classes_schoolId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "classes_schoolId_name_key" ON public.classes USING btree ("schoolId", name);


--
-- Name: documents_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "documents_schoolId_idx" ON public.documents USING btree ("schoolId");


--
-- Name: documents_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "documents_studentId_idx" ON public.documents USING btree ("studentId");


--
-- Name: documents_teacherId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "documents_teacherId_idx" ON public.documents USING btree ("teacherId");


--
-- Name: exam_marks_examScheduleId_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "exam_marks_examScheduleId_studentId_key" ON public.exam_marks USING btree ("examScheduleId", "studentId");


--
-- Name: exam_marks_schoolId_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "exam_marks_schoolId_studentId_idx" ON public.exam_marks USING btree ("schoolId", "studentId");


--
-- Name: exam_results_examId_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "exam_results_examId_studentId_key" ON public.exam_results USING btree ("examId", "studentId");


--
-- Name: exam_results_schoolId_examId_classId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "exam_results_schoolId_examId_classId_idx" ON public.exam_results USING btree ("schoolId", "examId", "classId");


--
-- Name: exam_schedules_examId_classId_subjectId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "exam_schedules_examId_classId_subjectId_key" ON public.exam_schedules USING btree ("examId", "classId", "subjectId");


--
-- Name: exam_schedules_schoolId_examDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "exam_schedules_schoolId_examDate_idx" ON public.exam_schedules USING btree ("schoolId", "examDate");


--
-- Name: exam_schedules_schoolId_examId_classId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "exam_schedules_schoolId_examId_classId_idx" ON public.exam_schedules USING btree ("schoolId", "examId", "classId");


--
-- Name: exams_schoolId_academicYearId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "exams_schoolId_academicYearId_idx" ON public.exams USING btree ("schoolId", "academicYearId");


--
-- Name: fee_categories_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fee_categories_schoolId_idx" ON public.fee_categories USING btree ("schoolId");


--
-- Name: fee_categories_schoolId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "fee_categories_schoolId_name_key" ON public.fee_categories USING btree ("schoolId", name);


--
-- Name: fee_payments_schoolId_invoiceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fee_payments_schoolId_invoiceId_idx" ON public.fee_payments USING btree ("schoolId", "invoiceId");


--
-- Name: fee_payments_schoolId_paymentDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fee_payments_schoolId_paymentDate_idx" ON public.fee_payments USING btree ("schoolId", "paymentDate");


--
-- Name: fee_payments_schoolId_receiptNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "fee_payments_schoolId_receiptNumber_key" ON public.fee_payments USING btree ("schoolId", "receiptNumber");


--
-- Name: fee_structures_classId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fee_structures_classId_idx" ON public.fee_structures USING btree ("classId");


--
-- Name: fee_structures_schoolId_academicYearId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fee_structures_schoolId_academicYearId_idx" ON public.fee_structures USING btree ("schoolId", "academicYearId");


--
-- Name: grading_rules_gradingScaleId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "grading_rules_gradingScaleId_idx" ON public.grading_rules USING btree ("gradingScaleId");


--
-- Name: grading_scales_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "grading_scales_schoolId_idx" ON public.grading_scales USING btree ("schoolId");


--
-- Name: grading_scales_schoolId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "grading_scales_schoolId_name_key" ON public.grading_scales USING btree ("schoolId", name);


--
-- Name: homework_schoolId_classId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "homework_schoolId_classId_idx" ON public.homework USING btree ("schoolId", "classId");


--
-- Name: homework_schoolId_dueDate_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "homework_schoolId_dueDate_idx" ON public.homework USING btree ("schoolId", "dueDate");


--
-- Name: homework_schoolId_teacherId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "homework_schoolId_teacherId_idx" ON public.homework USING btree ("schoolId", "teacherId");


--
-- Name: homework_submissions_homeworkId_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "homework_submissions_homeworkId_studentId_key" ON public.homework_submissions USING btree ("homeworkId", "studentId");


--
-- Name: homework_submissions_schoolId_homeworkId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "homework_submissions_schoolId_homeworkId_idx" ON public.homework_submissions USING btree ("schoolId", "homeworkId");


--
-- Name: homework_submissions_schoolId_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "homework_submissions_schoolId_studentId_idx" ON public.homework_submissions USING btree ("schoolId", "studentId");


--
-- Name: parent_students_parentId_studentId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "parent_students_parentId_studentId_key" ON public.parent_students USING btree ("parentId", "studentId");


--
-- Name: parent_students_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "parent_students_studentId_idx" ON public.parent_students USING btree ("studentId");


--
-- Name: parents_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "parents_schoolId_idx" ON public.parents USING btree ("schoolId");


--
-- Name: parents_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "parents_userId_key" ON public.parents USING btree ("userId");


--
-- Name: refresh_tokens_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX refresh_tokens_token_key ON public.refresh_tokens USING btree (token);


--
-- Name: refresh_tokens_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "refresh_tokens_userId_idx" ON public.refresh_tokens USING btree ("userId");


--
-- Name: schools_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX schools_code_key ON public.schools USING btree (code);


--
-- Name: sections_classId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sections_classId_name_key" ON public.sections USING btree ("classId", name);


--
-- Name: sections_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "sections_schoolId_idx" ON public.sections USING btree ("schoolId");


--
-- Name: staff_attendance_schoolId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "staff_attendance_schoolId_date_idx" ON public.staff_attendance USING btree ("schoolId", date);


--
-- Name: staff_attendance_teacherId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "staff_attendance_teacherId_date_key" ON public.staff_attendance USING btree ("teacherId", date);


--
-- Name: student_attendance_classId_sectionId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_attendance_classId_sectionId_date_idx" ON public.student_attendance USING btree ("classId", "sectionId", date);


--
-- Name: student_attendance_schoolId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_attendance_schoolId_date_idx" ON public.student_attendance USING btree ("schoolId", date);


--
-- Name: student_attendance_studentId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "student_attendance_studentId_date_key" ON public.student_attendance USING btree ("studentId", date);


--
-- Name: student_enrollments_academicYearId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_enrollments_academicYearId_idx" ON public.student_enrollments USING btree ("academicYearId");


--
-- Name: student_enrollments_classId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_enrollments_classId_idx" ON public.student_enrollments USING btree ("classId");


--
-- Name: student_enrollments_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_enrollments_schoolId_idx" ON public.student_enrollments USING btree ("schoolId");


--
-- Name: student_enrollments_studentId_academicYearId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "student_enrollments_studentId_academicYearId_key" ON public.student_enrollments USING btree ("studentId", "academicYearId");


--
-- Name: student_fee_invoices_academicYearId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_fee_invoices_academicYearId_idx" ON public.student_fee_invoices USING btree ("academicYearId");


--
-- Name: student_fee_invoices_schoolId_invoiceNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "student_fee_invoices_schoolId_invoiceNumber_key" ON public.student_fee_invoices USING btree ("schoolId", "invoiceNumber");


--
-- Name: student_fee_invoices_schoolId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_fee_invoices_schoolId_status_idx" ON public.student_fee_invoices USING btree ("schoolId", status);


--
-- Name: student_fee_invoices_schoolId_studentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "student_fee_invoices_schoolId_studentId_idx" ON public.student_fee_invoices USING btree ("schoolId", "studentId");


--
-- Name: students_schoolId_admissionNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "students_schoolId_admissionNumber_key" ON public.students USING btree ("schoolId", "admissionNumber");


--
-- Name: students_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "students_schoolId_idx" ON public.students USING btree ("schoolId");


--
-- Name: students_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "students_userId_key" ON public.students USING btree ("userId");


--
-- Name: subjects_schoolId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "subjects_schoolId_code_key" ON public.subjects USING btree ("schoolId", code);


--
-- Name: subjects_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subjects_schoolId_idx" ON public.subjects USING btree ("schoolId");


--
-- Name: teachers_schoolId_employeeId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "teachers_schoolId_employeeId_key" ON public.teachers USING btree ("schoolId", "employeeId");


--
-- Name: teachers_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "teachers_schoolId_idx" ON public.teachers USING btree ("schoolId");


--
-- Name: teachers_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "teachers_userId_key" ON public.teachers USING btree ("userId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: users_schoolId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "users_schoolId_idx" ON public.users USING btree ("schoolId");


--
-- Name: academic_years academic_years_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT "academic_years_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: class_subjects class_subjects_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT "class_subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_subjects class_subjects_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT "class_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_subjects class_subjects_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_subjects
    ADD CONSTRAINT "class_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: class_timetables class_timetables_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_timetables
    ADD CONSTRAINT "class_timetables_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_timetables class_timetables_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_timetables
    ADD CONSTRAINT "class_timetables_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_timetables class_timetables_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_timetables
    ADD CONSTRAINT "class_timetables_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_timetables class_timetables_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_timetables
    ADD CONSTRAINT "class_timetables_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: class_timetables class_timetables_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_timetables
    ADD CONSTRAINT "class_timetables_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: class_timetables class_timetables_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_timetables
    ADD CONSTRAINT "class_timetables_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: classes classes_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT "classes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documents documents_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documents documents_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documents documents_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_marks exam_marks_examScheduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_marks
    ADD CONSTRAINT "exam_marks_examScheduleId_fkey" FOREIGN KEY ("examScheduleId") REFERENCES public.exam_schedules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_marks exam_marks_gradedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_marks
    ADD CONSTRAINT "exam_marks_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exam_marks exam_marks_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_marks
    ADD CONSTRAINT "exam_marks_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_marks exam_marks_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_marks
    ADD CONSTRAINT "exam_marks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_results exam_results_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT "exam_results_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exam_results exam_results_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT "exam_results_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_results exam_results_examId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT "exam_results_examId_fkey" FOREIGN KEY ("examId") REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_results exam_results_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT "exam_results_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_results exam_results_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT "exam_results_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exam_results exam_results_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT "exam_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_schedules exam_schedules_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_schedules
    ADD CONSTRAINT "exam_schedules_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_schedules exam_schedules_examId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_schedules
    ADD CONSTRAINT "exam_schedules_examId_fkey" FOREIGN KEY ("examId") REFERENCES public.exams(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_schedules exam_schedules_invigilatorTeacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_schedules
    ADD CONSTRAINT "exam_schedules_invigilatorTeacherId_fkey" FOREIGN KEY ("invigilatorTeacherId") REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exam_schedules exam_schedules_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_schedules
    ADD CONSTRAINT "exam_schedules_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exam_schedules exam_schedules_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_schedules
    ADD CONSTRAINT "exam_schedules_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exam_schedules exam_schedules_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_schedules
    ADD CONSTRAINT "exam_schedules_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exams exams_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT "exams_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: exams exams_gradingScaleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT "exams_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES public.grading_scales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: exams exams_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT "exams_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fee_categories fee_categories_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_categories
    ADD CONSTRAINT "fee_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fee_payments fee_payments_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT "fee_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.student_fee_invoices(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fee_payments fee_payments_recordedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT "fee_payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: fee_payments fee_payments_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT "fee_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fee_structures fee_structures_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT "fee_structures_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fee_structures fee_structures_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT "fee_structures_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.fee_categories(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fee_structures fee_structures_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT "fee_structures_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fee_structures fee_structures_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT "fee_structures_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: grading_rules grading_rules_gradingScaleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grading_rules
    ADD CONSTRAINT "grading_rules_gradingScaleId_fkey" FOREIGN KEY ("gradingScaleId") REFERENCES public.grading_scales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: grading_scales grading_scales_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grading_scales
    ADD CONSTRAINT "grading_scales_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework homework_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT "homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework homework_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT "homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework homework_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT "homework_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: homework homework_subjectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT "homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES public.subjects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework_submissions homework_submissions_evaluatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT "homework_submissions_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: homework_submissions homework_submissions_homeworkId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT "homework_submissions_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES public.homework(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework_submissions homework_submissions_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT "homework_submissions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework_submissions homework_submissions_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework_submissions
    ADD CONSTRAINT "homework_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: homework homework_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT "homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: parent_students parent_students_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT "parent_students_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.parents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: parent_students parent_students_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT "parent_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: parents parents_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT "parents_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: parents parents_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT "parents_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sections sections_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT "sections_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sections sections_classTeacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT "sections_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sections sections_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT "sections_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: staff_attendance staff_attendance_markedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_attendance
    ADD CONSTRAINT "staff_attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: staff_attendance staff_attendance_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_attendance
    ADD CONSTRAINT "staff_attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: staff_attendance staff_attendance_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_attendance
    ADD CONSTRAINT "staff_attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public.teachers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_attendance student_attendance_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT "student_attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_attendance student_attendance_markedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT "student_attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: student_attendance student_attendance_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT "student_attendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_attendance student_attendance_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT "student_attendance_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_attendance student_attendance_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_attendance
    ADD CONSTRAINT "student_attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_enrollments student_enrollments_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_enrollments
    ADD CONSTRAINT "student_enrollments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_enrollments student_enrollments_classId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_enrollments
    ADD CONSTRAINT "student_enrollments_classId_fkey" FOREIGN KEY ("classId") REFERENCES public.classes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_enrollments student_enrollments_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_enrollments
    ADD CONSTRAINT "student_enrollments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_enrollments student_enrollments_sectionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_enrollments
    ADD CONSTRAINT "student_enrollments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES public.sections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_enrollments student_enrollments_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_enrollments
    ADD CONSTRAINT "student_enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_fee_invoices student_fee_invoices_academicYearId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_fee_invoices
    ADD CONSTRAINT "student_fee_invoices_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES public.academic_years(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_fee_invoices student_fee_invoices_feeStructureId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_fee_invoices
    ADD CONSTRAINT "student_fee_invoices_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES public.fee_structures(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: student_fee_invoices student_fee_invoices_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_fee_invoices
    ADD CONSTRAINT "student_fee_invoices_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: student_fee_invoices student_fee_invoices_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.student_fee_invoices
    ADD CONSTRAINT "student_fee_invoices_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: students students_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: students students_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: subjects subjects_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT "subjects_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: teachers teachers_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT "teachers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: teachers teachers_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_schoolId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES public.schools(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 1g8PLUR2JJDqX73OFf2lkTzcrbLW2bRjscqffojCdsGa4e5YJKUFOQjv4MrwQV4

