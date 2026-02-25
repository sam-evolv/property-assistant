'use client';

export default function TypingIndicator({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[#D4AF37]"
          style={{
            animation: `devapp-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes devapp-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
