import { z } from 'zod';

export const invitePortalUserSchema = z.object({
  email: z.string().email('Valid email address is required'),
  role: z.enum(['PARENT', 'STUDENT'], {
    error: 'Role must be either PARENT or STUDENT',
  }),
  parentId: z.string().optional(),
  studentId: z.string().optional(),
}).refine((data) => {
  if (data.role === 'PARENT' && !data.parentId) {
    return false;
  }
  if (data.role === 'STUDENT' && !data.studentId) {
    return false;
  }
  return true;
}, {
  message: 'parentId is required when inviting a PARENT; studentId is required when inviting a STUDENT',
  path: ['role'],
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(10, 'Valid invitation token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updatePortalSettingsSchema = z.object({
  isParentPortalEnabled: z.boolean().optional(),
  isStudentPortalEnabled: z.boolean().optional(),
  allowParentFeePayment: z.boolean().optional(),
  allowStudentHomeworkUpload: z.boolean().optional(),
  showExamRank: z.boolean().optional(),
  showFeeToStudent: z.boolean().optional(),
  allowAttendanceDownload: z.boolean().optional(),
});

export const linkGuardianStudentSchema = z.object({
  parentId: z.string().min(1, 'Parent ID is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  relation: z.string().max(50).optional().default('GUARDIAN'),
  isPrimary: z.boolean().optional().default(false),
});

export const updateRelationshipStatusSchema = z.object({
  isActive: z.boolean({
    error: 'isActive status must be a boolean',
  }),
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  content: z.string().min(2, 'Content is required'),
  category: z
    .enum(['GENERAL', 'ACADEMIC', 'EXAMINATION', 'HOLIDAY', 'SPORTS', 'EVENT'])
    .optional()
    .default('GENERAL'),
  targetAudience: z
    .enum(['ALL', 'PARENTS', 'STUDENTS', 'TEACHERS', 'STAFF'])
    .optional()
    .default('ALL'),
  isPublished: z.boolean().optional().default(true),
  expiresAt: z.string().optional().nullable(),
  attachmentUrl: z.string().url().optional().nullable().or(z.literal('')),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export type InvitePortalUserInput = z.infer<typeof invitePortalUserSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdatePortalSettingsInput = z.infer<typeof updatePortalSettingsSchema>;
export type LinkGuardianStudentInput = z.infer<typeof linkGuardianStudentSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
