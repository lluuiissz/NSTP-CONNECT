import 'package:flutter/material.dart';
import '../main.dart'; // supabase instance
import 'package:intl/intl.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  bool _isLoading = true;
  List<dynamic> _notifications = [];
  String? _userMunicipality;

  @override
  void initState() {
    super.initState();
    _fetchInbox();
  }

  Future<void> _fetchInbox() async {
    try {
      final user = supabase.auth.currentUser;
      if (user != null) {
        // Get user's municipality first
        final userData = await supabase
            .from('users')
            .select('municipality')
            .eq('id', user.id)
            .single();

        _userMunicipality = userData['municipality'];

        // Fetch notifications: target_municipality is null OR matches user's municipality (case-insensitive)
        // Wrap string in double quotes for PostgREST to properly parse names with spaces (e.g. "Bayugan City")
        final String orFilter;
        if (_userMunicipality != null && _userMunicipality!.trim().isNotEmpty) {
          final cleanMun = _userMunicipality!.trim();
          orFilter = 'target_municipality.is.null,target_municipality.ilike."$cleanMun"';
        } else {
          orFilter = 'target_municipality.is.null';
        }

        final notifData = await supabase
            .from('notifications')
            .select()
            .or(orFilter)
            .order('created_at', ascending: false);

        if (mounted) {
          setState(() {
            _notifications = notifData;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      print("Inbox fetch error: $e");
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Inbox & Alerts', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() => _isLoading = true);
              _fetchInbox();
            },
          )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.inbox, size: 80, color: Colors.grey),
                      SizedBox(height: 16),
                      Text('No messages yet.', 
                        style: TextStyle(fontSize: 18, color: Colors.grey, fontWeight: FontWeight.bold)),
                      SizedBox(height: 8),
                      Text('Emergency broadcasts will appear here.', 
                        style: TextStyle(color: Colors.grey)),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _notifications.length,
                  itemBuilder: (context, index) {
                    final notif = _notifications[index];
                    final dateStr = notif['created_at'] != null 
                        ? DateFormat('MMM d, yyyy • h:mm a').format(DateTime.parse(notif['created_at']).toLocal())
                        : 'Unknown Date';
                    
                    final isGlobal = notif['target_municipality'] == null;

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: Colors.grey.shade200)
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.campaign, 
                                  color: isGlobal ? Colors.purple : Colors.red,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  isGlobal ? 'Global Broadcast' : 'LGU Alert',
                                  style: TextStyle(
                                    color: isGlobal ? Colors.purple : Colors.red,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  dateStr,
                                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              notif['title'] ?? 'Alert',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              notif['message'] ?? '',
                              style: const TextStyle(color: Colors.black87, height: 1.4),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
