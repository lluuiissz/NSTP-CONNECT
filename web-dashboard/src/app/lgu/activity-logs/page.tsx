'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ClipboardList, Calendar, MapPin, Trash2, Users } from 'lucide-react';

export default function ActivityLogsPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      // Fetch activities and also get the count of volunteers (from volunteer_logs)
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          volunteer_logs (id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this activity? This will also delete all associated volunteer logs.')) return;
    
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      setActivities(activities.filter(a => a.id !== id));
    } catch (err) {
      console.error("Error deleting activity:", err);
      alert('Failed to delete activity.');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <ClipboardList className="w-8 h-8 mr-3 text-blue-600" />
          Activity Logs
        </h1>
        <p className="text-gray-500 mt-2">Manage created activities and monitor overall volunteer participation.</p>
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
                        {activity.volunteer_logs?.length || 0}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(activity.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Activity"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
