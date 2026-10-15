import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:image_picker/image_picker.dart';
import '../main.dart'; // for supabase instance

class OTPScreen extends StatefulWidget {
  const OTPScreen({super.key});

  @override
  State<OTPScreen> createState() => _OTPScreenState();
}

class _OTPScreenState extends State<OTPScreen> {
  final _otpController = TextEditingController();
  bool _isLoading = false;
  String _errorMsg = '';

  Future<void> _verifyOTP() async {
    setState(() {
      _isLoading = true;
      _errorMsg = '';
    });

    final args = ModalRoute.of(context)!.settings.arguments as Map<String, dynamic>?;
    if (args == null) {
      setState(() {
        _errorMsg = 'Missing arguments. Please try signing up again.';
        _isLoading = false;
      });
      return;
    }

    final email = args['email'] as String;
    final password = args['password'] as String;
    final fullName = args['fullName'] as String;
    final nstpComponent = args['nstpComponent'] as String;
    final municipality = args['municipality'] as String;
    final barangay = args['barangay'] as String;
    final certificateImage = args['certificateImage'] as XFile?;
    final generatedOtp = args['generatedOtp'] as String;
    final mobileNumber = args['mobileNumber'] as String? ?? '';

    try {
      // 1. Verify Custom OTP
      if (_otpController.text.trim() != generatedOtp) {
        setState(() {
          _errorMsg = 'Invalid verification code.';
        });
        return;
      }

      // 2. Custom OTP matched! Now we actually create the account in Supabase
      final res = await supabase.auth.signUp(
        email: email,
        password: password,
        data: {
          'full_name': fullName,
          'nstp_component': nstpComponent,
          'municipality': municipality,
          'barangay': barangay,
          'mobile_number': mobileNumber,
        },
      );

      if (res.user != null) {
        // CRITICAL CHECK: If Confirm Email is still enabled in Supabase, the session will be null!
        if (res.session == null) {
           setState(() {
             _errorMsg = 'Supabase Blocked Login! You MUST turn OFF "Confirm email" in Supabase -> Authentication -> Providers -> Email.';
           });
           return;
        }

        // Now that the user is fully created and logged in, we upload the certificate!
        if (certificateImage != null) {
          try {
            final extension = certificateImage.name.split('.').last.toLowerCase();
            final fileName = '${res.user!.id}_certificate.$extension';
            final fileBytes = await certificateImage.readAsBytes();
            
            String mimeType = 'image/jpeg';
            if (extension == 'png') mimeType = 'image/png';
            if (extension == 'webp') mimeType = 'image/webp';

            await supabase.storage.from('certificates').uploadBinary(
              fileName, 
              fileBytes,
              fileOptions: FileOptions(contentType: mimeType, upsert: true),
            );
            final publicUrl = supabase.storage.from('certificates').getPublicUrl(fileName);
            
            // Update user profile in database
            try {
              await supabase.from('users').update({
                'certificate_url': publicUrl,
                'mobile_number': mobileNumber,
              }).eq('id', res.user!.id);
            } catch (updateErr) {
              final errStr = updateErr.toString();
              if (errStr.contains('mobile_number') || errStr.contains('PGRST204')) {
                await supabase.from('users').update({
                  'certificate_url': publicUrl,
                }).eq('id', res.user!.id);
              } else {
                debugPrint('User profile update error: $updateErr');
              }
            }
          } catch (uploadError) {
            debugPrint('Upload error: $uploadError');
          }
        } else {
          // If no certificate was uploaded, try to save mobile_number safely
          try {
            await supabase.from('users').update({
              'mobile_number': mobileNumber,
            }).eq('id', res.user!.id);
          } catch (updateErr) {
            debugPrint('Mobile number update deferred: $updateErr');
          }
        }
        
        // Success!
        if (mounted) Navigator.pushReplacementNamed(context, '/home');
      } else {
        setState(() {
          _errorMsg = 'Failed to create account.';
        });
      }
    } catch (e) {
      final errStr = e.toString();
      String message = 'Registration failed: $e';
      if (errStr.contains('Database error saving new user') || errStr.contains('unexpected_failure')) {
        message = 'Database trigger error: Please execute the SQL migration script in your Supabase SQL Editor to complete setting up the mobile_number column.';
      }
      setState(() {
        _errorMsg = message;
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
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Verify Email', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.mark_email_unread, size: 80, color: Color(0xFF2563EB)),
              const SizedBox(height: 24),
              const Text(
                'Check your email',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.black87),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'We sent a 6-digit verification code to your email address. Enter it below to complete registration.',
                style: TextStyle(fontSize: 16, color: Colors.grey.shade600, height: 1.5),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              // OTP Input
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 32, letterSpacing: 8, fontWeight: FontWeight.bold),
                maxLength: 6,
                decoration: InputDecoration(
                  hintText: '000000',
                  counterText: '',
                  filled: true,
                  fillColor: Colors.grey.shade50,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: Colors.grey.shade300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: Color(0xFF2563EB), width: 2),
                  ),
                ),
              ),
              
              if (_errorMsg.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    _errorMsg,
                    style: TextStyle(color: Colors.red.shade700, fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
              
              const SizedBox(height: 32),
              
              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _verifyOTP,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : const Text(
                          'Verify & Continue',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
