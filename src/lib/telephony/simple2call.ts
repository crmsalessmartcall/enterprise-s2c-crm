interface DialRequestParams {
  agentPhone: string;
  customerPhone: string;
  apiSettings: {
    un?: string;
    pw?: string;
    svr?: string;
    sb_tag?: string;
    routed_name?: string;
  };
}

export async function initiateTelephonyCall({ agentPhone, customerPhone, apiSettings }: DialRequestParams) {
  // Use tenant-specific credentials or fallback to env platform defaults
  const username = apiSettings.un || process.env.DEFAULT_S2C_USERNAME;
  const password = apiSettings.pw || process.env.DEFAULT_S2C_PASSWORD;
  const serverUrl = apiSettings.svr || process.env.DEFAULT_S2C_SERVER;
  const sbTag = apiSettings.sb_tag || process.env.DEFAULT_S2C_SB_TAG;

  const payload = {
    un: username,
    pw: password,
    agent_number: agentPhone,
    customer_number: customerPhone,
    sb_tag: sbTag,
  };

  try {
    const response = await fetch(`${serverUrl}/api/v1/agent_call_customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Telephony gateway error');
    }

    return {
      success: true,
      tran_id: data.tran_id,          // Unique transaction reference
      access_number: data.access_number, // Bridge number for CLI / auto-fill
    };
  } catch (error: any) {
    console.error('Telephony API Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to telephony service',
    };
  }
}
