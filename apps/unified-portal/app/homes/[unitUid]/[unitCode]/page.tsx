'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface HouseContext {
  unit_id: string;
  development_id: string;
  development_code: string;
  development_name: string;
  development_system_instructions: string;
  purchaser_name: string;
  house_type: string;
  bedrooms: number;
  address: string;
  mrpn: string;
  electricity_account: string;
  esb_eirgrid_number: string;
}

export default function HousePage() {
  const params = useParams();
  const { developmentCode, unitCode } = params as { developmentCode: string; unitCode: string };
  
  const [house, setHouse] = useState<HouseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchHouse = async () => {
      try {
        const res = await fetch(`/api/houses/resolve?code=${unitCode}`);
        const data = await res.json();
        
        if (data.unit_id || data.house_id) {
          const mappedData = {
            ...data,
            unit_id: data.unit_id || data.house_id,
          };
          setHouse(mappedData);
          setMessages([
            {
              role: 'assistant',
              content: `Good evening ${data.purchaser_name || 'there'}, welcome to ${data.development_name}. How can I help with your home at ${data.address}?`,
            },
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch house:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHouse();
  }, [unitCode]);

  const sendMessage = async () => {
    if (!input.trim() || !house) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houseId: house.unit_id,
          developmentId: house.development_id,
          messages: [...messages, userMessage],
        }),
      });
      
      const data = await res.json();
      
      if (data.answer) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading your home...</div>
      </div>
    );
  }

  if (!house) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">House not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white shadow-sm p-4 border-b">
        <h1 className="text-2xl font-bold text-gold">
          {house.development_name}
        </h1>
        <p className="text-sm text-gray-600">
          {house.address} • {house.house_type} • {house.bedrooms} bed
        </p>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-gold text-white'
                  : 'bg-white shadow'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white shadow rounded-lg p-4">
              Thinking...
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-white border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask about your home..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="px-6 py-2 bg-gold text-white rounded-lg hover:bg-gold-dark disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
