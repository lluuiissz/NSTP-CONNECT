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

  // Check if there is an active session so users aren't bounced back to login on app exit
  final session = Supabase.instance.client.auth.currentSession;
  final initialRoute = session != null ? '/home' : '/welcome';

  runApp(MyApp(initialRoute: initialRoute));
}

final supabase = Supabase.instance.client;

class MyApp extends StatelessWidget {
  final String initialRoute;
  const MyApp({super.key, this.initialRoute = '/welcome'});

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
      initialRoute: initialRoute,
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
