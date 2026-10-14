import 'package:flutter/material.dart';
import '../main.dart'; // supabase instance
import 'package:intl/intl.dart';

class MyLogScreen extends StatefulWidget {
  const MyLogScreen({super.key});

  @override
  State<MyLogScreen> createState() => _MyLogScreenState();
}

class _MyLogScreenState extends State<MyLogScreen> {
  bool _isLoading = true;
  List<dynamic> _logs = [];
  double _totalHours = 0.0;

  @override
  void initState() {
    super.initState();
    _fetchLogs();
  }

  Future<void> _fetchLogs() async {
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) return;

    try {
      final data = await supabase
          .from('volunteer_logs')
          .select('*, activities(title, event_date)')
          .eq('user_id', userId)
          .order('created_at', ascending: false);
          
      double hours = 0;
      for (var log in data) {
        if (log['status'] == 'active' && log['created_at'] != null) {
          // Active sessions have no final service_hours yet — count elapsed time
          final start = DateTime.parse(log['created_at']).toLocal();
          final elapsed = DateTime.now().difference(start).inSeconds;
          hours += elapsed > 0 ? elapsed / 3600.0 : 0.0;
        } else if (log['service_hours'] != null) {
          hours += (log['service_hours'] as num).toDouble();
        }
      }

      if (mounted) {
        setState(() {
          _logs = data;
          _totalHours = hours;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('My Logbook', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Top Summary Card
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF2563EB), Color(0xFF4F46E5)]),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(color: Colors.blue.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 5)),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.timer, color: Colors.white, size: 48),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Total Service Hours', style: TextStyle(color: Colors.white70, fontSize: 16)),
                            Text(
                              '${_totalHours.toStringAsFixed(1)} hrs',
                              style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Past Activities', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87)),
                  ),
                ),

                // Logs List
                Expanded(
                  child: _logs.isEmpty
                      ? const Center(child: Text('No volunteer logs found.', style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _logs.length,
                          itemBuilder: (context, index) {
                            final log = _logs[index];
                            final act = log['activities'];
                            
                            final dateStr = act != null && act['event_date'] != null
                                ? DateFormat('MMM d, yyyy').format(DateTime.parse(act['event_date']).toLocal())
                                : 'Unknown Date';
                                
                            final status = log['status'] as String;
                            final isCompleted = status == 'completed';

                            return Card(
                              elevation: 0,
                              color: Colors.grey.shade50,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.grey.shade200)),
                              margin: const EdgeInsets.only(bottom: 12),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                                leading: CircleAvatar(
                                  backgroundColor: isCompleted ? Colors.green.shade100 : Colors.blue.shade100,
                                  child: Icon(
                                    isCompleted ? Icons.check : Icons.directions_run,
                                    color: isCompleted ? Colors.green.shade700 : Colors.blue.shade700,
                                  ),
                                ),
                                title: Text(act != null ? act['title'] : 'Unknown Activity', style: const TextStyle(fontWeight: FontWeight.bold)),
                                subtitle: Text(dateStr),
                                trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      isCompleted ? '${log['service_hours'] ?? 0} hrs' : 'Active',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                        color: isCompleted ? Colors.black87 : Colors.blue.shade700
                                      ),
                                    ),
                                    Text(
                                      status.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: isCompleted ? Colors.green : Colors.blue
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}
