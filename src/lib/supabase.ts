import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function saveSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', anonKey);
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
