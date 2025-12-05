'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminSession } from '@/lib/types';
import { ArrowLeft, Copy, Eye, EyeOff, Edit2, Users, Mail } from 'lucide-react';

interface Unit {
  id: string;
  unit_number: string | null;
  resident_name: string | null;
  resident_email: string | null;
  address: string | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  development_id: string;
  created_at: string;
  important_docs_agreed_version: number;
  important_docs_agreed_at: string | null;
  development?: {
    id: string;
    name: string;
    important_docs_version: number;
  };
}

function extractHouseNumber(address: string | null, unitNumber: string | null): number {
  if (address) {
    const match = address.match(/^(\d+)/);
    if (match) return parseInt(match[1]);
  }
  if (unitNumber) {
    const match = unitNumber.match(/\d+/);
    if (match) return parseInt(match[0]);
  }
  return 999;
}

export function HomeownersList({ 
  session, 
  homeowners,
  development,
  developmentId 
}: { 
  session: AdminSession;
  homeowners: any[];
  development?: any;
  developmentId?: string;
}) {
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  function toggleTokenVisibility(id: string) {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function copyQRLink(homeownerId: string) {
    const tenantPortalUrl = process.env.NEXT_PUBLIC_TENANT_PORTAL_URL || 'http://localhost:5000';
    navigator.clipboard.writeText(`${tenantPortalUrl}/developer/homeowners/${homeownerId}`);
    setCopied(homeownerId);
    setTimeout(() => setCopied(null), 2000);
  }

  // Sort units by house number
  const sortedUnits = [...homeowners].sort((a, b) => {
    const aNum = extractHouseNumber(a.address, a.unit_number);
    const bNum = extractHouseNumber(b.address, b.unit_number);
    return aNum - bNum;
  });

  return (
    <div className="min-h-full bg-gradient-to-br from-white via-grey-50 to-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gold-200/30 px-8 py-6 backdrop-blur-sm bg-white/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/developer" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
            <h1 className="text-3xl font-bold text-grey-900">Homeowners</h1>
            <p className="text-grey-600 text-sm mt-1">Longview Estates - {homeowners.length} residents</p>
          </div>
          <Link
            href="/developer/homeowners/new"
            className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition flex items-center gap-2 shadow-md"
          >
            <span>+ Add Homeowner</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8 flex-1">
        <div className="max-w-4xl mx-auto">
          {homeowners.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gold-200/50 p-12 text-center">
              <Users className="w-12 h-12 text-gold-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-grey-900 mb-1">No residents found</p>
              <p className="text-sm text-grey-600">Units will appear here as they are created.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedUnits.map((unit) => {
                const houseNum = extractHouseNumber(unit.address, unit.unit_number);
                const displayNum = houseNum !== 999 ? houseNum : (unit.unit_number || '?');
                const residentName = unit.purchaser_name || unit.resident_name || unit.name || 'Unassigned';
                const email = unit.purchaser_email || unit.resident_email || unit.email;
                
                // Important docs agreement status - ALWAYS use unit's own development version
                const currentVersion = unit.development?.important_docs_version || 0;
                const agreedVersion = unit.important_docs_agreed_version || 0;
                const hasAgreed = agreedVersion >= currentVersion && currentVersion > 0;
                const needsConsent = !hasAgreed && currentVersion > 0;
                
                return (
                  <div key={unit.id} className="rounded-lg border border-gold-200/30 backdrop-blur-sm bg-white/80 hover:shadow-md hover:border-gold-300/50 transition overflow-hidden">
                    {/* Row Content */}
                    <div className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        {/* House Number */}
                        <div className="flex-shrink-0">
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                            {displayNum}
                          </div>
                        </div>

                        {/* Main Info */}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-grey-900">{residentName}</h3>
                          <div className="mt-2 space-y-1">
                            {email && (
                              <div className="flex items-center gap-2 text-sm text-grey-600">
                                <Mail className="w-4 h-4 text-gold-500" />
                                <a href={`mailto:${email}`} className="hover:text-gold-600 transition">
                                  {email}
                                </a>
                              </div>
                            )}
                            {unit.address && (
                              <p className="text-sm text-grey-600">{unit.address}</p>
                            )}
                            <p className="text-xs text-grey-500">
                              Added {new Date(unit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            
                            {/* Important Docs Agreement Status */}
                            {currentVersion > 0 && (
                              <div className="mt-2 pt-2 border-t border-gold-100">
                                {hasAgreed ? (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                      ✓ Docs Agreed
                                    </span>
                                    <span className="text-grey-500">
                                      v{agreedVersion} • {unit.important_docs_agreed_at ? new Date(unit.important_docs_agreed_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gold-100 text-gold-700 font-medium">
                                      ⚠ Consent Required
                                    </span>
                                    <span className="text-grey-500">
                                      Needs v{currentVersion} agreement
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/developer/homeowners/${unit.id}/edit`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gold-500 hover:bg-gold-50 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
