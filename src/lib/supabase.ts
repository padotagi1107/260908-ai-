import { createClient } from '@supabase/supabase-js';

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';
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
