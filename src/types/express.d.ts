import { Role } from '../generated/prisma/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
      parent?: any;
      student?: any;
      verifiedStudentId?: string;
    }
  }
}

