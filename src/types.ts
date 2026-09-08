export type Department = '노경' | '환경안전' | 'IT보안팀' | '구매' | '기술팀';

export type UserRole = 'operator' | 'dept_user';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: Department; // If dept_user, which department they belong to
}

export interface Round {
  id: string; // e.g., '9-1', '9-2'
  name: string; // e.g., '9월 1차'
  month: number; // 9
  seq: number; // 1 or 2
  status: 'open' | 'closed'; // 진행중 | 마감됨
  startDate: string;
  endDate: string;
}

export interface MasterItem {
  id: string;
  keyNo?: number; // 고유KEY (숫자)
  glCode: string; // GL계정
  glName: string; // GL계정명
  subItem: string; // 세목
  attribution: '공통' | 'MTBE4' | 'P3'; // 귀속
  dept: Department; // 주관부서
  manager: string; // 담당자
}

export interface EntryData {
  id: string; // unique key e.g. `${roundId}_${masterId}`
  roundId: string;
  masterId: string;
  dept: Department;
  m1: number | '';
  m2: number | '';
  m3: number | '';
  m4: number | '';
  m5: number | '';
  reason?: string; // 차이사유
  updatedAt?: string;
  updatedBy?: string;
}

export interface GLMasterItem {
  id: string;
  glCode: string; // GL계정
  glName: string; // GL계정명
}

export type ActiveTab = 'dashboard' | 'entry' | 'master' | 'gl_master' | 'rounds' | 'users';
