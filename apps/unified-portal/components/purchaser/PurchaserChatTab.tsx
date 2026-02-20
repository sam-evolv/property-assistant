'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Home, Mic, Send, FileText, Download, Eye, Info, ChevronDown, ChevronUp, AlertCircle, Copy, Check } from 'lucide-react';
import { useSuggestedPills } from '@/hooks/useSuggestedPills';
import { PillDefinition } from '@/lib/assistant/suggested-pills';
import { cleanForDisplay } from '@/lib/assistant/formatting';

const SUGGESTED_PILLS_V2_ENABLED = process.env.NEXT_PUBLIC_SUGGESTED_PILLS_V2 === 'true';

// Animation styles for typing indicator, logo hover, and message animations
const ANIMATION_STYLES = `
  @keyframes dot-bounce {
    0%, 60%, 100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-8px);
    }
  }
  @keyframes logo-float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-12px);
    }
  }
  @keyframes message-fade-in {
    0% {
      opacity: 0;
      transform: translateY(8px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .typing-dot {
    animation: dot-bounce 1.4s infinite;
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin: 0 2px;
  }
  .dot-1 { animation-delay: 0s; }
  .dot-2 { animation-delay: 0.2s; }
  .dot-3 { animation-delay: 0.4s; }
  .logo-container {
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .logo-container:hover {
    animation: logo-float 2s ease-in-out infinite;
  }
  .message-bubble {
    animation: message-fade-in 0.3s ease-out forwards;
  }
  .copy-button {
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  .message-container:hover .copy-button {
    opacity: 1;
  }
`;

const TYPING_STYLES = ANIMATION_STYLES;

// Streaming display configuration for natural text appearance
const STREAMING_CONFIG = {
  baseDelay: 18,           // Base delay between words (ms)
  variance: 8,             // Random variance +/- (ms)
  sentenceDelay: 50,       // Extra delay after . ! ?
  paragraphDelay: 100,     // Extra delay after paragraph breaks
  initialDelay: 350,       // Delay before text starts appearing (thinking time)
};

// Helper to calculate delay for natural text cadence
function getWordDelay(word: string, isAfterParagraph: boolean): number {
  const base = STREAMING_CONFIG.baseDelay;
  const variance = (Math.random() * STREAMING_CONFIG.variance * 2) - STREAMING_CONFIG.variance;
  let delay = base + variance;

  // Add extra pause after sentence-ending punctuation
  if (/[.!?]$/.test(word)) {
    delay += STREAMING_CONFIG.sentenceDelay;
  }

  // Add extra pause after paragraph breaks
  if (isAfterParagraph) {
    delay += STREAMING_CONFIG.paragraphDelay;
  }

  return Math.max(10, delay);
}

// Format assistant content with selective styling for professionalism
// Converts clean text into styled HTML with bold headings and proper list formatting
function formatAssistantContent(content: string, isDarkMode: boolean): string {
  if (!content) return '';

  // Escape HTML to prevent XSS
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Style lines that end with a colon as bold headings (e.g., "Walls:" or "Important:")
  // These are section headers in the assistant's responses
  html = html.replace(/^([A-Z][^:\n]{0,50}:)\s*$/gm, (match, heading) => {
    return `<strong class="block mt-3 mb-1 text-[15px] font-semibold">${heading}</strong>`;
  });

  // Also style inline headings that start a paragraph (e.g., "Walls: The walls are...")
  html = html.replace(/^([A-Z][^:\n]{0,50}:)(\s+\S)/gm, (match, heading, rest) => {
    return `<strong class="font-semibold">${heading}</strong>${rest}`;
  });

  // Style list items with proper indentation and bullet styling
  // Using flex with items-start ensures multi-line text aligns properly (not under the bullet)
  html = html.replace(/^- (.+)$/gm, (match, item) => {
    return `<div class="flex items-start gap-2 ml-1 my-1"><span class="text-gold-500 select-none shrink-0 mt-[2px]">•</span><span class="flex-1">${item}</span></div>`;
  });

  // Style numbered lists with proper alignment for multi-line items
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, (match, num, item) => {
    return `<div class="flex items-start gap-2 ml-1 my-1"><span class="text-gold-500 font-medium select-none shrink-0 min-w-[1.25rem] mt-[1px]">${num}.</span><span class="flex-1">${item}</span></div>`;
  });

  // Make URLs clickable (but keep them clean-looking)
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">$1</a>'
  );

  // Make phone numbers clickable (Irish and international formats)
  // Matches: +353..., 01234..., 083..., 0800..., etc.
  html = html.replace(
    /(\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}|\b0\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b)/g,
    (match) => {
      const cleanNumber = match.replace(/[\s-]/g, '');
      return `<a href="tel:${cleanNumber}" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">${match}</a>`;
    }
  );

  // Make email addresses clickable
  html = html.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" class="text-gold-500 hover:text-gold-400 underline underline-offset-2">$1</a>'
  );

  // Smart typography - convert straight quotes to curly quotes
  // Using Unicode escape sequences to avoid parsing issues with curly quotes
  html = html.replace(/(\s|^)"([^"]+)"(\s|$|[.,!?])/g, '$1\u201C$2\u201D$3'); // Double quotes " "
  html = html.replace(/(\s|^)'([^']+)'(\s|$|[.,!?])/g, '$1\u2018$2\u2019$3'); // Single quotes ' '
  html = html.replace(/(\w)'(\w)/g, '$1\u2019$2'); // Apostrophes (e.g., "don't") '
  html = html.replace(/--/g, '–'); // En-dash
  html = html.replace(/\.\.\./g, '…'); // Ellipsis

  // Highlight important numbers - prices, measurements, percentages
  // Prices (€, £, $)
  html = html.replace(
    /([€£$]\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:euro|EUR|pounds?|GBP))/gi,
    '<span class="font-semibold text-gold-600">$1</span>'
  );
  // Measurements (m², sq ft, sqm, etc.)
  html = html.replace(
    /(\d+(?:\.\d+)?\s*(?:m²|sq\.?\s*(?:ft|m|metres?|meters?)|sqm|square\s+(?:feet|metres?|meters?)|hectares?|ha|acres?))/gi,
    '<span class="font-medium">$1</span>'
  );
  // Percentages
  html = html.replace(
    /(\d+(?:\.\d+)?%)/g,
    '<span class="font-medium">$1</span>'
  );
  // Dates (common formats)
  html = html.replace(
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})/gi,
    '<span class="font-medium">$1</span>'
  );

  // Convert newlines to proper breaks (preserve paragraph structure)
  html = html.replace(/\n\n/g, '</p><p class="mt-3">');
  html = html.replace(/\n/g, '<br/>');

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p class="mt-3"><\/p>/g, '');
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

