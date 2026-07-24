export type AdminRole = 'PACIENTE' | 'CUIDADOR' | 'ADMIN';

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AdminRole | string;
  caregiver_name?: string | null;
}

export type AdminRoleFilter = 'ALL' | AdminRole;
