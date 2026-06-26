'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, Search, Award, Clock, Download, FileText, Ban, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function NstpRecordsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchVerifiedStudents();
  }, []);

  const fetchVerifiedStudents = async () => {
    try {
      // Fetch verified users and their volunteer logs to aggregate service hours
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          volunteer_logs (service_hours, status)
        `)
        .eq('is_verified', true)
        .neq('role', 'admin')
        .neq('role', 'nstp')
        .order('full_name', { ascending: true });

      if (error) throw error;

      // Calculate total service hours per student
      const processedData = (data || []).map(student => {
        const totalHours = (student.volunteer_logs || [])
          .filter((log: any) => log.status === 'completed' || log.status === 'active') // Summing up valid logs
          .reduce((sum: number, log: any) => sum + Number(log.service_hours || 0), 0);
        
        return { ...student, totalHours };
      });

      setStudents(processedData);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nstp_component?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateStatus = async (studentId: string, action: 'suspend' | 'delete') => {
    const confirmMessage = action === 'suspend' 
      ? 'Are you sure you want to suspend this volunteer? This will revoke their verified status and remove them from the Masterlist.'
      : 'Are you sure you want to completely delete this volunteer record? This action cannot be undone.';
      
    if (!confirm(confirmMessage)) return;

    setActionLoading(studentId);
    try {
      if (action === 'suspend') {
        const { error } = await supabase
          .from('users')
          .update({ is_verified: false })
          .eq('id', studentId);
        if (error) throw error;
      } else if (action === 'delete') {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', studentId);
        if (error) throw error;
      }
      
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (err) {
      console.error("Error updating status:", err);
      alert('Failed to update volunteer status.');
    } finally {
      setActionLoading(null);
    }
  };

  const exportToCSV = () => {
    const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const totalStudents = filteredStudents.length;

    const csvContent = [
      `"NSTP-CONNECT OFFICIAL REPORT"`,
      `"Report Type:","Verified Student Masterlist"`,
      `"Generated Date:","${reportDate}"`,
      `"Total Records:","${totalStudents}"`,
      `""`,
      `"===================================================================================================="`,
      `"STUDENT NAME","EMAIL","MUNICIPALITY","BARANGAY","NSTP COMPONENT","TOTAL SERVICE HOURS"`,
      ...filteredStudents.map(s => [
        `"${(s.full_name || '').replace(/"/g, '""').toUpperCase()}"`,
        `"${s.email}"`,
        `"${s.municipality || 'N/A'}"`,
        `"${s.barangay || 'N/A'}"`,
        `"${s.nstp_component || 'N/A'}"`,
        `"${s.totalHours.toFixed(1)}"`
      ].join(','))
    ];
    
    const csvString = csvContent.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NSTP_Masterlist_Report_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo 600
    doc.text("NSTP-CONNECT", 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text("Official Student Masterlist Report", 14, 30);
    
    // Metadata
    doc.setFontSize(10);
    doc.text(`Generated Date: ${reportDate}`, 14, 40);
    doc.text(`Total Records: ${filteredStudents.length}`, 14, 46);

    // Table
    const tableColumn = ["Student Name", "Location", "Component", "Hours"];
    const tableRows = filteredStudents.map(s => [
      s.full_name,
      `${s.barangay || 'N/A'}, ${s.municipality || 'N/A'}`,
      s.nstp_component || 'N/A',
      `${s.totalHours.toFixed(1)} hrs`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 },
    });

    doc.save(`NSTP_Masterlist_Report_${new Date().getTime()}.pdf`);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Database className="w-8 h-8 mr-3 text-indigo-600" />
            Verified Masterlist
          </h1>
          <p className="text-gray-500 mt-2">Manage verified NSTP graduates and monitor their accumulated service hours.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-auto">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px]"
            />
          </div>
          <button
            onClick={exportToCSV}
            disabled={isLoading || filteredStudents.length === 0}
            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV Data
          </button>
          <button
            onClick={exportToPDF}
            disabled={isLoading || filteredStudents.length === 0}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <th className="p-4 font-semibold text-gray-600">Student Name</th>
                <th className="p-4 font-semibold text-gray-600">Location</th>
                <th className="p-4 font-semibold text-gray-600">Component</th>
                <th className="p-4 font-semibold text-gray-600 text-center">Total Service Hours</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">Loading records...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No records found.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{student.full_name}</div>
                      <div className="text-sm text-gray-500">{student.email}</div>
                    </td>
                    <td className="p-4 text-sm text-gray-700">
                      {student.barangay}, {student.municipality}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {student.nstp_component || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center justify-center space-x-1">
                        {student.totalHours >= 40 ? (
                          <Award className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-indigo-400" />
                        )}
                        <span className={`font-bold ${student.totalHours >= 40 ? 'text-yellow-600' : 'text-indigo-600'}`}>
                          {student.totalHours.toFixed(1)} hrs
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdateStatus(student.id, 'suspend')}
                          disabled={actionLoading !== null}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Suspend/Revoke Verification"
                        >
                          <Ban className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(student.id, 'delete')}
                          disabled={actionLoading !== null}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete Record"
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
    </div>
  );
}
