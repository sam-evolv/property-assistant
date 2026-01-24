'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

export function ChatSheet() {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle send message
    if (message.trim()) {
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Ask a Question</h2>

      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-sm text-gray-600">How can I help you with your new home today?</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your question..."
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
        />
        <button
          type="submit"
          className="w-12 h-12 rounded-xl bg-[#D4AF37] flex items-center justify-center active:scale-95 transition-transform"
        >
          <Send className="w-5 h-5 text-black" />
        </button>
      </form>
    </div>
  );
}
