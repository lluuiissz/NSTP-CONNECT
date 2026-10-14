import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../main.dart'; // supabase instance
import 'package:intl/intl.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class ActivityDetailScreen extends StatefulWidget {
  const ActivityDetailScreen({super.key});

  @override
  State<ActivityDetailScreen> createState() => _ActivityDetailScreenState();
}

class _ActivityDetailScreenState extends State<ActivityDetailScreen> {
  bool _isTracking = false;
  bool _isLoadingLocation = true; // start true to check session
  String _statusMsg = 'Checking active sessions...';
  Color _statusColor = Colors.blue;
  
  Map<String, dynamic>? _act;
  Timer? _timer;
  Timer? _gpsPingTimer;
  int _elapsedSeconds = 0;
  DateTime? _startTime;
  bool _isVerified = false;
  bool _isLoadingVerification = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_act == null) {
      _act = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>;
      _checkVerificationStatus();
      _checkActiveSession();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _gpsPingTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkVerificationStatus() async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) return;
      
      final data = await supabase.from('users').select('is_verified').eq('id', userId).single();
      if (mounted) {
        setState(() {
          _isVerified = data['is_verified'] ?? false;
          _isLoadingVerification = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isVerified = false;
          _isLoadingVerification = false;
        });
      }
    }
  }

  Future<void> _checkActiveSession() async {
    try {
      final userId = supabase.auth.currentUser?.id;
      if (userId == null) return;

      // Check if user is tracking ANY activity
      final data = await supabase
          .from('volunteer_logs')
          .select()
          .eq('user_id', userId)
          .eq('status', 'active');

      if (data.isNotEmpty) {
        final activeLog = data.first;
        if (activeLog['activity_id'] == _act!['id']) {
          // It's THIS activity! Restore timer
          setState(() {
            _isTracking = true;
            _startTime = DateTime.parse(activeLog['created_at']).toLocal();
            // Handle potential clock skew between device and server
            int diff = DateTime.now().difference(_startTime!).inSeconds;
            _elapsedSeconds = diff > 0 ? diff : 0;
            _statusMsg = 'You are actively tracking this activity.';
            _statusColor = Colors.green;
            _isLoadingLocation = false;
          });
          _startTimer();
        } else {
          // Tracking a DIFFERENT activity
          setState(() {
            _isTracking = false;
            _statusMsg = 'You are currently tracking another activity. Please stop that one first.';
            _statusColor = Colors.orange;
            _isLoadingLocation = false;
          });
        }
      } else {
        // No active sessions
        setState(() {
          _isTracking = false;
          _isLoadingLocation = false;
          _statusMsg = '';
        });
      }
    } catch (e) {
      // Fallback to local cache if network fails
      try {
        final prefs = await SharedPreferences.getInstance();
        final localSessionKey = 'active_session_${_act!['id']}';
        final localSessionData = prefs.getString(localSessionKey);
        
        if (localSessionData != null) {
          final session = jsonDecode(localSessionData);
          setState(() {
            _isTracking = true;
            _startTime = DateTime.parse(session['start_time']).toLocal();
            int diff = DateTime.now().difference(_startTime!).inSeconds;
            _elapsedSeconds = diff > 0 ? diff : 0;
            _statusMsg = 'Offline mode: Actively tracking. (Network unavailable)';
            _statusColor = Colors.orange;
            _isLoadingLocation = false;
          });
          _startTimer();
          return;
        }
      } catch (cacheErr) {
        // ignore cache errors
      }

      setState(() {
        _isLoadingLocation = false;
        _statusMsg = 'Could not verify active sessions. Please check internet connection.';
        _statusColor = Colors.red;
      });
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _elapsedSeconds++;
        });
      }
    });
    _startGpsPings();
  }

  /// While tracking, push a fresh GPS fix every 3 minutes so the LGU's
  /// Live Radar shows the volunteer's current position, not just the
  /// spot where they pressed Start.
  void _startGpsPings() {
    _gpsPingTimer?.cancel();
    _gpsPingTimer = Timer.periodic(const Duration(minutes: 3), (timer) async {
      if (!mounted || !_isTracking) return;
      try {
        final act = _act;
        if (act == null) return;

        LocationPermission permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied ||
            permission == LocationPermission.deniedForever) {
          return; // silently skip this ping; the next one will retry
        }

        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
        );

        final userId = supabase.auth.currentUser?.id;
        if (userId == null) return;

        await supabase
            .from('volunteer_logs')
            .update({
              'lat': position.latitude,
              'lng': position.longitude,
            })
            .eq('user_id', userId)
            .eq('activity_id', act['id'])
            .eq('status', 'active');
      } catch (e) {
        // Network/GPS hiccups shouldn't interrupt tracking — the next
        // ping cycle will try again.
        debugPrint('GPS ping failed (will retry): $e');
      }
    });
  }

  void _stopGpsPings() {
    _gpsPingTimer?.cancel();
    _gpsPingTimer = null;
  }

  String get _formattedTime {
    int h = _elapsedSeconds ~/ 3600;
    int m = (_elapsedSeconds % 3600) ~/ 60;
    int s = _elapsedSeconds % 60;
    return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _startVolunteering(Map<String, dynamic> act) async {
    // Double check they aren't tracking something else
    final userId = supabase.auth.currentUser?.id;
    if (userId == null) return;

    setState(() {
      _isLoadingLocation = true;
      _statusMsg = 'Finding your location...';
      _statusColor = Colors.blue;
    });

    try {
      final activeCheck = await supabase
          .from('volunteer_logs')
          .select()
          .eq('user_id', userId)
          .eq('status', 'active');
          
      if (activeCheck.isNotEmpty) {
        throw Exception('You are already tracking an activity. Please finish it first.');
      }

      // 1. Check Permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception('Location permissions are denied.');
        }
      }
      if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permissions are permanently denied.');
      }

      // 2. Get current location
      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      // 3. Distance Check
      final double actLat = act['lat'] ?? 0.0;
      final double actLng = act['lng'] ?? 0.0;
      final distanceInMeters = Geolocator.distanceBetween(position.latitude, position.longitude, actLat, actLng);

      if (distanceInMeters > 1000) {
        setState(() {
          _statusMsg = 'You are too far (${(distanceInMeters/1000).toStringAsFixed(1)}km away). Move closer.';
          _statusColor = Colors.red;
          _isLoadingLocation = false;
        });
        return;
      }

      // 4. Log to Supabase
      final now = DateTime.now();
      await supabase.from('volunteer_logs').insert({
        'user_id': userId,
        'activity_id': act['id'],
        'lat': position.latitude,
        'lng': position.longitude,
        'status': 'active',
        'created_at': now.toUtc().toIso8601String()
      });

      // 5. Save locally to SharedPreferences to survive app restarts and offline scenarios
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('active_session_${act['id']}', jsonEncode({
        'start_time': now.toUtc().toIso8601String(),
        'activity_id': act['id']
      }));

      setState(() {
        _isTracking = true;
        _isLoadingLocation = false;
        _startTime = now;
        _elapsedSeconds = 0;
        _statusMsg = 'Tracking started! Your time is being recorded.';
        _statusColor = Colors.green;
      });
      _startTimer();

    } catch (e) {
      setState(() {
        _isLoadingLocation = false;
        _statusMsg = e.toString().replaceAll('Exception: ', '');
        _statusColor = Colors.red;
      });
    }
  }

  Future<void> _stopVolunteering(Map<String, dynamic> act) async {
    setState(() {
      _isLoadingLocation = true;
      _statusMsg = 'Saving your session...';
      _statusColor = Colors.blue;
    });
    
    try {
      final userId = supabase.auth.currentUser?.id;
      _timer?.cancel();
      
      // Calculate final service hours (decimal)
      double serviceHours = _elapsedSeconds / 3600.0;
      // Round to 2 decimal places
      serviceHours = double.parse(serviceHours.toStringAsFixed(2));
      
      // If they tracked for less than 1 minute (for MVP demo purposes, we will log it anyway, but usually we wouldn't)
      if (serviceHours == 0.0 && _elapsedSeconds > 0) {
        serviceHours = 0.01; // Minimum log
      }

      _stopGpsPings();

      await supabase
          .from('volunteer_logs')
          .update({
            'status': 'completed',
            'service_hours': serviceHours
          })
          .eq('user_id', userId!)
          .eq('activity_id', act['id'])
          .eq('status', 'active');
          
      // Clear local active session cache
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('active_session_${act['id']}');

      setState(() {
        _isTracking = false;
        _isLoadingLocation = false;
        _startTime = null;
        _elapsedSeconds = 0;
        _statusMsg = 'Session saved! You logged $serviceHours hours.';
        _statusColor = Colors.green;
      });
    } catch(e) {
      // If network fails on stop, we queue it to sync later
      try {
        final prefs = await SharedPreferences.getInstance();
        const pendingKey = 'pending_sync_logs';
        List<String> pendingLogs = prefs.getStringList(pendingKey) ?? [];
        
        final userId = supabase.auth.currentUser?.id;
        double serviceHours = _elapsedSeconds / 3600.0;
        serviceHours = double.parse(serviceHours.toStringAsFixed(2));
        if (serviceHours == 0.0 && _elapsedSeconds > 0) serviceHours = 0.01;

        pendingLogs.add(jsonEncode({
          'user_id': userId,
          'activity_id': act['id'],
          'service_hours': serviceHours,
          'timestamp': DateTime.now().toUtc().toIso8601String()
        }));
        
        await prefs.setStringList(pendingKey, pendingLogs);
        await prefs.remove('active_session_${act['id']}');

        setState(() {
          _isTracking = false;
          _isLoadingLocation = false;
          _startTime = null;
          _elapsedSeconds = 0;
          _statusMsg = 'Offline: Session saved locally. Will sync when online.';
          _statusColor = Colors.orange;
        });
      } catch (cacheErr) {
        setState(() {
          _isLoadingLocation = false;
          _statusMsg = 'Could not save session locally or online. Please try again.';
          _statusColor = Colors.red;
        });
        _startTimer(); // resume timer UI
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_act == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    
    final act = _act!;
    final dateStr = act['event_date'] != null 
        ? DateFormat('EEEE, MMMM d, yyyy • h:mm a').format(DateTime.parse(act['event_date']).toLocal())
        : 'Date TBD';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Event Details', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Live Interactive Map Header
            SizedBox(
              height: 250,
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: LatLng(act['lat'] ?? 8.5085, act['lng'] ?? 125.9818),
                  initialZoom: 15.0,
                  interactionOptions: const InteractionOptions(flags: InteractiveFlag.all),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.nstp.connect',
                  ),
                  MarkerLayer(
                    markers: [
                      if (act['lat'] != null && act['lng'] != null)
                        Marker(
                          point: LatLng(act['lat'], act['lng']),
                          width: 40,
                          height: 40,
                          child: const Icon(Icons.location_pin, color: Colors.red, size: 40),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${act['barangay']}, ${act['municipality']}',
                      style: TextStyle(color: Colors.blue.shade700, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    act['title'] ?? 'Untitled Event',
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.black87, height: 1.2),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.calendar_today, color: Colors.grey),
                      const SizedBox(width: 12),
                      Expanded(child: Text(dateStr, style: const TextStyle(fontSize: 16, color: Colors.black87, fontWeight: FontWeight.w500))),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('About this event', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(
                    act['description'] ?? 'No description provided.',
                    style: const TextStyle(fontSize: 16, color: Colors.black54, height: 1.5),
                  ),
                  
                  const SizedBox(height: 40),
                  
                  // Status Message Area
                  if (_statusMsg.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(16),
                      margin: const EdgeInsets.only(bottom: 24),
                      decoration: BoxDecoration(
                        color: _statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: _statusColor.withOpacity(0.5)),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _statusColor == Colors.green ? Icons.check_circle : (_statusColor == Colors.red ? Icons.error : Icons.info),
                            color: _statusColor,
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Text(_statusMsg, style: TextStyle(color: _statusColor, fontWeight: FontWeight.bold))),
                        ],
                      ),
                    ),

                  // Timer Display
                  if (_isTracking)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 24),
                        child: Column(
                          children: [
                            const Text('TIME ELAPSED', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, letterSpacing: 2)),
                            Text(
                              _formattedTime,
                              style: const TextStyle(fontSize: 56, fontWeight: FontWeight.w900, color: Colors.green, fontFeatures: [FontFeature.tabularFigures()]),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Giant Call to Action
                  SizedBox(
                    height: 80, // Massive touch target
                    child: ElevatedButton(
                      onPressed: _isLoadingLocation || _isLoadingVerification || !_isVerified || (_statusMsg.contains('another activity') && !_isTracking) ? null : () {
                        if (_isTracking) {
                          _stopVolunteering(act);
                        } else {
                          _startVolunteering(act);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: !_isVerified ? Colors.grey.shade400 : (_isTracking ? Colors.red.shade600 : Colors.green.shade600),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                        elevation: !_isVerified ? 0 : 4,
                      ),
                      child: _isLoadingLocation || _isLoadingVerification
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3)),
                                SizedBox(width: 12),
                                Text('Processing...', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                              ],
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(!_isVerified ? Icons.lock : (_isTracking ? Icons.stop_circle : Icons.play_circle_fill), size: 32),
                                const SizedBox(width: 12),
                                Text(
                                  !_isVerified ? 'Account Not Verified' : (_isTracking ? 'Stop Tracking' : "I'm Here - Start"),
                                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.5),
                                ),
                              ],
                            ),
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  if (!_isLoadingVerification && !_isVerified)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.orange.shade200)
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.warning_amber_rounded, color: Colors.orange.shade700),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Text(
                              "You must wait for the NSTP office to verify your account before you can log volunteering hours.",
                              style: TextStyle(color: Colors.deepOrange, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          )
                        ],
                      )
                    )
                  else
                    const Text(
                      "Tapping this will securely log your GPS location to verify your attendance.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
