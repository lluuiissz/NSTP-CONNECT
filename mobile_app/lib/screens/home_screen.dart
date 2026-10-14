import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../main.dart'; // supabase instance
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/notification_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLoading = true;
  bool _isMapView = false;
  List<dynamic> _activities = [];

  @override
  void initState() {
    super.initState();
    _syncPendingLogs();
    _fetchActivities();
    
    // Ensure FCM token is uploaded for the logged-in user
    NotificationService().refreshAndUploadToken();
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
          : _activities.isEmpty
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
      floatingActionButton: _isMapView ? FloatingActionButton(
        onPressed: () {
          // Re-center map to current location (if implemented) or just refresh
          setState(() => _isLoading = true);
          _fetchActivities();
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
