import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const wazuhHost = process.env.WAZUH_HOST;
    
    console.log('WAZUH_HOST from env:', wazuhHost);
    console.log('All env vars:', Object.keys(process.env).filter(key => key.includes('WAZUH')));
    
    if (!wazuhHost) {
      return NextResponse.json({ 
        error: 'WAZUH_HOST not configured'
      }, { status: 500 });
    }

    // Extract IP from WAZUH_HOST (remove protocol and port if present)
    const wazuhIP = wazuhHost.replace(/^https?:\/\//, '').split(':')[0];
    
    return NextResponse.json({ 
      wazuhHost: wazuhIP
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch configuration'
    }, { status: 500 });
  }
}