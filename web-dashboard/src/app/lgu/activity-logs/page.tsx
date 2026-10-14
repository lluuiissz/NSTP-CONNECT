'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardList, Calendar, MapPin, Trash2, Users, Download, FileText, Edit2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import EditActivityModal, { ActivityItem } from '@/components/Dashboard/EditActivityModal';

export default function ActivityLogsPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageFrom, setPageFrom] = useState(0);
  const [editingActivity, setEditingActivity] = useState<ActivityItem | null>(null);

  const PAGE_SIZE = 100;

  const fetchActivities = async (from = 0) => {
    try {
      // Fetch activities (paged) with volunteer_logs for unique-volunteer counts
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          volunteer_logs (user_id)
        `)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      const rows = data || [];
      setHasMore(rows.length === PAGE_SIZE);
      setPageFrom(from + rows.length);
      setActivities((prev) => (from === 0 ? rows : [...prev, ...rows]));
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = async () => {
    setIsLoadingMore(true);
    await fetchActivities(pageFrom);
  };

  // Fetch after first paint (deferred, so no synchronous setState inside the effect body)
  useEffect(() => {
    const t = setTimeout(fetchActivities, 0);
    return () => clearTimeout(t);
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this activity? This will also delete all associated volunteer logs.')) return;
    
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      setActivities(activities.filter(a => a.id !== id));
      // Note: counts/hasMore stay as-is; next full visit refreshes them.
    } catch (err) {
      console.error("Error deleting activity:", err);
      alert('Failed to delete activity.');
    }
  };

  // Count each volunteer ONCE across all activities (per-activity counts remain per activity)
  const totalUniqueVolunteers = new Set(
    activities.flatMap(a => (a.volunteer_logs || []).map((l: { user_id: string }) => l.user_id))
  ).size;

  const exportToCSV = () => {
    const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const totalActivities = activities.length;
    const totalVols = totalUniqueVolunteers;

    const csvContent = [
      `"NSTP-CONNECT OFFICIAL REPORT"`,
      `"Report Type:","Activity Participation Logs"`,
      `"Generated Date:","${reportDate}"`,
      `"Total Activities:","${totalActivities}"`,
      `"Total Unique Volunteers:","${totalVols}"`,
      `""`,
      `"===================================================================================================="`,
      `"ACTIVITY TITLE","MUNICIPALITY","BARANGAY","EVENT DATE","TOTAL VOLUNTEERS","DESCRIPTION"`,
      ...activities.map(a => [
        `"${a.title.replace(/"/g, '""').toUpperCase()}"`,
        `"${a.municipality}"`,
        `"${a.barangay}"`,
        `"${new Date(a.event_date).toLocaleDateString()}"`,
        `"${new Set((a.volunteer_logs || []).map((l: { user_id: string }) => l.user_id)).size}"`,
        `"${(a.description || '').replace(/"/g, '""')}"`
      ].join(','))
    ];
    
    const csvString = csvContent.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NSTP_Activity_Report_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(37, 99, 235); // Blue 600
    doc.text("NSTP-CONNECT", 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("Official Activity Participation Report", 14, 30);
    
    // Metadata
    doc.setFontSize(10);
    doc.text(`Generated Date: ${reportDate}`, 14, 40);
    doc.text(`Total Activities: ${activities.length}`, 14, 46);
    doc.text(`Total Unique Volunteers: ${totalUniqueVolunteers}`, 14, 52);

    // Table
    const tableColumn = ["Activity Title", "Location", "Event Date", "Volunteers"];
    const tableRows = activities.map(a => [
      a.title,
      `${a.barangay}, ${a.municipality}`,
      new Date(a.event_date).toLocaleDateString(),
      new Set((a.volunteer_logs || []).map((l: { user_id: string }) => l.user_id)).size.toString()
    ]);

    autoTable(doc, {
      startY: 60,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
    });

    doc.save(`NSTP_Activity_Report_${new Date().getTime()}.pdf`);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ClipboardList className="w-8 h-8 mr-3 text-blue-600" />
            Activity Logs
          </h1>
          <p className="text-gray-500 mt-2">Manage created activities and monitor overall volunteer participation.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={isLoading || activities.length === 0}
            className="flex items-center px-4 py-2 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV Data
          </button>
          <button
            onClick={exportToPDF}
            disabled={isLoading || activities.length === 0}
            className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5 mr-2" />
            Generate PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 font-semibold text-gray-600">Activity Title</th>
                <th className="p-4 font-semibold text-gray-600">Location</th>
                <th className="p-4 font-semibold text-gray-600">Date</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Volunteers</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">Loading activities...</td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No activities created yet.</td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{activity.title}</div>
                      <div className="text-sm text-gray-500 line-clamp-1">{activity.description}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center text-sm text-gray-700">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                        {activity.barangay}, {activity.municipality}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center text-sm text-gray-700">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {new Date(activity.event_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                        <Users className="w-4 h-4 mr-1" />
                        {new Set(activity.volunteer_logs?.map((l: { user_id: string }) => l.user_id)).size}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingActivity(activity)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Activity"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(activity.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Activity"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 bg-white text-blue-600 font-semibold rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading more...' : `Load more activities (showing ${activities.length})`}
          </button>
        </div>
      )}

      {editingActivity && (
        <EditActivityModal
          activity={editingActivity}
          onClose={() => setEditingActivity(null)}
          onSave={(updated) => {
            setActivities(activities.map(a => a.id === updated.id ? { ...a, ...updated } : a))
            setEditingActivity(null)
          }}
        />
      )}
    </div>
  );
}


