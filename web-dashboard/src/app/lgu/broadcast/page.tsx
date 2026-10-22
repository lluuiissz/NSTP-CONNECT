'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { AGUSAN_DEL_SUR_LOCATIONS, AGUSAN_DEL_SUR_COORDINATES } from '@/lib/locations';
import { 
  Megaphone, 
  Send, 
  AlertTriangle, 
  Users, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  Download, 
  X, 
  Shield, 
  HeartHandshake, 
  BookOpen, 
  Calendar,
  Compass,
  Crosshair
} from 'lucide-react';

const LocationPickerMap = dynamic(
  () => import('@/components/Map/LocationPickerMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center text-slate-400 text-sm font-medium">
        Loading Interactive Incident Map...
      </div>
    ),
  }
);

interface RawUser {
  full_name: string | null;
  mobile_number: string | null;
  nstp_component: string | null;
  municipality: string | null;
  barangay: string | null;
}

interface BroadcastAttendance {
  id: string;
  broadcast_id: string;
  user_id: string;
  nstp_component: string;
  lat: number | null;
  lng: number | null;
  municipality: string | null;
  barangay: string | null;
  created_at: string;
  users?: RawUser | RawUser[] | null;
}

interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  target_municipality: string | null;
  target_barangay?: string | null;
  assembly_point?: string | null;
  requires_attendance?: boolean;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  attendances?: BroadcastAttendance[];
  stats?: {
    total: number;
    cwts: number;
    rotc: number;
    lts: number;
    cwtsPct: string;
    rotcPct: string;
    ltsPct: string;
  };
}

