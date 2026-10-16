import { createClient } from '@supabase/supabase-js';
import { EntryData, MasterItem, GLMasterItem, Round, UserProfile } from '../types';

export function getSupabaseConfig(): { url: string; anonKey: string } {
  let url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
  let anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';

  if (url === 'YOUR_SUPABASE_URL' || url.includes('your-project') || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    url = '';
  }
  if (anonKey === 'YOUR_SUPABASE_ANON_KEY' || anonKey.length < 20) {
    anonKey = '';
  }
  return { url, anonKey };
}

const currentConfig = getSupabaseConfig();
export const isSupabaseConfigured = Boolean(currentConfig.url && currentConfig.anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(currentConfig.url, currentConfig.anonKey)
  : null;

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem('supabase_url', url.trim());
  localStorage.setItem('supabase_anon_key', anonKey.trim());
  window.location.reload();
}

export function clearSupabaseConfig() {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
  window.location.reload();
}

// -------------------------------------------------------------
// 1. Entries DB Operations (추정 입력값 관리)
// -------------------------------------------------------------
export async function fetchEntriesFromSupabase(): Promise<EntryData[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Failed to fetch entries:', error.message);
      return null;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      roundId: row.round_id,
      masterId: row.master_id,
      dept: row.dept,
      m1: row.m1 === null || row.m1 === undefined || row.m1 === '' ? '' : Number(row.m1),
      m2: row.m2 === null || row.m2 === undefined || row.m2 === '' ? '' : Number(row.m2),
      m3: row.m3 === null || row.m3 === undefined || row.m3 === '' ? '' : Number(row.m3),
      m4: row.m4 === null || row.m4 === undefined || row.m4 === '' ? '' : Number(row.m4),
      m5: row.m5 === null || row.m5 === undefined || row.m5 === '' ? '' : Number(row.m5),
      reason: row.reason || '',
      updatedAt: row.updated_at,
      updatedBy: row.updated_by || '',
    }));
  } catch (err) {
    console.error('[Supabase] Error fetching entries:', err);
    return null;
  }
}

/**
 * Upsert only modified entries to Supabase
 */
export async function upsertEntriesToSupabase(entries: EntryData[]): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: true }; // Local mode
  if (entries.length === 0) return { success: true };

  try {
    const rows = entries.map((e) => ({
      id: e.id,
      round_id: e.roundId,
      master_id: e.masterId,
      dept: e.dept,
      m1: e.m1 === '' || e.m1 === null || e.m1 === undefined ? null : Number(e.m1),
      m2: e.m2 === '' || e.m2 === null || e.m2 === undefined ? null : Number(e.m2),
      m3: e.m3 === '' || e.m3 === null || e.m3 === undefined ? null : Number(e.m3),
      m4: e.m4 === '' || e.m4 === null || e.m4 === undefined ? null : Number(e.m4),
      m5: e.m5 === '' || e.m5 === null || e.m5 === undefined ? null : Number(e.m5),
      reason: e.reason || null,
      updated_by: e.updatedBy || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('entries')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('[Supabase] Entries upsert error:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[Supabase] Unexpected error during entries upsert:', err);
    return { success: false, error: err?.message || 'DB 통신 오류' };
  }
}

// -------------------------------------------------------------
// 2. Rounds DB Operations (입력 회차 관리)
// -------------------------------------------------------------
export async function fetchRoundsFromSupabase(): Promise<Round[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Supabase] Failed to fetch rounds:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      month: r.month,
      seq: r.seq || 1,
      status: r.status as 'open' | 'closed',
      startDate: r.start_date,
      endDate: r.end_date,
    }));
  } catch (err) {
    console.error('[Supabase] Error fetching rounds:', err);
    return null;
  }
}

export async function upsertRoundToSupabase(round: Round): Promise<boolean> {
  if (!supabase) return true;
  try {
    const payload = {
      id: round.id,
      name: round.name,
      month: round.month,
      seq: round.seq,
      status: round.status,
      start_date: round.startDate,
      end_date: round.endDate,
    };
    const { error } = await supabase.from('rounds').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] Round upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Round upsert exception:', err);
    return false;
  }
}

export async function deleteRoundFromSupabase(roundId: string): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { error } = await supabase.from('rounds').delete().eq('id', roundId);
    if (error) {
      console.error('[Supabase] Round delete error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Round delete exception:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 3. Master Items DB Operations (마스터 항목 관리)
// -------------------------------------------------------------
export async function fetchMasterItemsFromSupabase(): Promise<MasterItem[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('master_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Supabase] Failed to fetch master items:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((m: any) => ({
      id: m.id,
      keyNo: m.key_no,
      glCode: m.gl_code,
      glName: m.gl_name,
      subItem: m.sub_item,
      attribution: m.attribution,
      dept: m.dept,
      manager: m.manager,
    }));
  } catch (err) {
    console.error('[Supabase] Error fetching master items:', err);
    return null;
  }
}

export async function upsertMasterItemToSupabase(item: MasterItem): Promise<boolean> {
  if (!supabase) return true;
  try {
    const payload = {
      id: item.id,
      key_no: item.keyNo,
      gl_code: item.glCode,
      gl_name: item.glName,
      sub_item: item.subItem,
      attribution: item.attribution,
      dept: item.dept,
      manager: item.manager,
    };
    const { error } = await supabase.from('master_items').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] Master item upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Master item upsert exception:', err);
    return false;
  }
}

