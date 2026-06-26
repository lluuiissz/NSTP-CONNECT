import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, password, fullName, role } = await req.json();

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (role !== 'admin' && role !== 'nstp') {
      return NextResponse.json({ error: 'Invalid role for dashboard users' }, { status: 400 });
    }

    // 1. Create the user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm so they can login immediately
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Insert into public.users
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        role: role,
        is_verified: true, // Admins are implicitly verified
      });

    if (dbError) {
       // Rollback auth user creation if DB insert fails
       await supabaseAdmin.auth.admin.deleteUser(userId);
       return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: { id: userId, email, role } });

  } catch (error: any) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
