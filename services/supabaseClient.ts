import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fqhkdkkspwqqcveqrfhq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rt6mluu6Hgq6vPrgbQOwRw_4paRe66u';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface HealthLog {
  id?: number;
  created_at?: string;
  metric_type: 'RHR' | 'GLUCOSE' | 'HRV';
  value: number;
}

export const logHealthMetric = async (type: 'RHR' | 'GLUCOSE' | 'HRV', value: number) => {
  try {
    const { error } = await supabase
      .from('health_logs')
      .insert([{ metric_type: type, value }]);
    
    if (error) throw error;
  } catch (err) {
    console.error("Error logging to Supabase:", err);
    // Fail silently in production for demo if table doesn't exist
  }
};

export const getHealthHistory = async (type: 'RHR' | 'GLUCOSE' | 'HRV', limit = 30) => {
  try {
    const { data, error } = await supabase
      .from('health_logs')
      .select('*')
      .eq('metric_type', type)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error fetching history:", err);
    return [];
  }
};