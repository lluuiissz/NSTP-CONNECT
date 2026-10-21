import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../utils/locations.dart';
import '../main.dart'; // supabase instance
import 'package:intl/intl.dart';
import 'package:geolocator/geolocator.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  bool _isLoading = true;
  List<dynamic> _notifications = [];
  String? _userMunicipality;
  String? _userBarangay;
  String? _userComponent;

  // Map of broadcast_id -> attendance record
  Map<String, Map<String, dynamic>> _myAttendances = {};
  final Set<String> _checkingInIds = {};
  final Set<String> _showMapBroadcastIds = {};
  Position? _currentGps;
  RealtimeChannel? _realtimeChannel;

  @override
  void initState() {
    super.initState();
    _fetchInbox();
    _fetchUserGps();
    _setupRealtime();
  }

  Future<void> _fetchUserGps() async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) return;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
        ).timeout(const Duration(seconds: 6));
        if (mounted) {
          setState(() => _currentGps = pos);
        }
      }
    } catch (e) {
      debugPrint("Pre-fetch GPS note: $e");
    }
  }

  Future<void> _openDirections(double lat, double lng, String label) async {
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint("Directions launcher error: $e");
    }
  }

  void _setupRealtime() {
    _realtimeChannel = supabase.channel('mobile_inbox_feed')
      ..onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'notifications',
        callback: (payload) => _fetchInbox(),
      )
      ..onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'broadcast_attendances',
        callback: (payload) => _fetchInbox(),
      )
      ..subscribe();
  }

  @override
  void dispose() {
    if (_realtimeChannel != null) {
      supabase.removeChannel(_realtimeChannel!);
    }
    super.dispose();
  }

  Future<void> _fetchInbox() async {
    try {
      final user = supabase.auth.currentUser;
      if (user != null) {
        // 1. Get user profile details
        final userData = await supabase
            .from('users')
            .select('municipality, barangay, nstp_component')
            .eq('id', user.id)
            .maybeSingle();

        if (userData != null) {
          _userMunicipality = userData['municipality'];
          _userBarangay = userData['barangay'];
          _userComponent = userData['nstp_component'];
        }

        // 2. Fetch notifications: target_municipality is null OR matches user's municipality
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

        // 3. Fetch user's existing broadcast attendances
        final attendanceRows = await supabase
            .from('broadcast_attendances')
            .select()
            .eq('user_id', user.id);

        final Map<String, Map<String, dynamic>> attMap = {};
        for (final row in attendanceRows) {
          final bId = row['broadcast_id']?.toString();
          if (bId != null) {
            attMap[bId] = Map<String, dynamic>.from(row);
          }
        }

        if (mounted) {
          setState(() {
            _notifications = notifData;
            _myAttendances = attMap;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    } catch (e) {
      debugPrint("Inbox fetch error: $e");
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<String?> _promptSelectComponent() async {
    return showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.badge, color: Color(0xFF1E3A8A), size: 24),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Select NSTP Component',
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Identify your unit for this emergency mobilization:',
                            style: TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _buildComponentTile('ROTC', 'Reserve Officers\' Training Corps', Icons.shield, Colors.amber.shade800, Colors.amber.shade50),
                const SizedBox(height: 10),
                _buildComponentTile('CWTS', 'Civic Welfare Training Service', Icons.volunteer_activism, Colors.blue.shade700, Colors.blue.shade50),
                const SizedBox(height: 10),
                _buildComponentTile('LTS', 'Literacy Training Service', Icons.menu_book, Colors.purple.shade700, Colors.purple.shade50),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildComponentTile(String code, String name, IconData icon, Color color, Color bg) {
    return InkWell(
      onTap: () => Navigator.pop(context, code),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    code,
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color),
                  ),
                  Text(
                    name,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios, size: 16, color: color),
          ],
        ),
      ),
    );
  }

  Future<void> _handleCheckIn(Map<String, dynamic> notif) async {
    final user = supabase.auth.currentUser;
    if (user == null) return;

    final broadcastId = notif['id']?.toString();
    if (broadcastId == null) return;

    // Determine or prompt component
    String? chosenComponent = _userComponent;
    if (chosenComponent == null || chosenComponent.trim().isEmpty) {
      chosenComponent = await _promptSelectComponent();
      if (chosenComponent == null) return; // user cancelled

      try {
        await supabase.from('users').update({'nstp_component': chosenComponent}).eq('id', user.id);
        _userComponent = chosenComponent;
      } catch (e) {
        debugPrint("Could not update user component: $e");
      }
    }

    setState(() {
      _checkingInIds.add(broadcastId);
    });

    try {
      // 1. Try acquiring GPS coordinates
      double? lat;
      double? lng;
      try {
        final serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          LocationPermission permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.denied) {
            permission = await Geolocator.requestPermission();
          }
          if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
            final position = await Geolocator.getCurrentPosition(
              locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
            ).timeout(const Duration(seconds: 7));
            lat = position.latitude;
            lng = position.longitude;
          }
        }
      } catch (locErr) {
        debugPrint("GPS location read (non-fatal warning): $locErr");
      }

      // 2. Insert into broadcast_attendances
      final insertData = {
        'broadcast_id': broadcastId,
        'user_id': user.id,
        'nstp_component': chosenComponent,
        'lat': lat,
        'lng': lng,
        'municipality': _userMunicipality,
        'barangay': _userBarangay,
      };

      final response = await supabase
          .from('broadcast_attendances')
          .upsert(insertData, onConflict: 'broadcast_id,user_id')
          .select()
          .single();

      if (mounted) {
        setState(() {
          _myAttendances[broadcastId] = Map<String, dynamic>.from(response);
          _checkingInIds.remove(broadcastId);
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Attendance confirmed as $chosenComponent! Thank you for reporting.',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF0F766E),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      debugPrint("Attendance check-in error: $e");
      if (mounted) {
        setState(() {
          _checkingInIds.remove(broadcastId);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Could not confirm attendance. Please check your network connection and try again.'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  Color _getComponentColor(String? comp) {
    switch (comp?.toUpperCase()) {
      case 'ROTC':
        return Colors.amber.shade800;
      case 'CWTS':
        return Colors.blue.shade700;
      case 'LTS':
        return Colors.purple.shade700;
      default:
        return Colors.teal.shade700;
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
          : RefreshIndicator(
              onRefresh: _fetchInbox,
              child: _notifications.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                        const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.inbox_outlined, size: 80, color: Colors.grey),
                              SizedBox(height: 16),
                              Text('No messages yet.', 
                                style: TextStyle(fontSize: 18, color: Colors.grey, fontWeight: FontWeight.bold)),
                              SizedBox(height: 8),
                              Text('Emergency broadcasts will appear here automatically.', 
                                style: TextStyle(color: Colors.grey)),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      itemCount: _notifications.length,
                      itemBuilder: (context, index) {
                    final notif = _notifications[index];
                    final broadcastId = notif['id']?.toString() ?? '';
                    final dateStr = notif['created_at'] != null 
                        ? DateFormat('MMM d, yyyy • h:mm a').format(DateTime.parse(notif['created_at']).toLocal())
                        : 'Unknown Date';
                    
                    final isGlobal = notif['target_municipality'] == null;
                    final targetBarangay = notif['target_barangay'];
                    final assemblyPoint = notif['assembly_point'];
                    final requiresAttendance = notif['requires_attendance'] ?? true;

                    final attendance = _myAttendances[broadcastId];
                    final isAttended = attendance != null;
                    final isCheckingIn = _checkingInIds.contains(broadcastId);

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                          color: isAttended 
                              ? Colors.green.shade300 
                              : (requiresAttendance ? Colors.red.shade200 : Colors.grey.shade200),
                          width: isAttended ? 1.5 : 1,
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Header: Scope badge and timestamp
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: (isGlobal ? Colors.purple : Colors.red).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.campaign, 
                                        color: isGlobal ? Colors.purple : Colors.red,
                                        size: 16,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        isGlobal ? 'Global Broadcast' : 'LGU Alert',
                                        style: TextStyle(
                                          color: isGlobal ? Colors.purple : Colors.red,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  dateStr,
                                  style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // Broadcast Title
                            Text(
                              notif['title'] ?? 'Alert',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                            ),
                            const SizedBox(height: 8),

                            // Broadcast Message
                            Text(
                              notif['message'] ?? '',
                              style: const TextStyle(color: Colors.black87, height: 1.4, fontSize: 14),
                            ),

                            // Incident Target & Assembly Point Area
                            if (assemblyPoint != null || targetBarangay != null || requiresAttendance) ...[
                              const SizedBox(height: 14),
                              Builder(
                                builder: (context) {
                                  final targetCoords = getBroadcastCoordinates(
                                    municipality: notif['target_municipality'] ?? _userMunicipality,
                                    lat: (notif['lat'] as num?)?.toDouble(),
                                    lng: (notif['lng'] as num?)?.toDouble(),
                                  );

                                  String? distanceText;
                                  if (_currentGps != null) {
                                    final d = Geolocator.distanceBetween(
                                      _currentGps!.latitude,
                                      _currentGps!.longitude,
                                      targetCoords.latitude,
                                      targetCoords.longitude,
                                    );
                                    distanceText = '${(d / 1000).toStringAsFixed(1)} km away';
                                  }

                                  final isMapOpen = _showMapBroadcastIds.contains(broadcastId) || (requiresAttendance && !isAttended);

                                  return Container(
                                    decoration: BoxDecoration(
                                      color: Colors.orange.shade50,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: Colors.orange.shade200),
                                    ),
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        // Location Text details
                                        if (assemblyPoint != null && assemblyPoint.toString().trim().isNotEmpty)
                                          Row(
                                            children: [
                                              Icon(Icons.meeting_room, size: 16, color: Colors.orange.shade900),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  'Assembly Point: $assemblyPoint',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.bold,
                                                    color: Colors.orange.shade900,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        if (targetBarangay != null && targetBarangay.toString().trim().isNotEmpty) ...[
                                          if (assemblyPoint != null) const SizedBox(height: 4),
                                          Row(
                                            children: [
                                              Icon(Icons.location_on, size: 16, color: Colors.orange.shade800),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  'Target Barangay: $targetBarangay (${notif['target_municipality'] ?? 'Agusan del Sur'})',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.orange.shade900,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],

                                        const SizedBox(height: 8),

                                        // Map Header Bar with Distance & Toggle Button
                                        Row(
                                          children: [
                                            if (distanceText != null)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                decoration: BoxDecoration(
                                                  color: Colors.white,
                                                  borderRadius: BorderRadius.circular(12),
                                                  border: Border.all(color: Colors.orange.shade300),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Icon(Icons.navigation, size: 11, color: Colors.orange.shade900),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      distanceText,
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.bold,
                                                        color: Colors.orange.shade900,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            const Spacer(),
                                            // Navigation Button
                                            InkWell(
                                              onTap: () => _openDirections(
                                                targetCoords.latitude,
                                                targetCoords.longitude,
                                                assemblyPoint ?? targetBarangay ?? 'Assembly Point',
                                              ),
                                              borderRadius: BorderRadius.circular(8),
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF1E3A8A),
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: const Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Icon(Icons.directions, size: 13, color: Colors.white),
                                                    SizedBox(width: 4),
                                                    Text(
                                                      'Directions',
                                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            // Toggle Map View Button
                                            InkWell(
                                              onTap: () {
                                                setState(() {
                                                  if (_showMapBroadcastIds.contains(broadcastId)) {
                                                    _showMapBroadcastIds.remove(broadcastId);
                                                  } else {
                                                    _showMapBroadcastIds.add(broadcastId);
                                                  }
                                                });
                                              },
                                              borderRadius: BorderRadius.circular(8),
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                                decoration: BoxDecoration(
                                                  color: Colors.white,
                                                  borderRadius: BorderRadius.circular(8),
                                                  border: Border.all(color: Colors.grey.shade300),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    Icon(
                                                      isMapOpen ? Icons.map : Icons.map_outlined,
                                                      size: 13,
                                                      color: Colors.grey.shade800,
                                                    ),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      isMapOpen ? 'Hide Map' : 'Track Map',
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w600,
                                                        color: Colors.grey.shade800,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),

                                        // Interactive Map
                                        if (isMapOpen) ...[
                                          const SizedBox(height: 10),
                                          Container(
                                            height: 180,
                                            decoration: BoxDecoration(
                                              borderRadius: BorderRadius.circular(12),
                                              border: Border.all(color: Colors.orange.shade300),
                                            ),
                                            clipBehavior: Clip.antiAlias,
                                            child: FlutterMap(
                                              options: MapOptions(
                                                initialCenter: targetCoords,
                                                initialZoom: 13.5,
                                              ),
                                              children: [
                                                TileLayer(
                                                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                                  userAgentPackageName: 'com.nstpconnect.mobile_app',
                                                ),
                                                MarkerLayer(
                                                  markers: [
                                                    // Incident / Assembly Area Marker
                                                    Marker(
                                                      point: targetCoords,
                                                      width: 48,
                                                      height: 48,
                                                      child: const Icon(
                                                        Icons.location_on,
                                                        color: Colors.red,
                                                        size: 44,
                                                      ),
                                                    ),
                                                    // Volunteer Live GPS Marker
                                                    if (_currentGps != null)
                                                      Marker(
                                                        point: LatLng(_currentGps!.latitude, _currentGps!.longitude),
                                                        width: 32,
                                                        height: 32,
                                                        child: Container(
                                                          decoration: BoxDecoration(
                                                            color: Colors.blue.shade600,
                                                            shape: BoxShape.circle,
                                                            border: Border.all(color: Colors.white, width: 2.5),
                                                            boxShadow: const [
                                                              BoxShadow(color: Colors.black26, blurRadius: 4),
                                                            ],
                                                          ),
                                                          child: const Icon(Icons.person, color: Colors.white, size: 18),
                                                        ),
                                                      ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ],

                            // Attendance Status / Check-In Section
                            if (requiresAttendance) ...[
                              const SizedBox(height: 16),
                              if (isAttended) ...[
                                // Verified Attendance Badge
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.green.shade50,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.green.shade300),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(6),
                                        decoration: BoxDecoration(
                                          color: Colors.green.shade600,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.check, color: Colors.white, size: 16),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                const Text(
                                                  'Attendance Verified',
                                                  style: TextStyle(
                                                    fontWeight: FontWeight.bold,
                                                    fontSize: 13,
                                                    color: Color(0xFF14532D),
                                                  ),
                                                ),
                                                const SizedBox(width: 8),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: _getComponentColor(attendance['nstp_component']),
                                                    borderRadius: BorderRadius.circular(6),
                                                  ),
                                                  child: Text(
                                                    attendance['nstp_component'] ?? 'VOLUNTEER',
                                                    style: const TextStyle(
                                                      color: Colors.white,
                                                      fontWeight: FontWeight.bold,
                                                      fontSize: 10,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              attendance['created_at'] != null
                                                  ? 'Logged at ${DateFormat('h:mm a • MMM d').format(DateTime.parse(attendance['created_at']).toLocal())}'
                                                  : 'On-site confirmed',
                                              style: TextStyle(fontSize: 11, color: Colors.green.shade900),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ] else ...[
                                // Call-to-action button to confirm attendance
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.blueGrey.shade50,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.blueGrey.shade200),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(Icons.how_to_reg, size: 18, color: Colors.blueGrey.shade800),
                                          const SizedBox(width: 8),
                                          Text(
                                            'Mustering & Attendance Required',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.blueGrey.shade900,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        'Please confirm your on-site attendance to record active deployment for this emergency.',
                                        style: TextStyle(fontSize: 11, color: Colors.blueGrey.shade700),
                                      ),
                                      const SizedBox(height: 10),
                                      ElevatedButton(
                                        onPressed: isCheckingIn ? null : () => _handleCheckIn(notif),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF1E3A8A),
                                          foregroundColor: Colors.white,
                                          elevation: 0,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          padding: const EdgeInsets.symmetric(vertical: 12),
                                        ),
                                        child: isCheckingIn
                                            ? const SizedBox(
                                                height: 18,
                                                width: 18,
                                                child: CircularProgressIndicator(
                                                  strokeWidth: 2,
                                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                                ),
                                              )
                                            : Row(
                                                mainAxisAlignment: MainAxisAlignment.center,
                                                children: [
                                                  const Icon(Icons.check_circle_outline, size: 18),
                                                  const SizedBox(width: 8),
                                                  Text(
                                                    _userComponent != null && _userComponent!.isNotEmpty
                                                        ? 'Confirm Attendance as $_userComponent'
                                                        : 'Confirm On-Site Attendance',
                                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                                  ),
                                                ],
                                              ),
                                      ),
                                      if (_userComponent != null && _userComponent!.isNotEmpty)
                                        Align(
                                          alignment: Alignment.centerRight,
                                          child: TextButton(
                                            onPressed: () async {
                                              final newComp = await _promptSelectComponent();
                                              if (newComp != null) {
                                                setState(() => _userComponent = newComp);
                                                final user = supabase.auth.currentUser;
                                                if (user != null) {
                                                  await supabase.from('users').update({'nstp_component': newComp}).eq('id', user.id);
                                                }
                                              }
                                            },
                                            style: TextButton.styleFrom(
                                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                              minimumSize: Size.zero,
                                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                            ),
                                            child: Text(
                                              'Change unit (currently $_userComponent)',
                                              style: TextStyle(fontSize: 10, color: Colors.blueGrey.shade600),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
    );
  }
}

