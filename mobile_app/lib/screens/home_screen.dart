import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../main.dart'; // supabase instance
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/notification_service.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback? onOpenInbox;
  const HomeScreen({super.key, this.onOpenInbox});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  bool _isMapView = false;
  List<dynamic> _activities = [];
  Map<String, dynamic>? _activeEmergencyBroadcast;
  RealtimeChannel? _emergencyChannel;

  @override
  void initState() {
    super.initState();
    _syncPendingLogs();
    _fetchActivities();
    _fetchActiveEmergency();
    _setupEmergencyRealtime();
    
    // Ensure FCM token is uploaded for the logged-in user
    NotificationService().refreshAndUploadToken();
  }

  @override
  void dispose() {
    if (_emergencyChannel != null) {
      supabase.removeChannel(_emergencyChannel!);
    }
    super.dispose();
  }

  Future<void> _fetchActiveEmergency() async {
    try {
      final user = supabase.auth.currentUser;
      if (user == null) return;

      final userData = await supabase
          .from('users')
          .select('municipality')
          .eq('id', user.id)
          .maybeSingle();

      final mun = userData?['municipality'] as String?;
      final String orFilter;
      if (mun != null && mun.trim().isNotEmpty) {
        orFilter = 'target_municipality.is.null,target_municipality.ilike."${mun.trim()}"';
      } else {
        orFilter = 'target_municipality.is.null';
      }

      final notifs = await supabase
          .from('notifications')
          .select()
          .eq('requires_attendance', true)
          .or(orFilter)
          .order('created_at', ascending: false)
          .limit(1);

      if (notifs.isEmpty) {
        if (mounted) setState(() => _activeEmergencyBroadcast = null);
        return;
      }

      final latestNotif = notifs.first;
      final broadcastId = latestNotif['id'].toString();

      // Check if user has already attended
      final attended = await supabase
          .from('broadcast_attendances')
          .select('id')
          .eq('broadcast_id', broadcastId)
          .eq('user_id', user.id)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _activeEmergencyBroadcast = attended == null ? latestNotif : null;
        });
      }
    } catch (e) {
      debugPrint("Active emergency fetch error: $e");
    }
  }

  void _setupEmergencyRealtime() {
    _emergencyChannel = supabase.channel('home_emergency_feed')
      ..onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'notifications',
        callback: (_) => _fetchActiveEmergency(),
      )
      ..onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'broadcast_attendances',
        callback: (_) => _fetchActiveEmergency(),
      )
      ..subscribe();
  }

  Future<void> _syncPendingLogs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      const pendingKey = 'pending_sync_logs';
      List<String> pendingLogs = prefs.getStringList(pendingKey) ?? [];
      
      if (pendingLogs.isEmpty) return;

      List<String> failedSyncs = [];
      for (String logStr in pendingLogs) {
        try {
          final logData = jsonDecode(logStr);
          // Try to update Supabase
          await supabase
              .from('volunteer_logs')
              .update({
                'status': 'completed',
                'service_hours': logData['service_hours']
              })
              .eq('user_id', logData['user_id'])
              .eq('activity_id', logData['activity_id'])
              .eq('status', 'active');
        } catch (e) {
          // If a specific log fails to sync, keep it
          failedSyncs.add(logStr);
        }
      }
      
      // Save remaining failed syncs back to cache
      await prefs.setStringList(pendingKey, failedSyncs);
      
      if (failedSyncs.length < pendingLogs.length && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offline sessions synced successfully!'), backgroundColor: Colors.green)
        );
      }
    } catch (e) {
      debugPrint("Sync error: $e");
    }
  }

  Future<void> _fetchActivities() async {
    try {
      final data = await supabase
          .from('activities')
          .select()
          .order('event_date', ascending: true);
          
      if (mounted) {
        setState(() {
          _activities = data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        // Error handling fallback
      }
    }
  }

  Widget _buildEmergencyBanner() {
    final notif = _activeEmergencyBroadcast!;
    final assemblyPoint = notif['assembly_point'];
    final targetBarangay = notif['target_barangay'];

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF991B1B), Color(0xFFDC2626)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.red.withOpacity(0.35),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.red.shade300, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.warning_amber_rounded,
                  color: Color(0xFFDC2626),
                  size: 20,
                ),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'EMERGENCY MUSTERING ALERT',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 12,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.25),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'ACTION REQUIRED',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 9,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            notif['title'] ?? 'Emergency Alert',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            '📍 Assembly: ${assemblyPoint ?? targetBarangay ?? 'Check Area Details'}',
            style: TextStyle(
              color: Colors.white.withOpacity(0.95),
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                widget.onOpenInbox?.call();
              },
              icon: const Icon(Icons.map, size: 16),
              label: const Text(
                'View Map & Respond',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF991B1B),
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Discover Activities', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(_isMapView ? Icons.list : Icons.map),
            onPressed: () {
              setState(() {
                _isMapView = !_isMapView;
              });
            },
            tooltip: _isMapView ? 'List View' : 'Map View',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              setState(() => _isLoading = true);
              _fetchActivities();
              _fetchActiveEmergency();
            },
          )
        ],
      ),
      body: _isLoading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Loading local activities...', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : Column(
              children: [
                if (_activeEmergencyBroadcast != null) _buildEmergencyBanner(),
                Expanded(
                  child: _activities.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.event_busy, size: 80, color: Colors.grey),
                              SizedBox(height: 16),
                              Text('No activities found near you.', 
                                style: TextStyle(fontSize: 18, color: Colors.grey, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        )
                      : _isMapView ? _buildMapView() : _buildListView(),
                ),
              ],
            ),
      floatingActionButton: _isMapView ? FloatingActionButton(
        onPressed: () {
          // Re-center map to current location (if implemented) or just refresh
          setState(() => _isLoading = true);
          _fetchActivities();
          _fetchActiveEmergency();
        },
        child: const Icon(Icons.my_location),
      ) : null,
    );
  }

  Widget _buildListView() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
                  itemCount: _activities.length,
                  itemBuilder: (context, index) {
                    final act = _activities[index];
                    final dateStr = act['event_date'] != null 
                        ? DateFormat('MMM d, yyyy • h:mm a').format(DateTime.parse(act['event_date']).toLocal())
                        : 'Date TBD';
                    
                    return Card(
                      elevation: 2,
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () {
                          // Navigate to Activity Detail Screen
                          Navigator.pushNamed(context, '/activity_detail', arguments: act);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.shade50,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '${act['municipality']}',
                                      style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.bold, fontSize: 12),
                                    ),
                                  ),
                                  const Spacer(),
                                  const Icon(Icons.chevron_right, color: Colors.grey),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(
                                act['title'] ?? 'Untitled Event',
                                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                                  const SizedBox(width: 8),
                                  Text(dateStr, style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.w500)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.location_on, size: 16, color: Colors.grey),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      '${act['barangay']}, ${act['municipality']}', 
                                      style: const TextStyle(color: Colors.black54),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
  }

  Widget _buildMapView() {
    // Default to center of Agusan del Sur roughly
    LatLng center = const LatLng(8.5069, 125.7446);
    if (_activities.isNotEmpty && _activities[0]['lat'] != null) {
      center = LatLng((_activities[0]['lat'] as num).toDouble(), (_activities[0]['lng'] as num).toDouble());
    }

    return FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: 10.0,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.example.mobile_app',
        ),
        MarkerLayer(
          markers: _activities.map((act) {
            final lat = (act['lat'] as num?)?.toDouble() ?? 0.0;
            final lng = (act['lng'] as num?)?.toDouble() ?? 0.0;
            return Marker(
              point: LatLng(lat, lng),
              width: 50,
              height: 50,
              child: GestureDetector(
                onTap: () {
                  Navigator.pushNamed(context, '/activity_detail', arguments: act);
                },
                child: const Icon(
                  Icons.location_on,
                  color: Colors.red,
                  size: 40,
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
