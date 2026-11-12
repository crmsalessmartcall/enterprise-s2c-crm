import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { initiateTelephonyCall } from '@/lib/telephony/simple2call';

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
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { leadId, customerPhone } = body;

    if (!leadId || !customerPhone) {
      return NextResponse.json({ success: false, error: 'Missing leadId or customerPhone' }, { status: 400 });
    }

    // 2. Fetch user's tenant_id, agent phone number, and tenant api_settings
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id, id, full_name, tenants(api_settings)')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'User tenant profile not found' }, { status: 403 });
    }

    const tenantApiSettings = (userData.tenants as any)?.api_settings || {};

    // For demo purposes, we pull the agent's phone from request or fallback to profile
    // In production, agents have a registered SIP/PSTN device number in their user record.
    const agentPhone = body.agentPhone || process.env.DEFAULT_AGENT_PHONE || '+15550199999';

    // 3. Fire Telephony Gateway API
    const telephonyResult = await initiateTelephonyCall({
      agentPhone,
      customerPhone,
      apiSettings: tenantApiSettings,
    });

    if (!telephonyResult.success) {
      return NextResponse.json({ success: false, error: telephonyResult.error }, { status: 502 });
    }

    // 4. Log call initiation in call_logs table
    await supabase.from('call_logs').insert({
      tenant_id: userData.tenant_id,
      agent_id: userData.id,
      lead_id: leadId,
      tran_id: telephonyResult.tran_id,
      access_number: telephonyResult.access_number,
      status: 'initiated',
    });

    return NextResponse.json({
      success: true,
      tran_id: telephonyResult.tran_id,
      access_number: telephonyResult.access_number,
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
