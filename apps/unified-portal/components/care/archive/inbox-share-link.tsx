'use client';

import { Copy, Link as LinkIcon, Settings } from 'lucide-react';

interface InboxShareLinkProps {
  url: string;
  onCopyToast?: (text: string) => void;
}

export function InboxShareLink({ url, onCopyToast }: InboxShareLinkProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onCopyToast?.('Link copied');
    } catch {
      onCopyToast?.('Link copied');
    }
  };

  return (
    <div className="bg-white border border-[#EAEAE4] rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 mb-3.5">
      <div className="w-7 h-7 bg-[#FDF9EB] rounded-md flex items-center justify-center text-[#D4AF37] flex-shrink-0">
        <LinkIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#8A8A82] mb-0.5">
          Upload link for third-party installers
        </div>
        <div className="font-mono text-[12px] text-[#111111] truncate">
          {url}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="px-2.5 py-1.5 text-[12px] bg-transparent border border-[#EAEAE4] rounded-md text-[#4B4B46] cursor-pointer inline-flex items-center gap-1.5 font-medium flex-shrink-0 hover:bg-[#F3F3EF] hover:text-[#111111] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
      >
        <Copy className="w-3 h-3" strokeWidth={1.75} />
        Copy
      </button>
      <button
        type="button"
        className="px-2.5 py-1.5 text-[12px] bg-transparent border border-[#EAEAE4] rounded-md text-[#4B4B46] cursor-pointer inline-flex items-center gap-1.5 font-medium flex-shrink-0 hover:bg-[#F3F3EF] hover:text-[#111111] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
      >
        <Settings className="w-3 h-3" strokeWidth={1.75} />
        Manage
      </button>
    </div>
  );
}
