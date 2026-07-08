export const ROLES = {
  STUDENT: "student",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];