export default function BroadcastPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetMunicipality, setTargetMunicipality] = useState('');
  const [targetBarangay, setTargetBarangay] = useState('');
  const [assemblyPoint, setAssemblyPoint] = useState('');
  const [requiresAttendance, setRequiresAttendance] = useState(true);
  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const [recentBroadcasts, setRecentBroadcasts] = useState<BroadcastItem[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [recipientStats, setRecipientStats] = useState<{ total: number; pushEnabled: number } | null>(null);

  const trimmedTarget = targetMunicipality.trim();
  const activeMapCenter: [number, number] = targetMunicipality && AGUSAN_DEL_SUR_COORDINATES[targetMunicipality]
    ? [AGUSAN_DEL_SUR_COORDINATES[targetMunicipality].lat, AGUSAN_DEL_SUR_COORDINATES[targetMunicipality].lng]
    : [8.5065, 125.7562];

  // Modal for Viewing Attendee Roster
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'ROTC' | 'CWTS' | 'LTS'>('ALL');
  const [searchRoster, setSearchRoster] = useState('');

  const selectedBroadcast = recentBroadcasts.find((b) => b.id === selectedBroadcastId) || null;

  // Calculate statistics for a broadcast
  const computeStats = (attendances: BroadcastAttendance[]) => {
    const total = attendances.length;
    let cwts = 0;
    let rotc = 0;
    let lts = 0;

    for (const a of attendances) {
      const comp = (a.nstp_component || '').trim().toUpperCase();
      if (comp === 'CWTS') cwts++;
      else if (comp === 'ROTC') rotc++;
      else if (comp === 'LTS') lts++;
    }

    return {
      total,
      cwts,
      rotc,
      lts,
      cwtsPct: total > 0 ? ((cwts / total) * 100).toFixed(1) : '0.0',
      rotcPct: total > 0 ? ((rotc / total) * 100).toFixed(1) : '0.0',
      ltsPct: total > 0 ? ((lts / total) * 100).toFixed(1) : '0.0',
    };
  };

  const fetchRecentBroadcasts = useCallback(async () => {
    try {
      const { data: broadcasts, error: bError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (bError) throw bError;

      if (!broadcasts || broadcasts.length === 0) {
        setRecentBroadcasts([]);
        setIsLoadingRecent(false);
        return;
      }

      const bIds = broadcasts.map((b) => b.id);

      // Fetch attendances for these broadcasts with volunteer profile details
      const { data: attendances, error: aError } = await supabase
        .from('broadcast_attendances')
        .select('*, users(full_name, mobile_number, nstp_component, municipality, barangay)')
        .in('broadcast_id', bIds)
        .order('created_at', { ascending: false });

      if (aError) {
        console.warn('Could not load attendances:', aError.message);
      }

      // Group attendances by broadcast_id
      const attMap: Record<string, BroadcastAttendance[]> = {};
      (attendances || []).forEach((att) => {
        if (!attMap[att.broadcast_id]) attMap[att.broadcast_id] = [];
        attMap[att.broadcast_id].push(att);
      });

      const enrichedBroadcasts: BroadcastItem[] = broadcasts.map((b) => {
        const bAtts = attMap[b.id] || [];
        return {
          ...b,
          attendances: bAtts,
          stats: computeStats(bAtts),
        };
      });

      setRecentBroadcasts(enrichedBroadcasts);
    } catch (err) {
      console.error('Failed to fetch recent broadcasts', err);
    } finally {
      setIsLoadingRecent(false);
    }
  }, []);

  // Real-time listener for live check-in updates and notifications
  useEffect(() => {
    fetchRecentBroadcasts();

    const channel = supabase
      .channel('broadcast_live_monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'broadcast_attendances' },
        () => {
          fetchRecentBroadcasts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchRecentBroadcasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecentBroadcasts]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast? It will be removed from volunteers\' inboxes and attendance records.')) return;
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      setRecentBroadcasts((prev) => prev.filter((b) => b.id !== id));
      if (selectedBroadcastId === id) setSelectedBroadcastId(null);
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const { data: newBroadcast, error } = await supabase
        .from('notifications')
        .insert([
          {
            title: title.trim(),
            message: message.trim(),
            target_municipality: targetMunicipality.trim() === '' ? null : targetMunicipality.trim(),
            target_barangay: targetBarangay.trim() === '' ? null : targetBarangay.trim(),
            assembly_point: assemblyPoint.trim() === '' ? null : assemblyPoint.trim(),
            requires_attendance: requiresAttendance,
            lat: pinLat,
            lng: pinLng,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Trigger Push Notifications to volunteers
      let query = supabase
        .from('users')
        .select('fcm_token')
        .neq('role', 'admin')
        .neq('role', 'nstp')
        .not('fcm_token', 'is', null);

      if (targetMunicipality.trim() !== '') {
        query = query.ilike('municipality', targetMunicipality.trim());
      }
      if (targetBarangay.trim() !== '') {
        query = query.ilike('barangay', targetBarangay.trim());
      }
      
      const { data: users } = await query;
      if (users && users.length > 0) {
        const uniqueTokens = Array.from(new Set(users.map((u) => u.fcm_token).filter(Boolean)));
        Promise.allSettled(
          uniqueTokens.map((token) =>
            fetch('/api/send-push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token,
                title: title,
                body: message,
                data: { 
                  type: 'broadcast',
                  broadcast_id: newBroadcast.id,
                  requires_attendance: requiresAttendance ? 'true' : 'false',
                  lat: pinLat ? pinLat.toString() : '',
                  lng: pinLng ? pinLng.toString() : '',
                }
              })
            })
          )
        ).catch((err) => console.warn('Push fanout error:', err));
      }

      setStatusMsg({ 
        text: requiresAttendance 
          ? 'Emergency Broadcast sent! Volunteers have been notified to muster and check in.'
          : 'Broadcast sent successfully! Volunteers have been notified.', 
        type: 'success' 
      });

      setTitle('');
      setMessage('');
      setTargetMunicipality('');
      setTargetBarangay('');
      setAssemblyPoint('');
      setPinLat(null);
      setPinLng(null);
      setShowMapPicker(false);
      fetchRecentBroadcasts();
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: `Failed to send broadcast: ${(err as Error).message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estimate volunteer recipients based on selected municipality & barangay
  useEffect(() => {
    let cancelled = false;
    const countRecipients = async () => {
      let query = supabase
        .from('users')
        .select('fcm_token', { count: 'exact' })
        .neq('role', 'admin')
        .neq('role', 'nstp');

      if (trimmedTarget !== '') {
        query = query.ilike('municipality', trimmedTarget);
      }
      if (targetBarangay.trim() !== '') {
        query = query.ilike('barangay', targetBarangay.trim());
      }

      const { data, count, error } = await query;
      if (!cancelled && !error) {
        const total = count ?? 0;
        const pushEnabled = (data || []).filter((u) => !!u.fcm_token).length;
        setRecipientStats({ total, pushEnabled });
      }
    };

    const t = setTimeout(countRecipients, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmedTarget, targetBarangay]);

  // Export Roster to CSV
  const handleExportCSV = (broadcast: BroadcastItem) => {
    const atts = broadcast.attendances || [];
    if (atts.length === 0) {
      alert('No attendance records to export yet.');
      return;
    }

    const headers = ['Full Name', 'NSTP Component', 'Mobile Number', 'Municipality', 'Barangay', 'Check-In Timestamp'];
    const rows = atts.map((a) => {
      const u = Array.isArray(a.users) ? a.users[0] : a.users;
      return [
        `"${(u?.full_name || 'Volunteer').replace(/"/g, '""')}"`,
        `"${(a.nstp_component || 'N/A').replace(/"/g, '""')}"`,
        `"${(u?.mobile_number || 'N/A').replace(/"/g, '""')}"`,
        `"${(a.municipality || u?.municipality || '').replace(/"/g, '""')}"`,
        `"${(a.barangay || u?.barangay || '').replace(/"/g, '""')}"`,
        `"${new Date(a.created_at).toLocaleString().replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `broadcast_${broadcast.id.slice(0, 8)}_attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center tracking-tight">
          <Megaphone className="w-8 h-8 mr-3 text-red-600" />
          Emergency Broadcasts & Volunteer Mustering
        </h1>
        <p className="text-gray-500 mt-2">
          Dispatch instant emergency alerts to volunteers and monitor real-time check-in attendance by NSTP component (ROTC, CWTS, LTS).
        </p>
      </div>

      {/* Broadcast Dispatch Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-3xl">
        <div className="bg-red-50 p-4 border-b border-red-100 flex items-start">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-3 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">
            <strong>Incident Command Mode:</strong> Dispatched alerts trigger instantaneous push notifications on all active volunteer devices in the selected area.
          </p>
        </div>

        <form onSubmit={handleBroadcast} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Alert Headline / Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium"
              placeholder="e.g. Mandatory Evacuation Support - Agusan River Overflow"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">Emergency Message & Directives *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all min-h-[110px]"
              placeholder="Provide clear assembly instructions, safety guidelines, and tasks..."
              required
            ></textarea>
          </div>

          {/* Location Targeting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Target Municipality</label>
              <select
                value={targetMunicipality}
                onChange={(e) => {
                  setTargetMunicipality(e.target.value);
                  setTargetBarangay(''); // Reset barangay selection
                }}
                className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm"
              >
                <option value="">All Municipalities (Province-Wide)</option>
                {Object.keys(AGUSAN_DEL_SUR_LOCATIONS).map((mun) => (
                  <option key={mun} value={mun}>{mun}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">Target Barangay (Optional)</label>
              <select
                value={targetBarangay}
                onChange={(e) => setTargetBarangay(e.target.value)}
                disabled={!targetMunicipality}
                className="w-full px-4 py-3 bg-white text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">All Barangays in {targetMunicipality || 'Municipality'}</option>
                {targetMunicipality && AGUSAN_DEL_SUR_LOCATIONS[targetMunicipality]?.map((brgy) => (
                  <option key={brgy} value={brgy}>{brgy}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mustering & Attendance Toggle */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-gray-900 flex items-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2" />
                  Request Volunteer On-Site Attendance & Mustering
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allows volunteers to check in using mobile GPS. The dashboard will automatically calculate CWTS, ROTC, and LTS percentages.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requiresAttendance}
                onChange={(e) => setRequiresAttendance(e.target.checked)}
                className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
              />
            </div>

            {requiresAttendance && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-red-500" />
                  Designated Assembly / Incident Place
                </label>
                <input
                  type="text"
                  value={assemblyPoint}
                  onChange={(e) => setAssemblyPoint(e.target.value)}
                  placeholder="e.g. Municipal Gymnasium / Poblacion Evacuation Center"
                  className="w-full px-3 py-2 bg-white text-gray-900 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            )}

            {/* Interactive Incident Location Pinning */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div>
                  <label className="text-xs font-bold text-gray-800 flex items-center">
                    <Crosshair className="w-4 h-4 mr-1.5 text-red-600" />
                    Pin Exact Incident / Evacuation Site on Map (Optional)
                  </label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Click anywhere on the map or drag the pin. The volunteer mobile app displays this pin with GPS routing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center shrink-0 self-start sm:self-auto"
                >
                  <Compass className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                  {showMapPicker ? 'Hide Map' : (pinLat != null ? 'Adjust Pin' : 'Drop Pin on Map')}
                </button>
              </div>

              {pinLat != null && pinLng != null && (
                <div className="flex items-center justify-between p-2.5 bg-red-50 border border-red-200 rounded-xl mb-3 text-xs text-red-900">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1.5 text-red-600 shrink-0" />
                    <span>
                      <strong>Pinned Coordinates:</strong> {pinLat.toFixed(5)}° N, {pinLng.toFixed(5)}° E
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPinLat(null);
                      setPinLng(null);
                    }}
                    className="text-red-700 hover:text-red-900 font-bold underline ml-2 cursor-pointer"
                  >
                    Clear Pin
                  </button>
                </div>
              )}

              {showMapPicker && (
                <div className="mt-2 space-y-2">
                  <LocationPickerMap
                    center={activeMapCenter}
                    zoom={targetMunicipality ? 13 : 11}
                    initialLat={pinLat}
                    initialLng={pinLng}
                    onLocationSelect={(lat, lng) => {
                      setPinLat(lat);
                      setPinLng(lng);
                    }}
                    onClear={() => {
                      setPinLat(null);
                      setPinLng(null);
                    }}
                    placeholderText="👇 Click anywhere on the map or drag the marker to pin the emergency site"
                  />
                  <p className="text-[11px] text-slate-500 italic">
                    Tip: The map auto-centers on {targetMunicipality || 'Agusan del Sur'}. Zoom in to pinpoint the exact building, road, or bridge.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500 flex items-center">
            <Users className="w-4 h-4 mr-1.5 text-slate-500" />
            {recipientStats === null
              ? 'Auditing volunteer audience...'
              : `Reaches ${recipientStats.total} registered volunteer${recipientStats.total === 1 ? '' : 's'}${trimmedTarget ? ` in ${trimmedTarget}` : ''}${targetBarangay ? ` (${targetBarangay})` : ''} (${recipientStats.pushEnabled} with active push notification token).`}
          </div>

          {statusMsg.text && (
            <div className={`p-4 rounded-xl text-sm font-medium ${statusMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {statusMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Broadcasting to Field Units...' : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Dispatch Emergency Alert Now
              </>
            )}
          </button>
        </form>
      </div>

      {/* Recent Broadcasts & Live Attendance Tracking */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Broadcast Monitoring & Attendance Statistics</h2>
            <p className="text-gray-500 text-sm mt-0.5">Real-time breakdown of volunteer response by ROTC, CWTS, and LTS components.</p>
          </div>
          <button
            onClick={() => fetchRecentBroadcasts()}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 self-start sm:self-auto px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200 transition-colors"
          >
            Refresh Attendance Stats
          </button>
        </div>

        {isLoadingRecent ? (
          <div className="bg-white p-12 text-center text-gray-500 rounded-2xl border border-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-3"></div>
            Loading broadcast records...
          </div>
        ) : recentBroadcasts.length === 0 ? (
          <div className="bg-white p-12 text-center text-gray-500 rounded-2xl border border-gray-100">
            No emergency broadcasts have been recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {recentBroadcasts.map((b) => {
              const stats = b.stats || { total: 0, cwts: 0, rotc: 0, lts: 0, cwtsPct: '0.0', rotcPct: '0.0', ltsPct: '0.0' };
              const hasAttendance = b.requires_attendance !== false;

              return (
                <div key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:border-gray-300">
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {b.target_municipality ? (
                          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {b.target_municipality} {b.target_barangay ? `• ${b.target_barangay}` : ''}
                          </span>
                        ) : (
                          <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            Province-Wide Alert
                          </span>
                        )}

                        {b.assembly_point && (
                          <span className="bg-amber-100 text-amber-900 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                            Assembly: {b.assembly_point}
                          </span>
                        )}

                        {b.lat != null && b.lng != null && (
                          <a
                            href={`https://www.google.com/maps?q=${b.lat},${b.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-red-100 hover:bg-red-200 text-red-900 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center transition-colors"
                            title="Open pinned location in Google Maps"
                          >
                            <Crosshair className="w-3 h-3 mr-1 text-red-600" />
                            Pinned: {b.lat.toFixed(4)}, {b.lng.toFixed(4)}
                          </a>
                        )}

                        <span className="text-gray-400 text-xs flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-gray-900">{b.title}</h3>
                      <p className="text-gray-600 mt-1 text-sm max-w-3xl">{b.message}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {hasAttendance && (
                        <button
                          onClick={() => {
                            setSelectedBroadcastId(b.id);
                            setRosterFilter('ALL');
                            setSearchRoster('');
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
                        >
                          <Users className="w-4 h-4 mr-2" />
                          View Attendee Roster ({stats.total})
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={isDeleting === b.id}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        title="Delete Broadcast"
                      >
                        {isDeleting === b.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>

                  {/* Attendance & Percentage Breakdown */}
                  {hasAttendance && (
                    <div className="p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="text-sm font-bold text-gray-900">
                            On-Site Verified Attendees:
                          </span>
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-sm font-extrabold rounded-full">
                            {stats.total} Volunteers
                          </span>
                        </div>

                        {stats.total > 0 && (
                          <button
                            onClick={() => handleExportCSV(b)}
                            className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 self-start sm:self-auto"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download CSV
                          </button>
                        )}
                      </div>

                      {/* Percentage Visual Segment Bar */}
                      <div className="w-full bg-gray-100 rounded-full h-3.5 flex overflow-hidden shadow-inner">
                        {stats.total === 0 ? (
                          <div className="w-full bg-gray-200 text-center text-[10px] text-gray-500 leading-3 font-semibold">
                            Awaiting volunteer check-ins...
                          </div>
                        ) : (
                          <>
                            {Number(stats.rotcPct) > 0 && (
                              <div
                                style={{ width: `${stats.rotcPct}%` }}
                                className="bg-blue-600 h-full transition-all duration-500"
                                title={`ROTC: ${stats.rotc} (${stats.rotcPct}%)`}
                              />
                            )}
                            {Number(stats.cwtsPct) > 0 && (
                              <div
                                style={{ width: `${stats.cwtsPct}%` }}
                                className="bg-emerald-600 h-full transition-all duration-500"
                                title={`CWTS: ${stats.cwts} (${stats.cwtsPct}%)`}
                              />
                            )}
                            {Number(stats.ltsPct) > 0 && (
                              <div
                                style={{ width: `${stats.ltsPct}%` }}
                                className="bg-amber-500 h-full transition-all duration-500"
                                title={`LTS: ${stats.lts} (${stats.ltsPct}%)`}
                              />
                            )}
                          </>
                        )}
                      </div>

                      {/* Component Statistics Badges */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {/* ROTC Card */}
                        <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-700" />
                            <span className="text-xs font-bold text-blue-900">ROTC Cadets</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-blue-950">{stats.rotc}</span>
                            <span className="text-xs font-bold text-blue-700 ml-1.5">({stats.rotcPct}%)</span>
                          </div>
                        </div>

                        {/* CWTS Card */}
                        <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                          <div className="flex items-center gap-2">
                            <HeartHandshake className="w-4 h-4 text-emerald-700" />
                            <span className="text-xs font-bold text-emerald-900">CWTS Volunteers</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-emerald-950">{stats.cwts}</span>
                            <span className="text-xs font-bold text-emerald-700 ml-1.5">({stats.cwtsPct}%)</span>
                          </div>
                        </div>

                        {/* LTS Card */}
                        <div className="flex items-center justify-between p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-700" />
                            <span className="text-xs font-bold text-amber-900">LTS Educators</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-amber-950">{stats.lts}</span>
                            <span className="text-xs font-bold text-amber-700 ml-1.5">({stats.ltsPct}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendee Roster Modal */}
      {selectedBroadcast && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Verified Attendance Roster
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Alert: <span className="font-semibold text-gray-800">{selectedBroadcast.title}</span> ({selectedBroadcast.target_municipality || 'Province-Wide'})
                </p>
              </div>
              <button
                onClick={() => setSelectedBroadcastId(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {(['ALL', 'ROTC', 'CWTS', 'LTS'] as const).map((filter) => {
                  const count = filter === 'ALL' 
                    ? selectedBroadcast.stats?.total ?? 0 
                    : filter === 'ROTC' 
                      ? selectedBroadcast.stats?.rotc ?? 0 
                      : filter === 'CWTS' 
                        ? selectedBroadcast.stats?.cwts ?? 0 
                        : selectedBroadcast.stats?.lts ?? 0;

                  const isSelected = rosterFilter === filter;
                  return (
                    <button
                      key={filter}
                      onClick={() => setRosterFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {filter} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={searchRoster}
                  onChange={(e) => setSearchRoster(e.target.value)}
                  placeholder="Search name or phone..."
                  className="px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48"
                />

                <button
                  onClick={() => handleExportCSV(selectedBroadcast)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>

            {/* Roster Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const atts = (selectedBroadcast.attendances || []).filter((a) => {
                  const u = Array.isArray(a.users) ? a.users[0] : a.users;
                  const nameMatch = (u?.full_name || '').toLowerCase().includes(searchRoster.toLowerCase());
                  const phoneMatch = (u?.mobile_number || '').includes(searchRoster);
                  const compMatch = rosterFilter === 'ALL' || (a.nstp_component || '').toUpperCase() === rosterFilter;
                  return compMatch && (nameMatch || phoneMatch);
                });

                if (atts.length === 0) {
                  return (
                    <div className="p-12 text-center text-gray-400 text-sm">
                      No volunteer attendance records matching this filter.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                          <th className="p-3">Volunteer Name</th>
                          <th className="p-3">Component</th>
                          <th className="p-3">Station / Origin</th>
                          <th className="p-3">Check-In Time</th>
                          <th className="p-3 text-right">Direct Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {atts.map((a) => {
                          const u = Array.isArray(a.users) ? a.users[0] : a.users;
                          const comp = (a.nstp_component || '').toUpperCase();
                          const compColor = comp === 'ROTC' 
                            ? 'bg-blue-100 text-blue-800' 
                            : comp === 'CWTS' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-900';

                          return (
                            <tr key={a.id} className="hover:bg-gray-50/70 transition-colors">
                              <td className="p-3 font-semibold text-gray-900">
                                {u?.full_name || 'Volunteer Reservist'}
                              </td>
                              <td className="p-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${compColor}`}>
                                  {comp || 'NSTP'}
                                </span>
                              </td>
                              <td className="p-3 text-gray-600 text-xs">
                                {a.barangay || u?.barangay ? `${a.barangay || u?.barangay}, ` : ''}
                                {a.municipality || u?.municipality || 'Agusan del Sur'}
                              </td>
                              <td className="p-3 text-gray-500 text-xs">
                                {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="p-3 text-right">
                                {u?.mobile_number ? (
                                  <a
                                    href={`tel:${u.mobile_number}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200 transition-colors"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    {u.mobile_number}
                                  </a>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">No phone recorded</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
              <span>GPS check-in verified by mobile device coordinates.</span>
              <button
                onClick={() => setSelectedBroadcastId(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