const TypingIndicator = ({ isDarkMode }: { isDarkMode: boolean }) => (
  <div className={`flex justify-start`}>
    <style>{TYPING_STYLES}</style>
    <div
      className={`rounded-[20px] rounded-bl-[6px] px-4 py-2.5 shadow-sm ${
        isDarkMode
          ? 'bg-[#1C1C1E] shadow-black/20'
          : 'bg-[#E9E9EB] shadow-black/5'
      }`}
    >
      <div className="flex items-center gap-1">
        <div className={`typing-dot dot-1 ${isDarkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
        <div className={`typing-dot dot-2 ${isDarkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
        <div className={`typing-dot dot-3 ${isDarkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
      </div>
    </div>
  </div>
);

// Copy button component for assistant messages
const CopyButton = ({ content, isDarkMode }: { content: string; isDarkMode: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      // Haptic feedback on mobile if available
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`copy-button absolute -bottom-1 -right-1 p-1.5 rounded-full transition-all ${
        isDarkMode
          ? 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white'
          : 'bg-gray-200 hover:bg-gray-300 text-gray-500 hover:text-gray-700'
      } ${copied ? 'opacity-100' : ''}`}
      title={copied ? 'Copied!' : 'Copy message'}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
};

// Weather card component for rich weather display
const WeatherCard = ({ card, isDarkMode }: { card: NonNullable<Message['weather_card']>; isDarkMode: boolean }) => {
  const conditions = (card.conditions || '').toLowerCase();

  // Weather emoji
  let emoji = '\u{1F324}\uFE0F'; // default 🌤️
  if (conditions.includes('thunder')) emoji = '\u26C8\uFE0F';
  else if (conditions.includes('heavy rain') || conditions.includes('persistent rain')) emoji = '\u{1F327}\uFE0F';
  else if (conditions.includes('rain') || conditions.includes('drizzle') || conditions.includes('shower')) emoji = '\u{1F326}\uFE0F';
  else if (conditions.includes('snow') || conditions.includes('sleet') || conditions.includes('hail')) emoji = '\u{1F328}\uFE0F';
  else if (conditions.includes('fog') || conditions.includes('mist')) emoji = '\u{1F32B}\uFE0F';
  else if (conditions.includes('overcast') || conditions.includes('cloudy')) emoji = '\u2601\uFE0F';
  else if (conditions.includes('partly') || conditions.includes('cloud') || conditions.includes('sun')) emoji = '\u26C5';
  else if (conditions.includes('clear') || conditions.includes('sunny') || conditions.includes('bright') || conditions.includes('fair')) emoji = '\u2600\uFE0F';

  // Gradient
  let gradient = 'from-blue-600 to-slate-700';
  if (conditions.includes('rain') || conditions.includes('drizzle') || conditions.includes('shower') || conditions.includes('thunder')) gradient = 'from-blue-700 to-slate-800';
  else if (conditions.includes('snow') || conditions.includes('sleet')) gradient = 'from-blue-300 to-slate-500';
  else if (conditions.includes('fog') || conditions.includes('mist')) gradient = 'from-gray-400 to-slate-600';
  else if (conditions.includes('clear') || conditions.includes('sunny') || conditions.includes('fair') || conditions.includes('bright')) gradient = 'from-sky-500 to-blue-600';
  else if (conditions.includes('cloudy') || conditions.includes('overcast')) gradient = 'from-slate-500 to-slate-700';

  return (
    <div className={`max-w-[280px] rounded-2xl bg-gradient-to-br ${gradient} p-4 shadow-lg`}>
      {/* Top row: city + emoji */}
      <div className="flex items-start justify-between">
        <span className="text-sm text-white/80">{card.city}</span>
        <span className="text-4xl leading-none">{emoji}</span>
      </div>
      {/* Temperature */}
      {card.temp && (
        <div className="mt-1">
          <span className="text-5xl font-bold text-white">{card.temp}</span>
          <span className="text-2xl font-light text-white/80">{'\u00B0C'}</span>
        </div>
      )}
      {/* Conditions */}
      {card.conditions && (
        <p className="mt-0.5 text-sm capitalize text-white/80">{card.conditions}</p>
      )}
      {/* Wind + humidity */}
      <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
        {card.wind_speed && (
          <span>{card.wind_dir ? `${card.wind_dir} ` : ''}Wind {card.wind_speed} km/h</span>
        )}
        {card.humidity && <span>Humidity {card.humidity}%</span>}
      </div>
      {/* Forecast */}
      {card.forecast_today && (
        <>
          <div className="mt-3 border-t border-white/20" />
          <p className="mt-2 text-xs leading-relaxed text-white/60 line-clamp-2">{card.forecast_today}</p>
        </>
      )}
    </div>
  );
};

// Transit route card for bus/train queries
const TransitCard = ({ card, isDarkMode }: { card: NonNullable<Message['transit_card']>; isDarkMode: boolean }) => {
  const vehicleColors: Record<string, string> = {
    BUS: 'bg-green-600',
    RAIL: 'bg-blue-600',
    TRAM: 'bg-amber-500',
  };

  const routes = card.routes.slice(0, 5);

  return (
    <div className={`max-w-[300px] rounded-2xl border p-4 shadow-sm ${
      isDarkMode ? 'bg-[#1C1C1E] border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <p className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        {'\uD83D\uDE8C'} Routes to {card.destination}
      </p>
      <div className="space-y-0">
        {routes.map((route, i) => (
          <div key={`${route.short_name}-${i}`}>
            {i > 0 && <div className={`border-t my-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-100'}`} />}
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                vehicleColors[route.vehicle_type || ''] || 'bg-gray-500'
              }`}>
                {route.short_name}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {route.headsign || route.long_name || route.short_name}
                </p>
              </div>
              {route.journey_min != null && (
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                  isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}>
                  {route.journey_min} min
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// BER energy rating card — EU energy label style
const BerRatingCard = ({ card, isDarkMode }: { card: NonNullable<Message['ber_card']>; isDarkMode: boolean }) => {
  const ratings = [
    { label: 'A1', color: 'bg-green-800', width: '30%' },
    { label: 'A2', color: 'bg-green-600', width: '35%' },
    { label: 'A3', color: 'bg-green-500', width: '40%' },
    { label: 'B1', color: 'bg-lime-500', width: '45%' },
    { label: 'B2', color: 'bg-lime-400', width: '50%' },
    { label: 'B3', color: 'bg-yellow-400', width: '55%' },
    { label: 'C1', color: 'bg-yellow-500', width: '58%' },
    { label: 'C2', color: 'bg-amber-400', width: '62%' },
    { label: 'D1', color: 'bg-amber-500', width: '68%' },
    { label: 'D2', color: 'bg-orange-500', width: '73%' },
    { label: 'E1', color: 'bg-orange-600', width: '78%' },
    { label: 'E2', color: 'bg-red-500', width: '83%' },
    { label: 'F', color: 'bg-red-600', width: '90%' },
    { label: 'G', color: 'bg-red-800', width: '100%' },
  ];

  return (
    <div className={`max-w-[260px] rounded-2xl border p-4 shadow-sm ${
      isDarkMode ? 'bg-[#1C1C1E] border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
        Building Energy Rating
      </p>
      <div className="space-y-1">
        {ratings.map((r) => {
          const isActive = r.label.toUpperCase() === card.rating.toUpperCase();
          return (
            <div key={r.label} className="flex items-center gap-2">
              <span className={`w-6 text-right text-xs font-mono ${
                isActive
                  ? (isDarkMode ? 'text-white font-bold' : 'text-gray-900 font-bold')
                  : (isDarkMode ? 'text-gray-500' : 'text-gray-400')
              }`}>
                {r.label}
              </span>
              <div className="flex-1 relative">
                <div
                  className={`h-4 rounded-sm ${r.color} ${
                    isActive ? 'ring-2 ring-amber-400 ring-offset-1' : 'opacity-60'
                  } ${isDarkMode && isActive ? 'ring-offset-[#1C1C1E]' : ''}`}
                  style={{ width: r.width }}
                />
              </div>
              {isActive && (
                <span className="text-xs">{'\u2705'}</span>
              )}
            </div>
          );
        })}
      </div>
      {card.label && (
        <p className={`mt-3 text-xs font-medium ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
          {card.label}
        </p>
      )}
    </div>
  );
};

// Warranty timeline card
const WarrantyTimelineCard = ({ card, isDarkMode }: { card: NonNullable<Message['warranty_card']>; isDarkMode: boolean }) => {
  const devPct = Math.round((card.developer_years / (card.developer_years + (card.structural_years - card.developer_years))) * 100);
  const structPct = 100 - devPct;

  return (
    <div className={`max-w-[300px] rounded-2xl border p-4 shadow-sm ${
      isDarkMode ? 'bg-[#1C1C1E] border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <p className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        {'\uD83D\uDEE1\uFE0F'} Warranty Coverage
      </p>
      {/* Timeline bar */}
      <div className="flex gap-1 mb-2">
        <div
          className="rounded-l-lg bg-amber-500 h-8 flex items-center justify-center"
          style={{ width: `${devPct}%` }}
        >
          <span className="text-xs font-bold text-white truncate px-1">Yr 1–{card.developer_years}</span>
        </div>
        <div
          className="rounded-r-lg bg-blue-600 h-8 flex items-center justify-center"
          style={{ width: `${structPct}%` }}
        >
          <span className="text-xs font-bold text-white truncate px-1">Yr {card.developer_years + 1}–{card.structural_years}</span>
        </div>
      </div>
      {/* Labels */}
      <div className="flex gap-1 mb-3">
        <div style={{ width: `${devPct}%` }}>
          <p className={`text-xs font-medium ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>Developer Warranty</p>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Snags & defects</p>
        </div>
        <div style={{ width: `${structPct}%` }}>
          <p className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>Structural Guarantee</p>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{card.providers.join(' / ')}</p>
        </div>
      </div>
      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        Appliance warranties are separate — register with manufacturer
      </p>
    </div>
  );
};

// Contact card — shown when LLM response contains contact details
const ContactCard = ({ card, isDarkMode }: { card: NonNullable<Message['contact_card']>; isDarkMode: boolean }) => {
  return (
    <div className={`mt-3 rounded-2xl border p-4 ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'} shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#C4A44A] flex items-center justify-center text-white text-sm font-bold">
          {card.name ? card.name[0] : '👤'}
        </div>
        <div>
          {card.name && <div className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{card.name}</div>}
          <div className={`text-xs ${isDarkMode ? 'text-zinc-400' : 'text-gray-500'}`}>Contact</div>
        </div>
      </div>
      <div className="space-y-2">
        {card.phone && (
          <a href={`tel:${card.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-[#C4A44A] text-sm font-medium">
            <span>📞</span> {card.phone}
          </a>
        )}
        {card.email && (
          <a href={`mailto:${card.email}`} className="flex items-center gap-2 text-[#C4A44A] text-sm font-medium">
            <span>✉️</span> {card.email}
          </a>
        )}
      </div>
    </div>
  );
};

const SourcesDropdown = ({
  sources,
  isDarkMode
}: {
  sources: SourceDocument[];
  isDarkMode: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!sources || sources.length === 0) return null;
  
  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-xs transition-colors ${
          isDarkMode 
            ? 'text-gray-500 hover:text-gray-400' 
            : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <Info className="h-3 w-3" />
        <span>Sources</span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      
      {isOpen && (
        <div className={`mt-2 rounded-lg border p-2 text-xs ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-800/50' 
            : 'border-gray-200 bg-gray-50'
        }`}>
          <p className={`mb-1 font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Based on:
          </p>
          <ul className="space-y-1">
            {sources.map((source, idx) => (
              <li key={idx} className={`flex items-start gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  {source.name}
                  {source.date && <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}> ({source.date})</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const RequestInfoButton = ({ 
  question,
  unitId,
  isDarkMode,
  onSubmitted,
}: { 
  question: string;
  unitId: string;
  isDarkMode: boolean;
  onSubmitted: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const handleSubmit = async () => {
    if (submitting || submitted) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/information-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          unitId,
          context: 'Submitted from chat when AI could not answer',
        }),
      });
      
      if (res.ok) {
        setSubmitted(true);
        onSubmitted();
      }
    } catch (error) {
      console.error('Failed to submit request:', error);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (submitted) {
    return (
      <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isDarkMode 
          ? 'bg-green-900/30 text-green-400' 
          : 'bg-green-50 text-green-700'
      }`}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Request submitted - the team will add this info</span>
      </div>
    );
  }
  
  return (
    <button
      onClick={handleSubmit}
      disabled={submitting}
      className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        isDarkMode
          ? 'bg-gold-600/20 text-gold-400 hover:bg-gold-600/30'
          : 'bg-gold-100 text-gold-700 hover:bg-gold-200'
      } disabled:opacity-50`}
    >
      <AlertCircle className="h-4 w-4" />
      <span>{submitting ? 'Submitting...' : 'Request this information'}</span>
    </button>
  );
};

interface DrawingData {
  fileName: string;
  drawingType: string;
  drawingDescription: string;
  houseTypeCode: string;
  previewUrl: string;
  downloadUrl: string;
  explanation: string;
}

interface AttachmentData {
  id: string;
  title: string;
  fileName: string;
  previewUrl: string;
  downloadUrl: string;
  docType?: string;
  houseTypeCode?: string | null;
}

interface ClarificationOption {
  id: string;
  label: string;
  description: string;
}

interface ClarificationData {
  type: string;
  options: ClarificationOption[];
}

interface SourceDocument {
  name: string;
  date: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  floorPlanUrl?: string | null;
  drawing?: DrawingData | null;
  attachments?: AttachmentData[] | null;
  clarification?: ClarificationData | null;
  sources?: SourceDocument[] | null;
  isNoInfo?: boolean;
  map_url?: string | null;
  weather_card?: {
    city: string;
    temp: string | null;
    conditions: string | null;
    wind_speed: string | null;
    wind_dir: string | null;
    humidity: string | null;
    forecast_today: string | null;
  } | null;
  transit_card?: {
    routes: Array<{
      short_name: string;
      long_name?: string;
      vehicle_type?: string;
      headsign?: string;
      journey_min?: number;
    }>;
    destination: string;
  } | null;
  ber_card?: { rating: string; label: string } | null;
  warranty_card?: {
    developer_years: number;
    structural_years: number;
    providers: string[];
  } | null;
  contact_card?: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

interface PurchaserChatTabProps {
  houseId: string;
  developmentId: string;
  initialMessage: string;
  purchaserName?: string;
  developmentName?: string;
  developmentLogoUrl?: string | null;
  unitUid: string;
  token: string;
  selectedLanguage: string;
  isDarkMode: boolean;
  userId?: string | null;
}

// Translations for UI and prompts
const TRANSLATIONS: Record<string, any> = {
  en: {
    welcome: 'Ask anything about your home or community',
    subtitle: 'Quick answers for daily life: floor plans, amenities, local services, and more.',
    prompts: [
      "Kitchen Layout",
      "First-Year Maintenance",
      "Broadband Setup",
      "EV Charging"
    ],
    placeholder: 'Ask about your home or community...',
    askButton: 'Ask',
    powered: 'Powered by AI • Information for reference only',
    privacyLink: 'Privacy Policy',
    voiceNotSupported: 'Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.',
    sessionExpired: 'Session expired. Please scan your QR code again.',
    errorOccurred: 'Sorry, I encountered an error. Please try again.'
  },
  pl: {
    welcome: 'Zapytaj o cokolwiek dotyczącego Twojego domu lub społeczności',
    subtitle: 'Szybkie odpowiedzi na co dzień: plany pięter, udogodnienia, lokalne usługi i więcej.',
    prompts: [
      "Transport publiczny",
      "Plany pięter",
      "Zasady parkowania",
      "Okolica"
    ],
    placeholder: 'Zapytaj o swój dom lub społeczność...',
    askButton: 'Zapytaj',
    powered: 'Zasilane przez AI • Informacje wyłącznie w celach informacyjnych',
    privacyLink: 'Polityka prywatności',
    voiceNotSupported: 'Wprowadzanie głosowe nie jest obsługiwane w Twojej przeglądarce. Użyj Chrome, Edge lub Safari.',
    sessionExpired: 'Sesja wygasła. Zeskanuj ponownie kod QR.',
    errorOccurred: 'Przepraszamy, napotkaliśmy błąd. Spróbuj ponownie.'
  },
  es: {
    welcome: 'Pregunta cualquier cosa sobre tu hogar o comunidad',
    subtitle: 'Respuestas rápidas para la vida diaria: planos, comodidades, servicios locales y más.',
    prompts: [
      "Transporte público",
      "Planos",
      "Reglas de estacionamiento",
      "Área local"
    ],
    placeholder: 'Pregunta sobre tu hogar o comunidad...',
    askButton: 'Preguntar',
    powered: 'Con tecnología de IA • Información solo como referencia',
    privacyLink: 'Política de privacidad',
    voiceNotSupported: 'La entrada de voz no es compatible con su navegador. Utilice Chrome, Edge o Safari.',
    sessionExpired: 'Sesión expirada. Escanee su código QR nuevamente.',
    errorOccurred: 'Lo sentimos, encontré un error. Inténtelo de nuevo.'
  },
  ru: {
    welcome: 'Спросите что угодно о вашем доме или сообществе',
    subtitle: 'Быстрые ответы на повседневные вопросы: планировки, удобства, местные услуги и многое другое.',
    prompts: [
      "Общественный транспорт",
      "Планировки",
      "Правила парковки",
      "Местность"
    ],
    placeholder: 'Спросите о вашем доме или сообществе...',
    askButton: 'Спросить',
    powered: 'На базе ИИ • Информация только для справки',
    privacyLink: 'Политика конфиденциальности',
    voiceNotSupported: 'Голосовой ввод не поддерживается в вашем браузере. Используйте Chrome, Edge или Safari.',
    sessionExpired: 'Сеанс истек. Отсканируйте QR-код еще раз.',
    errorOccurred: 'Извините, произошла ошибка. Попробуйте еще раз.'
  },
  pt: {
    welcome: 'Pergunte qualquer coisa sobre sua casa ou comunidade',
    subtitle: 'Respostas rápidas para o dia a dia: plantas, comodidades, serviços locais e mais.',
    prompts: [
      "Transporte público",
      "Plantas",
      "Regras de estacionamento",
      "Área local"
    ],
    placeholder: 'Pergunte sobre sua casa ou comunidade...',
    askButton: 'Perguntar',
    powered: 'Alimentado por IA • Informação apenas para referência',
    privacyLink: 'Política de Privacidade',
    voiceNotSupported: 'A entrada de voz não é compatível com o seu navegador. Use Chrome, Edge ou Safari.',
    sessionExpired: 'Sessão expirada. Escaneie seu código QR novamente.',
    errorOccurred: 'Desculpe, encontrei um erro. Tente novamente.'
  },
  lv: {
    welcome: 'Jautājiet jebko par savu māju vai kopienu',
    subtitle: 'Ātras atbildes ikdienai: plāni, ērtības, vietējie pakalpojumi un vairāk.',
    prompts: [
      "Sabiedriskais transports",
      "Stāvu plāni",
      "Stāvvietas noteikumi",
      "Vietējā apkārtne"
    ],
    placeholder: 'Jautājiet par savu māju vai kopienu...',
    askButton: 'Jautāt',
    powered: 'Darbina AI • Informācija tikai atsaucei',
    privacyLink: 'Privātuma politika',
    voiceNotSupported: 'Balss ievade netiek atbalstīta jūsu pārlūkprogrammā. Lūdzu, izmantojiet Chrome, Edge vai Safari.',
    sessionExpired: 'Sesija beigusies. Lūdzu, skenējiet QR kodu vēlreiz.',
    errorOccurred: 'Atvainojiet, radās kļūda. Lūdzu, mēģiniet vēlreiz.'
  },
  lt: {
    welcome: 'Klauskite bet ko apie savo namus ar bendruomenę',
    subtitle: 'Greiti atsakymai kasdienybei: planai, patogumai, vietinės paslaugos ir daugiau.',
    prompts: [
      "Viešasis transportas",
      "Aukštų planai",
      "Parkavimo taisyklės",
      "Vietovė"
    ],
    placeholder: 'Klauskite apie savo namus ar bendruomenę...',
    askButton: 'Klausti',
    powered: 'Veikia AI • Informacija tik nuorodai',
    privacyLink: 'Privatumo politika',
    voiceNotSupported: 'Balso įvedimas nepalaikomas jūsų naršyklėje. Naudokite Chrome, Edge arba Safari.',
    sessionExpired: 'Sesija pasibaigė. Nuskaitykite QR kodą dar kartą.',
    errorOccurred: 'Atsiprašome, įvyko klaida. Bandykite dar kartą.'
  },
  ro: {
    welcome: 'Întrebați orice despre casa sau comunitatea dvs.',
    subtitle: 'Răspunsuri rapide pentru viața de zi cu zi: planuri, facilități, servicii locale și multe altele.',
    prompts: [
      "Transport public",
      "Planuri etaje",
      "Reguli parcare",
      "Zona locală"
    ],
    placeholder: 'Întrebați despre casa sau comunitatea dvs...',
    askButton: 'Întreabă',
    powered: 'Alimentat de AI • Informații doar ca referință',
    privacyLink: 'Politica de confidențialitate',
    voiceNotSupported: 'Intrarea vocală nu este acceptată în browserul dvs. Vă rugăm să utilizați Chrome, Edge sau Safari.',
    sessionExpired: 'Sesiunea a expirat. Vă rugăm să scanați codul QR din nou.',
    errorOccurred: 'Ne pare rău, am întâlnit o eroare. Vă rugăm să încercați din nou.'
  },
  ga: {
    welcome: 'Fiafraigh aon rud faoi do theach nó do phobal',
    subtitle: 'Freagraí tapa don saol laethúil: pleananna urláir, áiseanna, seirbhísí áitiúla, agus tuilleadh.',
    prompts: [
      "Iompar Poiblí",
      "Pleananna Urláir",
      "Rialacha Páirceála",
      "An Ceantar Áitiúil"
    ],
    placeholder: 'Fiafraigh faoi do theach nó do phobal...',
    askButton: 'Fiafraigh',
    powered: 'Faoi chumhacht AI • Eolas le haghaidh tagartha amháin',
    privacyLink: 'Polasaí Príobháideachta',
    voiceNotSupported: 'Ní thacaítear le hionchur gutha i do bhrabhsálaí. Úsáid Chrome, Edge, nó Safari.',
    sessionExpired: 'Seisiún imithe in éag. Scan do chód QR arís.',
    errorOccurred: 'Tá brón orainn, tharla earráid. Bain triail eile as.'
  }
};

export default function PurchaserChatTab({
  houseId,
  developmentId,
  initialMessage,
  purchaserName,
  developmentName,
  developmentLogoUrl,
  unitUid,
  token,
  selectedLanguage,
  isDarkMode,
  userId,
}: PurchaserChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Controlled streaming display state
  const [displayedContent, setDisplayedContent] = useState<string>('');
  const [fullContent, setFullContent] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const typingAbortRef = useRef<boolean>(false);
  const streamingMessageIndexRef = useRef<number>(-1);
  const [hasBeenWelcomed, setHasBeenWelcomed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(`chat_welcomed_${unitUid}`) === 'true';
    }
    return false;
  });
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  
  const { pills: suggestedPillsV2, sessionId: pillSessionId } = useSuggestedPills(SUGGESTED_PILLS_V2_ENABLED, developmentId);
  const [lastIntentKey, setLastIntentKey] = useState<string | null>(null);

  // iOS Capacitor-only state - DOES NOT affect web app
  const [isIOSNative, setIsIOSNative] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [iosTabBarHeight, setIosTabBarHeight] = useState(96); // Dynamic height, fallback 96px

  // Detect iOS Capacitor native platform - runs once on mount
  // Uses window.Capacitor which is injected by Capacitor runtime in native apps
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check for Capacitor on window object (injected by native runtime)
    const cap = (window as any).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && typeof cap.getPlatform === 'function') {
      if (cap.isNativePlatform() && cap.getPlatform() === 'ios') {
        setIsIOSNative(true);
      }
    }
  }, []);

  // Track keyboard state for iOS native ONLY
  useEffect(() => {
    if (!isIOSNative || typeof window === 'undefined') return;
    
    const vv = window.visualViewport;
    if (!vv) return;
    
    const checkKeyboard = () => {
      // Keyboard is open if visual viewport is significantly smaller than window
      const keyboardThreshold = 150;
      const keyboardOpen = (window.innerHeight - vv.height) > keyboardThreshold;
      setIsKeyboardOpen(keyboardOpen);
    };
    
    vv.addEventListener('resize', checkKeyboard);
    checkKeyboard();
    
    return () => vv.removeEventListener('resize', checkKeyboard);
  }, [isIOSNative]);

  // Measure actual tab bar height from DOM for iOS native
  useEffect(() => {
    if (!isIOSNative || typeof window === 'undefined') return;
    
    const measureTabBarHeight = () => {
      // Try to find the tab bar nav element directly in DOM using data attribute
      const tabBarEl = document.querySelector('[data-mobile-tab-bar="true"]') as HTMLElement;
      if (tabBarEl && tabBarEl.offsetHeight > 0) {
        setIosTabBarHeight(tabBarEl.offsetHeight);
        return;
      }
      
      // Fallback: try CSS variable
      const cssValue = getComputedStyle(document.documentElement)
        .getPropertyValue('--mobile-tab-bar-h')
        .trim();
      if (cssValue) {
        const parsed = parseFloat(cssValue);
        if (!isNaN(parsed) && parsed > 0) {
          setIosTabBarHeight(Math.ceil(parsed));
        }
      }
    };
    
    // MutationObserver to detect when tab bar is added to DOM
    const observer = new MutationObserver(() => {
      measureTabBarHeight();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Read initially and on resize
    measureTabBarHeight();
    window.addEventListener('resize', measureTabBarHeight);
    
    // Poll a few times for late-mounted tab bars
    const timers = [
      setTimeout(measureTabBarHeight, 100),
      setTimeout(measureTabBarHeight, 500),
      setTimeout(measureTabBarHeight, 1000),
    ];
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureTabBarHeight);
      timers.forEach(clearTimeout);
    };
  }, [isIOSNative]);

  useEffect(() => {
    const el = inputBarRef.current;
    if (!el) return;
    
    const updateHeight = () => {
      const height = el.offsetHeight;
      document.documentElement.style.setProperty(
        '--purchaser-inputbar-h',
        `${height}px`
      );
      document.documentElement.style.setProperty(
        '--input-bar-h',
        `${height}px`
      );
    };
    
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    updateHeight();
    
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    
    if (vv) {
      const onResize = () => {
        const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
        document.documentElement.style.setProperty('--vv-offset', `${offset}px`);
      };
      
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
      onResize();
      
      return () => {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      };
    } else {
      const fallback = () => {
        document.documentElement.style.setProperty('--vvh', `${window.innerHeight}px`);
        document.documentElement.style.setProperty('--vv-offset', '0px');
      };
      window.addEventListener('resize', fallback);
      fallback();
      return () => window.removeEventListener('resize', fallback);
    }
  }, []);

  useEffect(() => {
    // Initialize Web Speech API
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = selectedLanguage === 'en' ? 'en-US' :
                          selectedLanguage === 'pl' ? 'pl-PL' :
                          selectedLanguage === 'es' ? 'es-ES' :
                          selectedLanguage === 'ru' ? 'ru-RU' :
                          selectedLanguage === 'pt' ? 'pt-PT' :
                          selectedLanguage === 'lv' ? 'lv-LV' :
                          selectedLanguage === 'lt' ? 'lt-LT' :
                          selectedLanguage === 'ro' ? 'ro-RO' :
                          selectedLanguage === 'ga' ? 'ga-IE' : 'en-US';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [selectedLanguage]);

  const toggleVoiceInput = () => {
    const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;
    if (!speechSupported || !recognitionRef.current) {
      alert(t.voiceNotSupported);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  interface IntentMetadata {
    source: 'suggested_pill';
    intentKey: string;
    templateId: string;
    pillId: string;
  }

  // Controlled typing effect for natural text display
  const displayTextWithDelay = useCallback(async (
    fullText: string,
    messageIndex: number,
    drawing: DrawingData | null,
    sources: SourceDocument[] | null
  ) => {
    typingAbortRef.current = false;
    setIsTyping(true);

    // Sanitize the text for display (remove markdown)
    const sanitizedText = cleanForDisplay(fullText);

    // Initial thinking delay
    await new Promise(resolve => setTimeout(resolve, STREAMING_CONFIG.initialDelay));

    if (typingAbortRef.current) {
      setIsTyping(false);
      return;
    }

    // Split into words while preserving whitespace structure
    const words = sanitizedText.split(/(\s+)/);
    let displayed = '';
    let prevWasParagraph = false;

    for (let i = 0; i < words.length; i++) {
      if (typingAbortRef.current) break;

      const word = words[i];
      displayed += word;

      // Update the message content
      setMessages((prev) => {
        const updated = [...prev];
        if (messageIndex >= 0 && updated[messageIndex]) {
          updated[messageIndex] = {
            ...updated[messageIndex],
            content: displayed,
            drawing: drawing,
            sources: sources,
          };
        }
        return updated;
      });

      // Only add delay for non-whitespace words
      if (word.trim()) {
        const delay = getWordDelay(word, prevWasParagraph);
        await new Promise(resolve => setTimeout(resolve, delay));
        prevWasParagraph = false;
      } else if (word.includes('\n\n')) {
        prevWasParagraph = true;
      }
    }

    setIsTyping(false);
  }, []);

  const sendMessage = async (messageText?: string, intentMetadata?: IntentMetadata) => {
    const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;
    const textToSend = messageText || input.trim();
    if (!textToSend || sending) return;

    if (!token) {
      console.error('No token available for chat');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t.sessionExpired,
        },
      ]);
      return;
    }

    if (showHome) {
      setShowHome(false);
    }
    const userMessage: Message = { role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    
    setInput('');
    setSending(true);

    // Haptic feedback on send (mobile)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }

    if (intentMetadata) {
      setLastIntentKey(intentMetadata.intentKey);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-qr-token': token,
        },
        body: JSON.stringify({
          developmentId,
          message: textToSend,
          userId: userId || undefined,
          unitUid: unitUid,
          hasBeenWelcomed: hasBeenWelcomed,
          language: selectedLanguage,
          ...(intentMetadata && {
            intentMetadata: {
              source: intentMetadata.source,
              intent_key: intentMetadata.intentKey,
              template_id: intentMetadata.templateId,
              pill_id: intentMetadata.pillId,
            }
          }),
          ...(lastIntentKey && !intentMetadata && { lastIntentKey }),
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      // Handle streaming response (Server-Sent Events)
      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader available');

        const decoder = new TextDecoder();
        let streamedContent = '';
        let drawing: DrawingData | null = null;
        let sources: SourceDocument[] | null = null;
        let berCard: Message['ber_card'] = null;
        let warrantyCard: Message['warranty_card'] = null;
        let contactCard: Message['contact_card'] = null;
        let assistantMessageIndex = -1;

        // Add placeholder assistant message immediately (empty - typing indicator shown via sending state)
        setMessages((prev) => {
          assistantMessageIndex = prev.length;
          streamingMessageIndexRef.current = assistantMessageIndex;
          return [...prev, { role: 'assistant', content: '', drawing: null, sources: null }];
        });

        // STREAMING: Display text immediately as it arrives for perceived speed
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'metadata') {
                  // Received metadata with drawing and source info
                  if (data.drawing) {
                    drawing = data.drawing;
                  }
                  if (data.sources && data.sources.length > 0) {
                    sources = data.sources;
                  }
                  if (data.ber_card) {
                    berCard = data.ber_card;
                  }
                  if (data.warranty_card) {
                    warrantyCard = data.warranty_card;
                  }
                  if (data.contact_card) {
                    contactCard = data.contact_card;
                  }
                } else if (data.type === 'text') {
                  // IMMEDIATE DISPLAY: Show text as it arrives for fast perceived response
                  streamedContent += data.content;
                  const displayContent = cleanForDisplay(streamedContent);
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: displayContent,
                        drawing: drawing,
                        sources: sources,
                      };
                    }
                    return updated;
                  });
                } else if (data.type === 'done') {
                  // Capture contact_card from done event (detected after full response is built)
                  if (data.contact_card) {
                    contactCard = data.contact_card;
                  }

                  // Streaming complete - finalize message
                  const isNoInfoResponse = streamedContent.toLowerCase().includes("i don't have that information") ||
                    streamedContent.toLowerCase().includes("i don't have that specific detail") ||
                    streamedContent.toLowerCase().includes("i'd recommend contacting your developer");

                  // Final update with isNoInfo flag and rich cards
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: cleanForDisplay(streamedContent),
                        drawing: drawing,
                        sources: sources,
                        isNoInfo: isNoInfoResponse,
                        ber_card: berCard,
                        warranty_card: warrantyCard,
                        contact_card: contactCard,
                      };
                    }
                    return updated;
                  });

                  // Mark user as welcomed after first successful response
                  if (!hasBeenWelcomed) {
                    localStorage.setItem(`chat_welcomed_${unitUid}`, 'true');
                    setHasBeenWelcomed(true);
                  }
                } else if (data.type === 'error') {
                  setMessages((prev) => {
                    const updated = [...prev];
                    if (assistantMessageIndex >= 0 && updated[assistantMessageIndex]) {
                      updated[assistantMessageIndex] = {
                        ...updated[assistantMessageIndex],
                        content: t.errorOccurred,
                      };
                    }
                    return updated;
                  });
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      } else {
        // Handle non-streaming JSON response (liability override, clarification, errors)
        const data = await res.json();

        if (data.answer) {
          // Sanitize markdown from the response before displaying
          const sanitizedAnswer = cleanForDisplay(data.answer);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: sanitizedAnswer,
              floorPlanUrl: data.floorPlanUrl || null,
              drawing: data.drawing || null,
              attachments: data.attachments || null,
              clarification: data.clarification || null,
              map_url: data.map_url || null,
              weather_card: data.weather_card || null,
              transit_card: data.transit_card || null,
              ber_card: data.ber_card || null,
              warranty_card: data.warranty_card || null,
              contact_card: data.contact_card || null,
            },
          ]);

          // Mark user as welcomed after first successful response (non-streaming path)
          if (!hasBeenWelcomed) {
            localStorage.setItem(`chat_welcomed_${unitUid}`, 'true');
            setHasBeenWelcomed(true);
          }
        } else if (data.error) {
          // Use the API's answer field if available (for user-friendly error messages)
          // Otherwise fall back to generic error messages
          let errorMessage: string;
          if (res.status === 401 || res.status === 403) {
            errorMessage = t.sessionExpired;
          } else if (data.answer) {
            errorMessage = data.answer;
          } else {
            errorMessage = t.errorOccurred;
          }
          
          console.error('[Chat] API error:', data.error, data.details);
          
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: errorMessage,
            },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t.errorOccurred,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Floor plan prompt keys in different languages
  const FLOOR_PLAN_PROMPTS = [
    'Floor Plans',      // English
    'Plany pięter',     // Polish
    'Planos',           // Spanish
    'Планировки',       // Russian
    'Plantas',          // Portuguese
    'Stāvu plāni',      // Latvian
    'Aukštų planai',    // Lithuanian
    'Planuri etaje',    // Romanian
    'Pleananna Urláir'  // Irish
  ];
  
  const handleQuickPrompt = (prompt: string) => {
    // Check if this is a floor plan prompt - send a specific query
    if (FLOOR_PLAN_PROMPTS.includes(prompt)) {
      sendMessage('Show me the floor plans for my home');
    } else {
      sendMessage(prompt);
    }
  };

  const handlePillClick = (pill: PillDefinition) => {
    const intentMetadata: IntentMetadata = {
      source: 'suggested_pill',
      intentKey: pill.intentKey,
      templateId: pill.templateId,
      pillId: pill.id,
    };
    sendMessage(pill.userVisibleQuestion, intentMetadata);
  };

  const handleHomeClick = () => {
    setShowHome(true);
    setMessages([]);
  };

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const inputBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300';
  const inputText = isDarkMode ? 'text-white' : 'text-gray-900';

  // Ref for scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const userScrolledUp = useRef(false);

  // Track if user has scrolled up from bottom
  // Re-run when showHome changes or messages appear to attach listener to the correct container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 100; // px from bottom
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      userScrolledUp.current = !isAtBottom;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [showHome, messages.length > 0]);

  // Helper function to scroll to bottom - uses scrollTop for iOS compatibility
  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Use requestAnimationFrame for smoother iOS scrolling
    requestAnimationFrame(() => {
      if (smooth && !isIOSNative) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        // For iOS native, use direct scrollTop (more reliable in WebView)
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [isIOSNative]);

  // Scroll to bottom when messages change or when sending/streaming
  useEffect(() => {
    if ((messages.length > 0 || sending) && scrollContainerRef.current) {
      // Always scroll when user sends a message (sending becomes true)
      // or on initial load, or when user hasn't manually scrolled up
      if (sending || isInitialLoad.current || !userScrolledUp.current) {
        scrollToBottom(!isInitialLoad.current);
        // Reset userScrolledUp when sending so we follow the response
        if (sending) {
          userScrolledUp.current = false;
        }
      }
      // After first scroll, switch to smooth for subsequent messages
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
    }
  }, [messages.length, sending, scrollToBottom]);
  
  // Auto-scroll during streaming/typing (when last message content updates)
  const lastMessage = messages[messages.length - 1];
  const lastMessageContent = lastMessage?.content || '';
  useEffect(() => {
    if (scrollContainerRef.current && lastMessage?.role === 'assistant' && !userScrolledUp.current) {
      // Use smooth scroll that keeps pace with typing
      scrollToBottom(true);
    }
  }, [lastMessageContent, scrollToBottom, isTyping]);

  return (
    <div 
      ref={messagesContainerRef}
      className={`flex flex-col h-full min-h-0 overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-white'}`}
    >
      {/* CONTENT AREA - Either home screen or messages */}
      {messages.length === 0 && showHome ? (
        /* HOME SCREEN - Centered hero, scrollable with bottom padding */
        <div 
          className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          style={{
            paddingBottom: 'calc(var(--purchaser-inputbar-h, 88px) + var(--mobile-tab-bar-h, 80px) + env(safe-area-inset-bottom, 0px) + 12px)'
          }}
        >
          <style>{ANIMATION_STYLES}</style>
          
          {/* Logo */}
          <div className={`logo-container ${isDarkMode ? 'drop-shadow-[0_0_35px_rgba(245,158,11,0.25)]' : 'drop-shadow-[0_8px_32px_rgba(0,0,0,0.12)]'}`}>
            {developmentLogoUrl ? (
              <img
                src={developmentLogoUrl}
                alt={`${developmentName || 'Development'} logo`}
                className={`h-[147px] w-auto object-contain ${isDarkMode ? 'brightness-0 invert' : ''}`}
              />
            ) : (
              <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>
                {developmentName || 'Home'}
              </span>
            )}
          </div>

          {/* Welcome Headline */}
          <h1 className={`mt-3 text-center text-[17px] font-semibold leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {t.welcome.includes('or community') ? (
              <>
                {t.welcome.split('or community')[0]}
                <span className="block">or community</span>
              </>
            ) : (
              t.welcome
            )}
          </h1>

          {/* Subtitle */}
          <p className={`mt-1.5 text-center text-[12px] leading-relaxed max-w-[280px] ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
            {t.subtitle}
          </p>

          {/* 2x2 Prompt Grid */}
          <div className="mt-4"></div>
          <div className="grid w-full max-w-[300px] grid-cols-2 gap-1.5">
            {SUGGESTED_PILLS_V2_ENABLED && suggestedPillsV2.length === 4 ? (
              suggestedPillsV2.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePillClick(pill);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handlePillClick(pill);
                  }}
                  className={`flex items-center justify-center rounded-full px-2.5 py-2 text-[12px] font-medium transition-all duration-200 cursor-pointer truncate touch-manipulation ${
                    isDarkMode 
                      ? 'border border-gray-700 bg-gray-800 text-gray-200 hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.4)] active:scale-95'
                      : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.35)] active:scale-95'
                  }`}
                  title={pill.label}
                >
                  {pill.label}
                </button>
              ))
            ) : (
              t.prompts.map((prompt: string, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickPrompt(prompt);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleQuickPrompt(prompt);
                  }}
                  className={`flex items-center justify-center rounded-full px-2.5 py-2 text-[12px] font-medium transition-all duration-200 cursor-pointer touch-manipulation ${
                    isDarkMode 
                      ? 'border border-gray-700 bg-gray-800 text-gray-200 hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.4)] active:scale-95'
                      : 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-gold-500 hover:shadow-[0_0_10px_rgba(234,179,8,0.35)] active:scale-95'
                  }`}
                >
                  {prompt}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        /* MESSAGES AREA - This is the only scrollable region */
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-4 pt-3"
          style={{
            paddingBottom: 'calc(var(--purchaser-inputbar-h, 88px) + var(--mobile-tab-bar-h, 80px) + env(safe-area-inset-bottom, 0px) + 12px)',
            overflowAnchor: 'auto',
            overscrollBehaviorY: 'contain',
          }}
        >
          <div className="mx-auto max-w-3xl flex flex-col gap-4">
              {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                  return (
                    <div key={`msg-${idx}`} className="flex justify-end">
                      {/* User bubble - iMessage inspired, asymmetric rounded */}
                      <div className={`message-bubble max-w-[75%] rounded-[20px] rounded-br-[6px] px-4 py-3 shadow-sm ${
                        isDarkMode
                          ? 'bg-gradient-to-br from-gold-500 to-gold-600 text-white shadow-gold-500/10'
                          : 'bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-gold-500/20'
                      }`}>
                        <p className="text-[15px] leading-[1.5] whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  );
                }
                // Skip rendering empty assistant messages (placeholder during typing)
                if (!msg.content && !msg.drawing && !msg.attachments) {
                  return null;
                }
                return (
                  <div key={`msg-${idx}`} className="flex justify-start message-container group">
                    {/* Assistant bubble - iMessage inspired, asymmetric rounded */}
                    <div className={`message-bubble max-w-[80%] rounded-[20px] rounded-bl-[6px] px-4 py-3 shadow-sm relative ${
                      isDarkMode
                        ? 'bg-[#1C1C1E] text-white shadow-black/20'
                        : 'bg-[#E9E9EB] text-gray-900 shadow-black/5'
                    }`}>
                      {msg.weather_card ? (
                        <div>
                          <WeatherCard card={msg.weather_card} isDarkMode={isDarkMode} />
                          {msg.content && (
                            <div className={`mt-2 text-xs leading-relaxed ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} style={{ opacity: 0.7 }} dangerouslySetInnerHTML={{ __html: formatAssistantContent(msg.content, isDarkMode) }} />
                          )}
                        </div>
                      ) : msg.transit_card ? (
                        <div>
                          <TransitCard card={msg.transit_card} isDarkMode={isDarkMode} />
                          {msg.content && (
                            <div className={`mt-2 text-[15px] leading-[1.6] whitespace-pre-wrap break-words assistant-content`} dangerouslySetInnerHTML={{ __html: formatAssistantContent(msg.content, isDarkMode) }} />
                          )}
                        </div>
                      ) : (
                        <div className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words assistant-content" dangerouslySetInnerHTML={{ __html: formatAssistantContent(msg.content, isDarkMode) }} />
                      )}
                      {/* BER rating card — shown after text content */}
                      {msg.ber_card && (
                        <div className="mt-3">
                          <BerRatingCard card={msg.ber_card} isDarkMode={isDarkMode} />
                        </div>
                      )}
                      {/* Warranty timeline card — shown after text content */}
                      {msg.warranty_card && (
                        <div className="mt-3">
                          <WarrantyTimelineCard card={msg.warranty_card} isDarkMode={isDarkMode} />
                        </div>
                      )}
                      {/* Contact card — shown when response contains contact details */}
                      {msg.contact_card && (
                        <ContactCard card={msg.contact_card} isDarkMode={isDarkMode} />
                      )}
                      {/* Copy button - appears on hover */}
                      <CopyButton content={msg.content} isDarkMode={isDarkMode} />
                      {msg.drawing && (
                      <div className={`mt-3 rounded-xl border overflow-hidden ${
                        isDarkMode 
                          ? 'border-gray-700 bg-gray-800/50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className={`px-3 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div className="flex items-center gap-2">
                            <FileText className={`h-4 w-4 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {msg.drawing.drawingType === 'room_sizes' ? 'Room Sizes' :
                               msg.drawing.drawingType === 'floor_plan' ? 'Floor Plan' :
                               msg.drawing.drawingType === 'elevation' ? 'Elevations' : 'Drawing'}
                            </span>
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              ({msg.drawing.houseTypeCode})
                            </span>
                          </div>
                          {msg.drawing.explanation && (
                            <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {msg.drawing.explanation}
                            </p>
                          )}
                        </div>
                        <div className="flex">
                          <a
                            href={msg.drawing.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition border-r ${
                              isDarkMode
                                ? 'border-gray-700 text-gold-400 hover:bg-gray-700/50'
                                : 'border-gray-200 text-gold-700 hover:bg-gray-100'
                            }`}
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </a>
                          <a
                            href={msg.drawing.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition ${
                              isDarkMode
                                ? 'text-gold-400 hover:bg-gray-700/50'
                                : 'text-gold-700 hover:bg-gray-100'
                            }`}
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2">
                        {msg.attachments.map((attachment, attachIdx) => (
                          <div 
                            key={attachment.id || attachIdx}
                            className={`rounded-xl border overflow-hidden ${
                              isDarkMode 
                                ? 'border-gray-700 bg-gray-800/50' 
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className={`px-3 py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              <div className="flex items-center gap-2">
                                <FileText className={`h-4 w-4 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
                                <span className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {attachment.title.includes('Ground') ? 'Ground Floor Plan' :
                                   attachment.title.includes('First') ? 'First Floor Plan' :
                                   attachment.title.includes('Second') ? 'Second Floor Plan' :
                                   'Floor Plan'}
                                </span>
                              </div>
                            </div>
                            <div className="flex">
                              <a
                                href={attachment.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition border-r ${
                                  isDarkMode
                                    ? 'border-gray-700 text-gold-400 hover:bg-gray-700/50'
                                    : 'border-gray-200 text-gold-700 hover:bg-gray-100'
                                }`}
                              >
                                <Eye className="h-4 w-4" />
                                Preview
                              </a>
                              <a
                                href={attachment.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition ${
                                  isDarkMode
                                    ? 'text-gold-400 hover:bg-gray-700/50'
                                    : 'text-gold-700 hover:bg-gray-100'
                                }`}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {msg.floorPlanUrl && !msg.drawing && (
                      <a
                        href={msg.floorPlanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          isDarkMode
                            ? 'bg-gold-600/20 text-gold-400 hover:bg-gold-600/30'
                            : 'bg-gold-100 text-gold-700 hover:bg-gold-200'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Floor Plan (PDF)
                      </a>
                    )}
                    
                    {msg.clarification && msg.clarification.options && (
                      <div className="mt-3 flex flex-col gap-2">
                        {msg.clarification.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              const followUp = option.id === 'internal' 
                                ? 'Show me the internal floor plans please'
                                : 'Show me the external elevations please';
                              sendMessage(followUp);
                            }}
                            className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all ${
                              isDarkMode
                                ? 'border-gray-700 bg-gray-800/70 hover:border-gold-500 hover:bg-gray-800'
                                : 'border-gray-200 bg-white hover:border-gold-400 hover:bg-gold-50'
                            }`}
                          >
                            <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {option.label}
                            </span>
                            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {option.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Sources dropdown for transparency */}
                    {msg.sources && msg.sources.length > 0 && (
                      <SourcesDropdown sources={msg.sources} isDarkMode={isDarkMode} />
                    )}
                    
                    {/* Request info button when AI doesn't have the answer */}
                    {msg.isNoInfo && messages.find(m => m.role === 'user') && (
                      <RequestInfoButton
                        question={messages.filter(m => m.role === 'user').slice(-1)[0]?.content || ''}
                        unitId={unitUid}
                        isDarkMode={isDarkMode}
                        onSubmitted={() => {}}
                      />
                    )}
                    {/* Static map for amenity responses */}
                    {msg.map_url && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" id={`map-${msg.map_url.slice(-8)}`}>
                        <img
                          src={msg.map_url}
                          alt="Nearby places map"
                          className="w-full h-auto"
                          loading="lazy"
                          onError={(e) => {
                            const container = (e.target as HTMLImageElement).closest('[id^="map-"]') as HTMLElement;
                            if (container) container.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    </div>
                  </div>
                );
              })}
              {sending && <TypingIndicator isDarkMode={isDarkMode} />}
              {/* Scroll anchor - 1px element for reliable scrollIntoView targeting */}
              <div ref={messagesEndRef} style={{ height: '1px', width: '100%' }} aria-hidden="true" />
            </div>
          </div>
      )}

      {/* INPUT BAR - Fixed above bottom nav, glass feel */}
      <div 
        ref={inputBarRef}
        className={`fixed left-0 right-0 z-[60] px-4 pt-3 pb-2 ${
          isDarkMode 
            ? 'bg-black/95 backdrop-blur-xl border-t border-white/5' 
            : 'bg-white/95 backdrop-blur-xl border-t border-black/5'
        }`}
        style={{ 
          bottom: isIOSNative 
            ? (isKeyboardOpen ? 0 : iosTabBarHeight) 
            : 'calc(env(safe-area-inset-bottom, 0px) + var(--mobile-tab-bar-h, 80px))',
          transform: 'translateY(calc(-1 * var(--vv-offset, 0px)))'
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {/* Home button - only show when in chat mode */}
          {messages.length > 0 && (
            <button
              onClick={handleHomeClick}
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
                isDarkMode 
                  ? 'text-gray-400 hover:bg-white/10 hover:text-gray-200' 
                  : 'text-gray-500 hover:bg-black/5 hover:text-gray-700'
              }`}
              aria-label="Back to home"
            >
              <Home className="h-5 w-5" />
            </button>
          )}

          {/* Input pill container - iMessage inspired */}
          <div className={`flex flex-1 items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-200 ${
            isDarkMode
              ? 'bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
              : 'bg-black/5 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.02),0_1px_3px_0_rgba(0,0,0,0.05)]'
          }`}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={t.placeholder}
              disabled={sending}
              className={`flex-1 border-none bg-transparent text-[15px] placeholder:text-gray-400 focus:outline-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            />
            
            {speechSupported && (
              <button
                onClick={toggleVoiceInput}
                disabled={sending}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
                  isListening 
                    ? 'bg-gold-500 text-white shadow-lg shadow-gold-500/30' 
                    : isDarkMode 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
                } disabled:opacity-50`}
                aria-label="Voice input"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}

            {input.trim() && (
              <button
                onClick={() => sendMessage()}
                disabled={sending}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white shadow-lg shadow-gold-500/25 transition-all duration-150 hover:shadow-gold-500/40 active:scale-95 disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <p className={`mt-2 text-center text-[10px] leading-tight ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
          {t.powered} •{' '}
          <a
            href="https://openhouseai.ie/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className={`underline hover:no-underline ${isDarkMode ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-600'}`}
          >
            {t.privacyLink || 'Privacy Policy'}
          </a>
        </p>
      </div>
    </div>
  );
}
