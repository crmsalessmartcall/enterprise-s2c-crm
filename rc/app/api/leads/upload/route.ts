import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import Papa from 'papaparse';

export async function POST(request: Request) {
  const cookieStore = cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // 1. Authenticate user session
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch user's tenant_id and role
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', session.user.id)
    .single();

  if (userError || !userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('project_id') as string;

    if (!file || !projectId) {
      return NextResponse.json({ error: 'Missing file or project_id' }, { status: 400 });
    }

    // Read file contents as text
    const fileText = await file.text();

    // Parse CSV using PapaParse
    const parseResult = Papa.parse(fileText, {
      header: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({ error: 'Invalid CSV format', details: parseResult.errors }, { status: 400 });
    }

    const rows = parseResult.data as Array<{ customer_name: string; phone_number: string }>;

    // Map rows and inject tenant_id and project_id for absolute security
    const leadsToInsert = rows.map((row) => ({
      tenant_id: userData.tenant_id,
      project_id: projectId,
      customer_name: row.customer_name?.trim() || 'Unknown',
      phone_number: row.phone_number?.trim() || '',
      status: 'pending',
    })).filter(lead => lead.phone_number !== ''); // Filter out rows with missing phone numbers

    if (leadsToInsert.length === 0) {
      return NextResponse.json({ error: 'No valid leads found in CSV' }, { status: 400 });
    }

    // Bulk insert into Supabase leads table
    const { data: insertedLeads, error: insertError } = await supabase
      .from('leads')
      .insert(leadsToInsert)
      .select('id');

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully uploaded and queued ${insertedLeads.length} leads.` 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
