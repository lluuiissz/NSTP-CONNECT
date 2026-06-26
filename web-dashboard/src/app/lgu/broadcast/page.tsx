'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Megaphone, Send, AlertTriangle } from 'lucide-react';

export default function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetMunicipality, setTargetMunicipality] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentBroadcasts();
  }, []);

  const fetchRecentBroadcasts = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setRecentBroadcasts(data || []);
    } catch (err) {
      console.error('Failed to fetch recent broadcasts', err);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast? It will be removed from volunteers\' inboxes.')) return;
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      setRecentBroadcasts((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

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

      // Trigger Push Notifications
      let query = supabase.from('users').select('fcm_token').not('fcm_token', 'is', null);
      if (targetMunicipality.trim() !== '') {
        query = query.eq('municipality', targetMunicipality.trim());
      }
      
      const { data: users } = await query;
      if (users && users.length > 0) {
        for (const user of users) {
          if (user.fcm_token) {
            const res = await fetch('/api/send-push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: user.fcm_token,
                title: title,
                body: message,
                data: { type: 'broadcast' }
              })
            });
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(`Push Error: ${errData.error} - ${errData.details || ''}`);
            }
          }
        }
      }

      setStatusMsg({ text: 'Broadcast sent successfully! Volunteers have been notified.', type: 'success' });
      setTitle('');
      setMessage('');
      setTargetMunicipality('');
      fetchRecentBroadcasts();
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
              className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
              placeholder="e.g. Typhoon Update, Mustering Order..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all min-h-[120px]"
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
              className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
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

      <div className="mt-12 mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Recent Broadcasts</h2>
        <p className="text-gray-500 mt-1">Manage and remove previously sent notifications from the database.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoadingRecent ? (
          <div className="p-8 text-center text-gray-500">Loading recent broadcasts...</div>
        ) : recentBroadcasts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No broadcasts have been sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm">
                  <th className="p-4 font-medium">Title</th>
                  <th className="p-4 font-medium">Message</th>
                  <th className="p-4 font-medium">Target</th>
                  <th className="p-4 font-medium">Date Sent</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBroadcasts.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{b.title}</td>
                    <td className="p-4 text-gray-600 max-w-xs truncate">{b.message}</td>
                    <td className="p-4 text-gray-500">
                      {b.target_municipality ? (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{b.target_municipality}</span>
                      ) : (
                        <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Global (All)</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 text-sm">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={isDeleting === b.id}
                        className="text-red-500 hover:text-red-700 font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        {isDeleting === b.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
