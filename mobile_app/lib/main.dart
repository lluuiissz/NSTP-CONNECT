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

  static const List<Widget> _widgetOptions = <Widget>[
    HomeScreen(),
    InboxScreen(), // Inbox tab
    ProfileScreen(),
    MyLogScreen(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: _widgetOptions.elementAt(_selectedIndex),
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        items: const <BottomNavigationBarItem>[
          BottomNavigationBarItem(
            icon: Icon(Icons.explore),
            label: 'Discover',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.inbox),
            label: 'Inbox',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profile',
          ),
          BottomNavigationBarItem(
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
