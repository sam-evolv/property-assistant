/**
 * POST /api/care/chat — Chat endpoint for Care assistant
 *
 * Integrates solar troubleshooting KB and installation-specific context.
 * Falls back to Claude API for general questions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  findByErrorCode,
  findBySymptom,
  SOLAR_TROUBLESHOOTING,
} from '@/lib/care/solarTroubleshooting';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const { installationId, message, systemType } = await request.json();

    if (!installationId || !message) {
      return NextResponse.json(
        { error: 'installationId and message required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get installation details
    const { data: installation } = await supabase
      .from('installations')
      .select('*')
      .eq('id', installationId)
      .single();

    const system = systemType || installation?.system_type;

    // Try to find relevant troubleshooting entry
    let troubleshootingMatch = null;
    let sources: Array<{ title: string; type: string; excerpt: string }> = [];

    if (system === 'solar') {
      // Check if message contains error code (e.g., "F32", "F21")
      const errorCodeMatch = message.match(/\b(F\d{2}|ERR_\w+)\b/i);
      if (errorCodeMatch) {
        troubleshootingMatch = findByErrorCode(errorCodeMatch[1]);
      }

      // If no error code, try fuzzy match on symptom
      if (!troubleshootingMatch) {
        const matches = findBySymptom(message);
        if (matches.length > 0) {
          troubleshootingMatch = matches[0];
        }
      }
    }

    // If we found a troubleshooting match, format the response
    if (troubleshootingMatch) {
      const response = formatTroubleshootingResponse(troubleshootingMatch);
      sources.push({
        title: 'Solar Troubleshooting KB',
        type: 'Troubleshooting Guide',
        excerpt: troubleshootingMatch.symptom,
      });

      return NextResponse.json({
        response,
        sources,
        followUps: generateFollowUps(troubleshootingMatch),
        confidence: 'high',
      });
    }

    // Fall back to Claude API for general questions
    const claudeResponse = await callClaude(message, installation, system);

    return NextResponse.json({
      response: claudeResponse,
      sources: [],
      followUps: ['Can I prevent this in the future?', 'Who should I contact?'],
      confidence: 'medium',
    });
  } catch (error) {
    console.error('[Care Chat API] error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

function formatTroubleshootingResponse(entry: any): string {
  let response = `**${entry.symptom}**\n\n`;

  response += `**What's happening:** ${entry.diagnosis}\n\n`;

  if (entry.homeownerCanFix) {
    response += `**You can fix this:** Yes!\n\n`;
    response += `**Steps:\n`;
    entry.steps.forEach((step: string, idx: number) => {
      response += `${idx + 1}. ${step}\n`;
    });
    response += `\n**Time needed:** ${entry.estimatedTime}\n`;
  } else {
    response += `**You can fix this:** No, requires a technician\n\n`;
    if (entry.requiresTechnician) {
      response += `**What to do:** Contact your installer to schedule a service visit.\n`;
      response += `**Typical cost:** €${entry.calloutCost}\n`;
    }
  }

  response += `\n**Prevention:** ${entry.prevention}\n`;

  if (entry.severity === 'critical') {
    response += `\n⚠️ **Important:** This requires attention soon. If you can't fix it yourself, contact your installer.`;
  }

  return response;
}

function generateFollowUps(entry: any): string[] {
  const followUps: string[] = [];

  if (entry.homeownerCanFix) {
    followUps.push('I\'ve tried these steps, still not working');
  } else if (entry.requiresTechnician) {
    followUps.push('How do I contact my installer?');
  }

  followUps.push('Can I prevent this in the future?');

  return followUps;
}

async function callClaude(message: string, installation: any, systemType: string): Promise<string> {
  // This would call Claude API
  // For now, return a generic response
  return `I'm not sure about that. Here are some general tips for your ${systemType} system:\n\n- Check the manufacturer manual for your specific system\n- If you see error codes on the display, try restarting the system\n- Contact your installer if issues persist\n\nFor specific troubleshooting, I can help with common problems if you describe the symptom or error code you're seeing.`;
}
