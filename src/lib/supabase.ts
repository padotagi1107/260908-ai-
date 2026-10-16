import { createClient } from '@supabase/supabase-js';

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

/**
 * Accumulatively save CSV data to Supabase csv_uploads table
 */
export async function saveCsvDataToSupabase(fileName: string, uploadedBy: string, data: any[]) {
  if (!isSupabaseConfigured || !supabase) {
    console.log('Supabase not configured. Skipping remote CSV sync, stored locally.');
    return;
  }
  try {
    const { error } = await supabase.from('csv_uploads').insert({
      file_name: fileName,
      uploaded_by: uploadedBy,
      record_count: data.length,
      data: data,
    });
    if (error) {
      console.error('Supabase CSV insert error:', error.message);
    } else {
      console.log(`Successfully accumulated ${data.length} records from ${fileName} to Supabase.`);
    }
  } catch (err) {
    console.error('Failed to save CSV data to Supabase:', err);
  }
}

/**
 * Sync authorized user to Supabase authorized_users table
 */
export async function syncUserToSupabase(user: { email: string; name: string; department?: string; role: string }) {
  if (!isSupabaseConfigured || !supabase) return;
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

/**
 * Delete authorized user from Supabase authorized_users table
 */
export async function deleteUserFromSupabase(email: string) {
  if (!isSupabaseConfigured || !supabase) return;
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

/**
 * Fetch authorized users from Supabase
 */
export async function fetchAuthorizedUsersFromSupabase(): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) return [];
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

