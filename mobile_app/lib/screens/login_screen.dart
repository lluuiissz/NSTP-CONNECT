import 'dart:math';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../main.dart'; // for supabase instance
import '../utils/locations.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  // New fields for Complete Profile
  final _fullNameController = TextEditingController();
  final _mobileNumberController = TextEditingController();
  String _selectedComponent = 'CWTS';
  
  String? _selectedMunicipality;
  String? _selectedBarangay;

  bool _isLoading = false;
  bool _isSignUp = false;
  String _errorMsg = '';
  XFile? _certificateImage;
  final _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    if (supabase.auth.currentSession != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.pushReplacementNamed(context, '/home');
      });
    }
  }

  Future<void> _pickCertificate() async {
    try {
      final pickedFile =
          await _imagePicker.pickImage(source: ImageSource.gallery);
      if (pickedFile != null) {
        setState(() {
          _certificateImage = pickedFile;
          _errorMsg = ''; // clear errors
        });
      }
    } catch (e) {
      setState(() {
        _errorMsg = 'Could not pick image: $e';
      });
    }
  }

  Future<void> _handleAuth() async {
    setState(() {
      _isLoading = true;
      _errorMsg = '';
    });

    try {
      if (_isSignUp) {
        // Sign Up with Custom OTP
        final email = _emailController.text.trim();
        final password = _passwordController.text;
        final confirmPassword = _confirmPasswordController.text;

        if (password != confirmPassword) {
          setState(() {
            _errorMsg = 'Passwords do not match.';
            _isLoading = false;
          });
          return;
        }

        // Validate required profile fields before sending the OTP email
        if (_fullNameController.text.trim().isEmpty) {
          setState(() {
            _errorMsg = 'Please enter your full name.';
            _isLoading = false;
          });
          return;
        }
        if (_mobileNumberController.text.trim().isEmpty) {
          setState(() {
            _errorMsg = 'Please enter your mobile number.';
            _isLoading = false;
          });
          return;
        }

        final mobileNumber = _mobileNumberController.text.trim();
        final mobileRegex = RegExp(r'^(09|\+639)\d{9}$');
        if (!mobileRegex.hasMatch(mobileNumber)) {
          setState(() {
            _errorMsg = 'Please enter a valid mobile number (e.g., 09123456789).';
            _isLoading = false;
          });
          return;
        }
        if (_selectedMunicipality == null || _selectedBarangay == null) {
          setState(() {
            _errorMsg = 'Please select your municipality and barangay.';
            _isLoading = false;
          });
          return;
        }

        // 1. Generate 6-digit OTP
        final random = Random();
        final otp = (100000 + random.nextInt(900000)).toString();

        // Contact number for verification calls (registration sa reservist)

        // 2. Send OTP via custom Next.js Backend
        // Using 127.0.0.1 universally because we will use ADB reverse proxy for physical Android devices!
        final backendHost = 'https://nstp-connect.vercel.app';
        final response = await http.post(
          Uri.parse('$backendHost/api/send-otp'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email, 'otp': otp}),
        );

        if (response.statusCode == 200) {
          // 3. Navigate to OTPScreen with all pending user details
          if (mounted) {
            Navigator.pushReplacementNamed(
              context,
              '/otp',
              arguments: {
                'email': email,
                'password': password,
                'fullName': _fullNameController.text.trim(),
                'nstpComponent': _selectedComponent,
                'municipality': _selectedMunicipality ?? '',
                'barangay': _selectedBarangay ?? '',
                'mobileNumber': mobileNumber,
                'certificateImage': _certificateImage,
                'generatedOtp': otp,
              },
            );
          }
        } else {
          final resData = jsonDecode(response.body);
          setState(() {
            _errorMsg = 'Failed to send OTP: ${resData['error']}';
          });
        }
      } else {
        // Login
        final res = await supabase.auth.signInWithPassword(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
        if (res.user != null) {
          if (mounted) Navigator.pushReplacementNamed(context, '/home');
        }
      }
    } catch (e) {
      // Immediate System Feedback (Human Friendly)
      setState(() {
        if (e.toString().contains('Invalid login credentials')) {
          _errorMsg = 'Wrong email or password. Please try again.';
        } else {
          _errorMsg = 'Something went wrong. Please check your connection.';
        }
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Aesthetic Minimalism
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 60),
              // Strong Visual Hierarchy
              const Icon(Icons.volunteer_activism,
                  size: 80, color: Color(0xFF2563EB)),
              const SizedBox(height: 24),
              Text(
                'NSTP-CONNECT',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1E293B),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _isSignUp
                    ? 'Create your volunteer account'
                    : 'Welcome back, Volunteer!',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.black54),
              ),
              const SizedBox(height: 48),

              // Inputs (Affordances - obvious boundaries)
              if (_isSignUp) ...[
                TextField(
                  controller: _fullNameController,
                  decoration: InputDecoration(
                    labelText: 'Full Name',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16)),
                    prefixIcon: const Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _mobileNumberController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9+\-\s]')),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Mobile Number *',
                    hintText: '09XXXXXXXXX',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16)),
                    prefixIcon: const Icon(Icons.phone_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _selectedComponent,
                  decoration: InputDecoration(
                    labelText: 'NSTP Component',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16)),
                    prefixIcon: const Icon(Icons.class_outlined),
                  ),
                  items: ['CWTS', 'LTS', 'ROTC'].map((String value) {
                    return DropdownMenuItem<String>(
                        value: value, child: Text(value));
                  }).toList(),
                  onChanged: (newValue) {
                    setState(() {
                      _selectedComponent = newValue!;
                    });
                  },
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: _selectedMunicipality,
                        decoration: InputDecoration(
                          labelText: 'Municipality',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                          prefixIcon: const Icon(Icons.location_city),
                        ),
                        items: AGUSAN_DEL_SUR_LOCATIONS.keys.map((String value) {
                          return DropdownMenuItem<String>(value: value, child: Text(value));
                        }).toList(),
                        onChanged: (newValue) {
                          setState(() { 
                            _selectedMunicipality = newValue; 
                            _selectedBarangay = null; // Reset barangay
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: _selectedBarangay,
                        decoration: InputDecoration(
                          labelText: 'Barangay',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                          prefixIcon: const Icon(Icons.map_outlined),
                        ),
                        items: _selectedMunicipality == null 
                          ? [] 
                          : AGUSAN_DEL_SUR_LOCATIONS[_selectedMunicipality]!.map((String value) {
                              return DropdownMenuItem<String>(value: value, child: Text(value));
                            }).toList(),
                        onChanged: _selectedMunicipality == null ? null : (newValue) {
                          setState(() { _selectedBarangay = newValue; });
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Email Address',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16)),
                  prefixIcon: const Icon(Icons.email_outlined),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16)),
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                    onPressed: () {
                      setState(() {
                        _obscurePassword = !_obscurePassword;
                      });
                    },
                  ),
                ),
              ),

              if (_isSignUp) ...[
                const SizedBox(height: 16),
                TextField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  decoration: InputDecoration(
                    labelText: 'Confirm Password',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16)),
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility),
                      onPressed: () {
                        setState(() {
                          _obscureConfirmPassword = !_obscureConfirmPassword;
                        });
                      },
                    ),
                  ),
                ),
              ],

              if (_isSignUp) ...[
                const SizedBox(height: 16),
                // Certificate Picker
                InkWell(
                  onTap: _pickCertificate,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: _certificateImage != null
                          ? Colors.green.shade50
                          : Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: _certificateImage != null
                              ? Colors.green.shade200
                              : Colors.blue.shade200,
                          style: BorderStyle.solid),
                    ),
                    child: Column(
                      children: [
                        Icon(
                            _certificateImage != null
                                ? Icons.check_circle
                                : Icons.upload_file,
                            color: _certificateImage != null
                                ? Colors.green
                                : Colors.blue,
                            size: 32),
                        const SizedBox(height: 8),
                        Text(
                            _certificateImage != null
                                ? 'Image Selected'
                                : 'Upload NSTP Certificate (Optional)',
                            style: TextStyle(
                                color: _certificateImage != null
                                    ? Colors.green
                                    : Colors.blue,
                                fontWeight: FontWeight.bold)),
                        Text(
                            _certificateImage != null
                                ? 'Tap to change file'
                                : 'Tap to select file from gallery',
                            style: TextStyle(
                                fontSize: 12, color: Colors.blueGrey)),
                      ],
                    ),
                  ),
                ),
              ],

              if (_errorMsg.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text(_errorMsg,
                              style: const TextStyle(color: Colors.red))),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 32),

              // Giant Touch Target (Min 48px, but here we make it ~60px height)
              SizedBox(
                height: 60,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleAuth,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    elevation: 2,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 3),
                        )
                      : Text(
                          _isSignUp ? 'Sign Up' : 'Login',
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                ),
              ),

              const SizedBox(height: 24),
              TextButton(
                onPressed: () {
                  setState(() {
                    _isSignUp = !_isSignUp;
                    _errorMsg = '';
                  });
                },
                child: Text(
                  _isSignUp
                      ? 'Already have an account? Login'
                      : 'New here? Create an account',
                  style: const TextStyle(fontSize: 16, color: Colors.black87),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
