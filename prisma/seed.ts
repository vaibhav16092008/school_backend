import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, SchoolStatus, UserStatus } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/school_erp?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Seeding Database ---');

  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 10);
  const schoolAdminPassword = await bcrypt.hash('Admin@123', 10);

  // 1. Super Admin
  const superAdmin = await prisma.users.upsert({
    where: { email: 'superadmin@schoolerp.com' },
    update: {
      passwordHash: superAdminPassword,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      name: 'System Super Admin',
    },
    create: {
      email: 'superadmin@schoolerp.com',
      passwordHash: superAdminPassword,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      name: 'System Super Admin',
    },
  });
  console.log('✓ Super Admin ready: superadmin@schoolerp.com / SuperAdmin@123');

  // 2. Demo School 1: Springfield Academy
  let school1 = await prisma.schools.findUnique({
    where: { code: 'SPRINGFIELD' },
  });

  if (!school1) {
    school1 = await prisma.schools.create({
      data: {
        name: 'Springfield Academy',
        code: 'SPRINGFIELD',
        email: 'info@springfield.com',
        phone: '+1 555-0192',
        address: '742 Evergreen Terrace',
        city: 'Springfield',
        state: 'Oregon',
        country: 'USA',
        status: SchoolStatus.ACTIVE,
      },
    });
  }

  // School Admin for Springfield
  await prisma.users.upsert({
    where: { email: 'admin@springfield.com' },
    update: {
      passwordHash: schoolAdminPassword,
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      schoolId: school1.id,
      name: 'Principal Seymour Skinner',
    },
    create: {
      email: 'admin@springfield.com',
      passwordHash: schoolAdminPassword,
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      schoolId: school1.id,
      name: 'Principal Seymour Skinner',
    },
  });
  console.log('✓ School Admin ready: admin@springfield.com / Admin@123');

  // 3. Demo School 2: Oakridge High School
  let school2 = await prisma.schools.findUnique({
    where: { code: 'OAKRIDGE' },
  });

  if (!school2) {
    school2 = await prisma.schools.create({
      data: {
        name: 'Oakridge High School',
        code: 'OAKRIDGE',
        email: 'contact@oakridge.edu',
        phone: '+1 555-0144',
        address: '100 Oakridge Parkway',
        city: 'Oakridge',
        state: 'California',
        country: 'USA',
        status: SchoolStatus.ACTIVE,
      },
    });
  }

  // School Admin for Oakridge
  await prisma.users.upsert({
    where: { email: 'admin@oakridge.com' },
    update: {
      passwordHash: schoolAdminPassword,
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      schoolId: school2.id,
      name: 'Principal Arthur Vance',
    },
    create: {
      email: 'admin@oakridge.com',
      passwordHash: schoolAdminPassword,
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      schoolId: school2.id,
      name: 'Principal Arthur Vance',
    },
  });
  console.log('✓ School Admin ready: admin@oakridge.com / Admin@123');

  // 4. Ensure Springfield has classes & academic year
  let academicYear = await prisma.academic_years.findFirst({
    where: { schoolId: school1.id },
  });

  if (!academicYear) {
    academicYear = await prisma.academic_years.create({
      data: {
        schoolId: school1.id,
        name: '2026-2027',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-06-30'),
        isCurrent: true,
      },
    });
  }

  const existingClasses = await prisma.classes.count({ where: { schoolId: school1.id } });
  if (existingClasses === 0) {
    const classNames = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    for (let i = 0; i < classNames.length; i++) {
      const cls = await prisma.classes.create({
        data: {
          schoolId: school1.id,
          name: classNames[i],
          order: i + 1,
        },
      });
      await prisma.sections.createMany({
        data: [
          { schoolId: school1.id, classId: cls.id, name: 'A', capacity: 35 },
          { schoolId: school1.id, classId: cls.id, name: 'B', capacity: 35 },
        ],
      });
    }
    console.log('✓ Classes & Sections created for Springfield Academy');
  }

  console.log('--- Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

