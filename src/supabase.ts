import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL || '';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && !!key;
export const supabase = configured ? createClient(url,key, { auth: { persistSession: true, autoRefreshToken:true,detectSessionInUrl:true } }) : null;
export const publicAvatarUrl=(path:string|null|undefined)=> path && supabase ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
