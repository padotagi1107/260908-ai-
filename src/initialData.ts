import { Department, EntryData, MasterItem, GLMasterItem, Round, UserProfile } from './types';

export const DEPARTMENTS: Department[] = ['노경', '환경안전', 'IT보안팀', '구매', '기술팀'];

export const INITIAL_USERS: UserProfile[] = [
  { id: 'usr-op', name: '총괄 운영자', email: 'operator@company.com', role: 'operator' },
  { id: 'usr-1', name: '노경 담당자', email: 'labor@company.com', role: 'dept_user', department: '노경' },
  { id: 'usr-2', name: '환경안전 담당자', email: 'safety@company.com', role: 'dept_user', department: '환경안전' },
  { id: 'usr-3', name: 'IT보안 담당자', email: 'itsec@company.com', role: 'dept_user', department: 'IT보안팀' },
  { id: 'usr-4', name: '구매 담당자', email: 'purchase@company.com', role: 'dept_user', department: '구매' },
  { id: 'usr-5', name: '기술 담당자', email: 'tech@company.com', role: 'dept_user', department: '기술팀' },
];

export const INITIAL_ROUNDS: Round[] = [
  { id: '8-2', name: '26년8-2차', month: 8, seq: 2, status: 'closed', startDate: '2026-08-16', endDate: '2026-08-31' },
  { id: '9-1', name: '26년9-1차', month: 9, seq: 1, status: 'open', startDate: '2026-09-01', endDate: '2026-09-15' },
  { id: '9-2', name: '26년9-2차', month: 9, seq: 2, status: 'open', startDate: '2026-09-16', endDate: '2026-09-30' },
  { id: '10-1', name: '26년10-1차', month: 10, seq: 1, status: 'closed', startDate: '2026-10-01', endDate: '2026-10-15' },
];

export const INITIAL_GL_MASTER_ITEMS: GLMasterItem[] = [
  { id: 'gl-1', glCode: '51101000', glName: '급여' },
  { id: 'gl-2', glCode: '51102000', glName: '복리후생비' },
  { id: 'gl-3', glCode: '52201000', glName: '소모품비' },
  { id: 'gl-4', glCode: '52202000', glName: '수선비' },
  { id: 'gl-5', glCode: '53301000', glName: '지불수수료' },
  { id: 'gl-6', glCode: '53302000', glName: '유지보수비' },
  { id: 'gl-7', glCode: '54401000', glName: '원재료비' },
  { id: 'gl-8', glCode: '54402000', glName: '외주가공비' },
  { id: 'gl-9', glCode: '55501000', glName: '수선비' },
  { id: 'gl-10', glCode: '55502000', glName: '지급수수료' },
];

export const INITIAL_MASTER_ITEMS: MasterItem[] = [
  { id: 'm-1', glCode: '51101000', glName: '급여', subItem: '기본급 및 수당', attribution: '공통', dept: '노경', manager: '김철수' },
  { id: 'm-2', glCode: '51102000', glName: '복리후생비', subItem: '복리후생비', attribution: '공통', dept: '노경', manager: '이영수' },
  { id: 'm-3', glCode: '52201000', glName: '소모품비', subItem: '보호구 및 안전용품', attribution: 'MTBE4', dept: '환경안전', manager: '이영희' },
  { id: 'm-4', glCode: '52202000', glName: '수선비', subItem: '환경 개선 공사비', attribution: 'P3', dept: '환경안전', manager: '박철호' },
  { id: 'm-5', glCode: '53301000', glName: '지불수수료', subItem: '보안 S/W 라이선스', attribution: '공통', dept: 'IT보안팀', manager: '박민수' },
  { id: 'm-6', glCode: '53302000', glName: '유지보수비', subItem: '네트워크 장비 유지보수', attribution: 'MTBE4', dept: 'IT보안팀', manager: '최수진' },
  { id: 'm-7', glCode: '54401000', glName: '원재료비', subItem: '원자재 매입대금', attribution: 'MTBE4', dept: '구매', manager: '정지훈' },
  { id: 'm-8', glCode: '54402000', glName: '외주가공비', subItem: '부자재 외주비', attribution: 'P3', dept: '구매', manager: '강민아' },
  { id: 'm-9', glCode: '55501000', glName: '수선비', subItem: '생산설비 부품교체', attribution: 'P3', dept: '기술팀', manager: '한상진' },
  { id: 'm-10', glCode: '55502000', glName: '지급수수료', subItem: '엔지니어링 용역비', attribution: '공통', dept: '기술팀', manager: '오성민' },
];

// Sample Entries (Values in 백만원 unit)
export const INITIAL_ENTRIES: EntryData[] = [
  // --- Round 8-2 ---
  { id: '8-2_m-1', roundId: '8-2', masterId: 'm-1', dept: '노경', m1: 50, m2: 51, m3: 52, m4: 53, m5: 54, reason: '' },
  { id: '8-2_m-2', roundId: '8-2', masterId: 'm-2', dept: '노경', m1: 15, m2: 15, m3: 16, m4: 16, m5: 17, reason: '' },
  { id: '8-2_m-3', roundId: '8-2', masterId: 'm-3', dept: '환경안전', m1: 8, m2: 8, m3: 9, m4: 9, m5: 10, reason: '' },
  { id: '8-2_m-4', roundId: '8-2', masterId: 'm-4', dept: '환경안전', m1: 30, m2: 32, m3: 35, m4: 40, m5: 42, reason: '' },
  { id: '8-2_m-7', roundId: '8-2', masterId: 'm-7', dept: '구매', m1: 120, m2: 125, m3: 130, m4: 135, m5: 140, reason: '' },

  // --- Round 9-1 ---
  { id: '9-1_m-1', roundId: '9-1', masterId: 'm-1', dept: '노경', m1: 52, m2: 51, m3: 65, m4: 53, m5: 54, reason: '추석 상여금 및 임단협 소급분 반영으로 인한 1,300만원 증가' },
  { id: '9-1_m-2', roundId: '9-1', masterId: 'm-2', dept: '노경', m1: 15, m2: 15, m3: 16, m4: 16, m5: 17, reason: '' },
  { id: '9-1_m-3', roundId: '9-1', masterId: 'm-3', dept: '환경안전', m1: 8, m2: 9, m3: 9, m4: 10, m5: 10, reason: '' },
  { id: '9-1_m-4', roundId: '9-1', masterId: 'm-4', dept: '환경안전', m1: 45, m2: 48, m3: 35, m4: 40, m5: 42, reason: '공장 환경 개선 추가 공사비 집행 확정으로 인한 1,500만원 증액' },
  { id: '9-1_m-7', roundId: '9-1', masterId: 'm-7', dept: '구매', m1: 145, m2: 125, m3: 130, m4: 135, m5: 140, reason: '원자재 국제 시세 급등에 따른 2,500만원 예산 조정 반영' },
];
