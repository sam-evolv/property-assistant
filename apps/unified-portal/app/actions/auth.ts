'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logout() {
  const supabase = createServerComponentClient({ cookies });
  
  await supabase.auth.signOut();
  
  redirect('/');
}
