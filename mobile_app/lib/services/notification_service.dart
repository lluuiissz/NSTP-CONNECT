import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../main.dart'; // supabase instance

import 'package:firebase_messaging/firebase_messaging.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    const AndroidInitializationSettings initializationSettingsAndroid = AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings initializationSettingsIOS = DarwinInitializationSettings();
    
    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );

    await flutterLocalNotificationsPlugin.initialize(initializationSettings);

    // Request permissions for FCM
    FirebaseMessaging messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Get the FCM token and upload to Supabase
    String? token = await messaging.getToken();
    if (token != null) {
      _uploadFcmToken(token);
    }

    // Listen for token refreshes
    messaging.onTokenRefresh.listen((newToken) {
      _uploadFcmToken(newToken);
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (message.notification != null) {
        _showNotification(message.notification!.title ?? 'Alert', message.notification!.body ?? '');
      }
    });

    _listenToSupabase();
  }

  Future<void> _uploadFcmToken(String token) async {
    try {
      final user = supabase.auth.currentUser;
      if (user != null) {
        await supabase.from('users').update({'fcm_token': token}).eq('id', user.id);
      }
    } catch (e) {
      debugPrint("Failed to upload FCM token: $e");
    }
  }

  // Exposed method to be called after login
  Future<void> refreshAndUploadToken() async {
    String? token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      await _uploadFcmToken(token);
    }
  }

  String? _userMunicipality;

  Future<void> _loadUserMunicipality() async {
    try {
      final user = supabase.auth.currentUser;
      if (user == null) return;
      final data = await supabase
          .from('users')
          .select('municipality')
          .eq('id', user.id)
          .single();
      _userMunicipality = data['municipality'] as String?;
    } catch (e) {
      debugPrint("Failed to load municipality for notification filtering: $e");
    }
  }

  void _listenToSupabase() {
    supabase
      .channel('public:notifications')
      .onPostgresChanges(
        event: PostgresChangeEvent.insert,
        schema: 'public',
        table: 'notifications',
        callback: (payload) async {
          final newRecord = payload.newRecord;
          final title = newRecord['title'] as String?;
          final message = newRecord['message'] as String?;
          final target = newRecord['target_municipality'] as String?;

          // If user municipality is not yet loaded, load it before filtering
          if (_userMunicipality == null) {
            await _loadUserMunicipality();
          }

          // Show when broadcast is global (target is null or empty) OR matches this volunteer's municipality
          final bool isMatch;
          if (target == null || target.trim().isEmpty) {
            isMatch = true;
          } else if (_userMunicipality != null && _userMunicipality!.trim().isNotEmpty) {
            isMatch = target.trim().toLowerCase() == _userMunicipality!.trim().toLowerCase();
          } else {
            isMatch = false;
          }

          if (isMatch) {
            _showNotification(title ?? 'New Announcement', message ?? '');
          }
        },
      )
      .subscribe();

    // Municipality can change on profile edit / account switch, so refresh it.
    supabase.auth.onAuthStateChange.listen((event) {
      if (event.event == AuthChangeEvent.signedIn ||
          event.event == AuthChangeEvent.initialSession) {
        _loadUserMunicipality();
      } else if (event.event == AuthChangeEvent.signedOut) {
        _userMunicipality = null;
      }
    });
    _loadUserMunicipality();
  }

  Future<void> _showNotification(String title, String body) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'nstp_announcements', // id
      'Announcements', // title
      channelDescription: 'Important announcements from NSTP and LGU',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'ticker',
    );
    const NotificationDetails platformChannelSpecifics = NotificationDetails(android: androidPlatformChannelSpecifics);
    
    await flutterLocalNotificationsPlugin.show(
      DateTime.now().millisecond, // random id
      title,
      body,
      platformChannelSpecifics,
    );
  }
}
