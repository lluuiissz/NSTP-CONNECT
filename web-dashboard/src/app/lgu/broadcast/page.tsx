'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone, Send, AlertTriangle } from 'lucide-react';

export default function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetMunicipality, setTargetMunicipality] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const { error } = await supabase.from('notifications').insert([
        {
          title,
          message,
          target_municipality: targetMunicipality.trim() === '' ? null : targetMunicipality.trim(),
        },
      ]);

      if (error) throw error;

      setStatusMsg({ text: 'Broadcast sent successfully! Volunteers have been notified.', type: 'success' });
      setTitle('');
      setMessage('');
      setTargetMunicipality('');
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ text: `Failed to send broadcast: ${err.message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Megaphone className="w-8 h-8 mr-3 text-red-600" />
          Emergency Broadcasts
        </h1>
        <p className="text-gray-500 mt-2">Send instant push notifications to all volunteers' mobile devices.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-2xl">
        <div className="bg-red-50 p-4 border-b border-red-100 flex items-start">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
          <p className="text-sm text-red-800">
            <strong>Warning:</strong> These messages trigger instant push notifications on volunteers' phones. Use this panel strictly for emergencies, mustering, or critical announcements.
          </p>
        </div>

        <form onSubmit={handleBroadcast} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alert Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              placeholder="e.g. Typhoon Update, Mustering Order..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all min-h-[120px]"
              placeholder="Provide clear instructions for the volunteers..."
              required
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Municipality (Optional)</label>
            <input
              type="text"
              value={targetMunicipality}
              onChange={(e) => setTargetMunicipality(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              placeholder="Leave blank to broadcast to everyone in Agusan del Sur"
            />
          </div>

          {statusMsg.text && (
            <div className={`p-4 rounded-xl text-sm font-medium ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {statusMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Broadcasting...' : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Broadcast Alert Now
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
