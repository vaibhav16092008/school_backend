import { Request, Response, NextFunction } from 'express';
import { prisma, SubscriptionStatus, Role } from '../lib/prisma';
import { ApiError } from '../utils/api-error';

export interface SchoolEntitlements {
  schoolId: string;
  hasSubscription: boolean;
  status: SubscriptionStatus;
  planName: string;
  planCode: string;
  isTrial: boolean;
  trialDaysRemaining: number;
  allowedModules: string[];
  limits: {
    maxStudents: number;
    maxStaff: number;
    maxStorageMb: number;
    maxBranches: number;
    maxParentAccounts: number;
  };
  usage: {
    students: number;
    staff: number;
    parents: number;
  };
  canAddStudent: boolean;
  canAddStaff: boolean;
  canAddParent: boolean;
  isSuspendedOrExpired: boolean;
}

export class EntitlementService {
  /**
   * Get current entitlements, limits and usage for a school
   */
  public static async getSchoolEntitlements(schoolId: string): Promise<SchoolEntitlements> {
    const sub = await prisma.school_subscriptions.findUnique({
      where: { schoolId },
      include: {
        subscription_plans: {
          include: {
            plan_features: true,
          },
        },
      },
    });

    // Gather live usage counts
    const [studentsCount, teachersCount, staffUsersCount, parentsCount] = await Promise.all([
      prisma.students.count({ where: { schoolId } }),
      prisma.teachers.count({ where: { schoolId } }),
      prisma.users.count({ where: { schoolId, role: Role.SCHOOL_ADMIN } }),
      prisma.parents.count({ where: { schoolId } }),
    ]);

    const totalStaffCount = teachersCount + staffUsersCount;

    // Default fallback entitlements if no subscription record exists yet
    if (!sub) {
      return {
        schoolId,
        hasSubscription: false,
        status: SubscriptionStatus.TRIALING,
        planName: 'Starter Trial',
        planCode: 'FREE',
        isTrial: true,
        trialDaysRemaining: 14,
        allowedModules: [
          'STUDENTS',
          'STAFF',
          'ATTENDANCE',
          'FEES',
          'EXAMS',
          'TIMETABLE',
          'HOMEWORK',
          'PORTAL',
        ],
        limits: {
          maxStudents: 100,
          maxStaff: 20,
          maxStorageMb: 1024,
          maxBranches: 1,
          maxParentAccounts: 200,
        },
        usage: {
          students: studentsCount,
          staff: totalStaffCount,
          parents: parentsCount,
        },
        canAddStudent: studentsCount < 100,
        canAddStaff: totalStaffCount < 20,
        canAddParent: parentsCount < 200,
        isSuspendedOrExpired: false,
      };
    }

    const plan = sub.subscription_plans;
    const features = plan.plan_features;

    const maxStudents = features?.maxStudents ?? 100;
    const maxStaff = features?.maxStaff ?? 20;
    const maxStorageMb = features?.maxStorageMb ?? 1024;
    const maxBranches = features?.maxBranches ?? 1;
    const maxParentAccounts = features?.maxParentAccounts ?? 200;
    const allowedModules = features?.allowedModules ?? [];

    const isSuspendedOrExpired =
      sub.status === SubscriptionStatus.SUSPENDED || sub.status === SubscriptionStatus.EXPIRED;

    const now = new Date();
    let trialDaysRemaining = 0;
    if (sub.status === SubscriptionStatus.TRIALING && sub.trialEndDate) {
      const diff = new Date(sub.trialEndDate).getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const canAddStudent = !isSuspendedOrExpired && (maxStudents === -1 || studentsCount < maxStudents);
    const canAddStaff = !isSuspendedOrExpired && (maxStaff === -1 || totalStaffCount < maxStaff);
    const canAddParent = !isSuspendedOrExpired && (maxParentAccounts === -1 || parentsCount < maxParentAccounts);

    return {
      schoolId,
      hasSubscription: true,
      status: sub.status,
      planName: plan.name,
      planCode: plan.code,
      isTrial: sub.status === SubscriptionStatus.TRIALING,
      trialDaysRemaining,
      allowedModules,
      limits: {
        maxStudents,
        maxStaff,
        maxStorageMb,
        maxBranches,
        maxParentAccounts,
      },
      usage: {
        students: studentsCount,
        staff: totalStaffCount,
        parents: parentsCount,
      },
      canAddStudent,
      canAddStaff,
      canAddParent,
      isSuspendedOrExpired,
    };
  }

  /**
   * Middleware to enforce module entitlement
   */
  public static requireModule(moduleName: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId) {
          return next();
        }

        const entitlements = await EntitlementService.getSchoolEntitlements(schoolId);

        if (entitlements.isSuspendedOrExpired) {
          throw new ApiError(
            403,
            `Access to ${moduleName} is restricted because the school subscription is ${entitlements.status}. Please renew your subscription.`
          );
        }

        if (
          entitlements.allowedModules.length > 0 &&
          !entitlements.allowedModules.includes(moduleName)
        ) {
          throw new ApiError(
            403,
            `Your current subscription plan (${entitlements.planName}) does not include the ${moduleName} module. Upgrade your plan to access this feature.`
          );
        }

        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Middleware to check student quota before adding new student
   */
  public static checkStudentQuota() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId) return next();

        const entitlements = await EntitlementService.getSchoolEntitlements(schoolId);
        if (!entitlements.canAddStudent) {
          throw new ApiError(
            403,
            `Student limit of ${entitlements.limits.maxStudents} reached for the ${entitlements.planName} plan. Please upgrade to enroll more students.`
          );
        }
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Middleware to check staff quota before adding new staff/teacher
   */
  public static checkStaffQuota() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId) return next();

        const entitlements = await EntitlementService.getSchoolEntitlements(schoolId);
        if (!entitlements.canAddStaff) {
          throw new ApiError(
            403,
            `Staff limit of ${entitlements.limits.maxStaff} reached for the ${entitlements.planName} plan. Please upgrade to add more staff members.`
          );
        }
        next();
      } catch (err) {
        next(err);
      }
    };
  }
}