export async function deleteMasterItemFromSupabase(id: string): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { error } = await supabase.from('master_items').delete().eq('id', id);
    if (error) {
      console.error('[Supabase] Master item delete error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Master item delete exception:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 4. GL Master Items DB Operations (GL 마스터 관리)
// -------------------------------------------------------------
export async function fetchGLMasterFromSupabase(): Promise<GLMasterItem[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('gl_master_items')
      .select('*')
      .order('gl_code', { ascending: true });

    if (error) {
      console.warn('[Supabase] Failed to fetch GL master items:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((g: any) => ({
      id: g.id,
      glCode: g.gl_code,
      glName: g.gl_name,
    }));
  } catch (err) {
    console.error('[Supabase] Error fetching GL master items:', err);
    return null;
  }
}

export async function upsertGLMasterToSupabase(item: GLMasterItem): Promise<boolean> {
  if (!supabase) return true;
  try {
    const payload = {
      id: item.id,
      gl_code: item.glCode,
      gl_name: item.glName,
      category: '제조고정비',
    };
    const { error } = await supabase.from('gl_master_items').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('[Supabase] GL master upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] GL master upsert exception:', err);
    return false;
  }
}

export async function deleteGLMasterFromSupabase(id: string): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { error } = await supabase.from('gl_master_items').delete().eq('id', id);
    if (error) {
      console.error('[Supabase] GL master delete error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] GL master delete exception:', err);
    return false;
  }
}

// -------------------------------------------------------------
// 5. Authorized Users DB Operations
// -------------------------------------------------------------
export async function fetchAuthorizedUsersFromSupabase(): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('authorized_users')
      .select('*');
    if (error) {
      console.warn('Failed to fetch authorized_users from Supabase:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Error fetching authorized_users from Supabase:', err);
    return [];
  }
}

export async function syncUserToSupabase(user: { email: string; name: string; department?: string; role: string }) {
  if (!supabase) return;
  try {
    const cleanEmail = user.email.trim().toLowerCase();
    const payload = {
      email: cleanEmail,
      name: user.name,
      department: user.department || (user.role === 'operator' ? '총괄운영' : '공통'),
      role: user.role === 'operator' ? 'admin' : 'manager',
    };
    const { error } = await supabase
      .from('authorized_users')
      .upsert(payload, { onConflict: 'email' });
    if (error) {
      console.warn('Supabase authorized_users sync error:', error.message);
    }
  } catch (err) {
    console.warn('Failed to sync user to Supabase authorized_users:', err);
  }
}

export async function deleteUserFromSupabase(email: string) {
  if (!supabase) return;
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase
      .from('authorized_users')
      .delete()
      .ilike('email', cleanEmail);
    if (error) {
      console.warn('Supabase authorized_users delete error:', error.message);
    }
  } catch (err) {
    console.warn('Failed to delete user from Supabase authorized_users:', err);
  }
}

// -------------------------------------------------------------
// 6. Explicit Migration: Upload Local Data to Supabase
// -------------------------------------------------------------
export async function migrateLocalDataToSupabase(
  rounds: Round[],
  masterItems: MasterItem[],
  glMasterItems: GLMasterItem[],
  entries: EntryData[]
): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'Supabase 접속 정보가 설정되지 않았습니다.' };
  }
  try {
    // 1. GL Master
    if (glMasterItems.length > 0) {
      const glRows = glMasterItems.map((g) => ({
        id: g.id,
        gl_code: g.glCode,
        gl_name: g.glName,
        category: '제조고정비',
      }));
      await supabase.from('gl_master_items').upsert(glRows, { onConflict: 'id' });
    }

    // 2. Master Items
    if (masterItems.length > 0) {
      const mRows = masterItems.map((m) => ({
        id: m.id,
        key_no: m.keyNo,
        gl_code: m.glCode,
        gl_name: m.glName,
        sub_item: m.subItem,
        attribution: m.attribution,
        dept: m.dept,
        manager: m.manager,
      }));
      await supabase.from('master_items').upsert(mRows, { onConflict: 'id' });
    }

    // 3. Rounds
    if (rounds.length > 0) {
      const rRows = rounds.map((r) => ({
        id: r.id,
        name: r.name,
        month: r.month,
        seq: r.seq,
        status: r.status,
        start_date: r.startDate,
        end_date: r.endDate,
      }));
      await supabase.from('rounds').upsert(rRows, { onConflict: 'id' });
    }

    // 4. Entries
    if (entries.length > 0) {
      const eRows = entries.map((e) => ({
        id: e.id,
        round_id: e.roundId,
        master_id: e.masterId,
        dept: e.dept,
        m1: e.m1 === '' || e.m1 === null ? null : Number(e.m1),
        m2: e.m2 === '' || e.m2 === null ? null : Number(e.m2),
        m3: e.m3 === '' || e.m3 === null ? null : Number(e.m3),
        m4: e.m4 === '' || e.m4 === null ? null : Number(e.m4),
        m5: e.m5 === '' || e.m5 === null ? null : Number(e.m5),
        reason: e.reason || null,
        updated_by: e.updatedBy || null,
        updated_at: e.updatedAt || new Date().toISOString(),
      }));
      await supabase.from('entries').upsert(eRows, { onConflict: 'id' });
    }

    return {
      success: true,
      message: `성공적으로 로컬 데이터(회차 ${rounds.length}건, 마스터 ${masterItems.length}건, 입력값 ${entries.length}건)를 Supabase DB에 동기화했습니다.`,
    };
  } catch (err: any) {
    return { success: false, message: `동기화 중 오류 발생: ${err?.message || err}` };
  }
}
