import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/activity_detail_screen.dart';
import 'screens/my_log_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/welcome_screen.dart';
import 'package:firebase_core/firebase_core.dart';
import 'screens/otp_screen.dart';
import 'screens/inbox_screen.dart';
import 'services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    if (kIsWeb) {
      await Firebase.initializeApp(
        options: const FirebaseOptions(
          apiKey: 'AIzaSyNSTPConnectWebPlaceholderKey',
          appId: '1:100000000000:web:nstpconnectweb',
          messagingSenderId: '100000000000',
          projectId: 'nstp-connect-63afa',
        ),
      );
    } else {
      await Firebase.initializeApp();
    }
  } catch (e) {
    debugPrint("Firebase initialization warning: $e");
  }
  
  // Actual Supabase Initialization
  await Supabase.initialize(
    url: 'https://alplydafnokiucslivsd.supabase.co',
    publishableKey: 'sb_publishable_IrArR2RLpsx40QH_ghftHg_R3vyQAWE',
  );

  // Initialize Notifications
  await NotificationService().init();

  runApp(const MyApp());
}

final supabase = Supabase.instance.client;

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NSTP-CONNECT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB), // Tailwind Blue-600
          primary: const Color(0xFF2563EB),
          secondary: const Color(0xFF4F46E5), // Tailwind Indigo-600
        ),
        useMaterial3: true,
        // Aesthetic Minimalism: Clean typography
        fontFamily: 'Roboto', // Default flutter font, but clean
      ),
      home: const AuthGate(),
      routes: {
        '/welcome': (context) => const WelcomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/otp': (context) => const OTPScreen(),
        '/home': (context) => const MainNavigation(),
        '/activity_detail': (context) => const ActivityDetailScreen(),
      },
    );
  }
}

/// Reactive AuthGate: Listens to Supabase Auth state changes in real-time.
/// Automatically restores sessions from disk when the app is restarted or turned off,
/// and handles token refreshing in the background so users never get logged out.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: supabase.auth.onAuthStateChange,
      builder: (context, snapshot) {
        final session = snapshot.hasData
            ? snapshot.data!.session
            : supabase.auth.currentSession;

        if (session != null) {
          return const MainNavigation();
        }

        if (snapshot.connectionState == ConnectionState.waiting &&
            supabase.auth.currentSession == null) {
          return const Scaffold(
            backgroundColor: Colors.white,
            body: Center(
              child: CircularProgressIndicator(color: Color(0xFF2563EB)),
            ),
          );
        }

        return const WelcomeScreen();
      },
    );
  }
}

// Bottom Navigation wrapper (Jakob's Law)
class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> {
  int _selectedIndex = 0;
  int _unattendedAlertsCount = 0;
  RealtimeChannel? _navChannel;

  @override
  void initState() {
    super.initState();
    _fetchUnattendedCount();
    _setupNavRealtime();
  }

  @override
  void dispose() {
    if (_navChannel != null) {
      supabase.removeChannel(_navChannel!);
    }
    super.dispose();
  }

  Future<void> _fetchUnattendedCount() async {
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

      // Fetch active broadcasts requiring attendance
      final broadcasts = await supabase
          .from('notifications')
          .select('id')
          .eq('requires_attendance', true)
          .or(orFilter);

      final bIds = (broadcasts as List).map((b) => b['id'].toString()).toSet();
      if (bIds.isEmpty) {
        if (mounted) setState(() => _unattendedAlertsCount = 0);
        return;
      }

      // Fetch user's attendances
      final attendances = await supabase
          .from('broadcast_attendances')
          .select('broadcast_id')
          .eq('user_id', user.id);

      final attendedIds = (attendances as List).map((a) => a['broadcast_id'].toString()).toSet();
      final unattended = bIds.difference(attendedIds).length;

      if (mounted) {
        setState(() => _unattendedAlertsCount = unattended);
      }
    } catch (e) {
      debugPrint("Error fetching nav badge count: $e");
    }
  }

  void _setupNavRealtime() {
    _navChannel = supabase.channel('nav_alerts_channel')
      ..onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'notifications',
        callback: (_) => _fetchUnattendedCount(),
      )
      ..onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'broadcast_attendances',
        callback: (_) => _fetchUnattendedCount(),
      )
      ..subscribe();
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      HomeScreen(onOpenInbox: () => _onItemTapped(1)),
      const InboxScreen(),
      const ProfileScreen(),
      const MyLogScreen(),
    ];

    return Scaffold(
      body: Center(
        child: pages.elementAt(_selectedIndex),
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        items: <BottomNavigationBarItem>[
          const BottomNavigationBarItem(
            icon: Icon(Icons.explore),
            label: 'Discover',
          ),
          BottomNavigationBarItem(
            icon: Badge(
              label: Text('$_unattendedAlertsCount'),
              isLabelVisible: _unattendedAlertsCount > 0,
              backgroundColor: Colors.red,
              child: const Icon(Icons.inbox),
            ),
            label: 'Inbox',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.history),
            label: 'My Log',
          ),
        ],
        currentIndex: _selectedIndex,
        selectedItemColor: Theme.of(context).colorScheme.primary,
        onTap: _onItemTapped,
      ),
    );
  }
}
