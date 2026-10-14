import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../main.dart'; // supabase instance
import '../utils/locations.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _userProfile;

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    try {
      final user = supabase.auth.currentUser;
      if (user != null) {
        final data = await supabase
            .from('users')
            .select()
            .eq('id', user.id)
            .single();

        if (mounted) {
          setState(() {
            _userProfile = data;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleLogout() async {
    await supabase.auth.signOut();
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  void _showEditProfileModal() {
    final formKey = GlobalKey<FormState>();
    String name = _userProfile!['full_name'] ?? '';
    String mobile = _userProfile!['mobile_number'] ?? '';
    final mobileController = TextEditingController(text: mobile);
    String component = _userProfile!['nstp_component'] ?? 'CWTS';
    String? selectedMunicipality = _userProfile!['municipality'];
    String? selectedBarangay = _userProfile!['barangay'];
    
    // Ensure valid municipality
    if (selectedMunicipality != null && !AGUSAN_DEL_SUR_LOCATIONS.containsKey(selectedMunicipality)) {
      selectedMunicipality = null;
      selectedBarangay = null;
    }
    
    // Ensure valid barangay
    if (selectedMunicipality != null && selectedBarangay != null) {
      if (!AGUSAN_DEL_SUR_LOCATIONS[selectedMunicipality]!.contains(selectedBarangay)) {
        selectedBarangay = null;
      }
    }

    bool isUpdating = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
                left: 24, right: 24, top: 24
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Form(
                  key: formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Edit Profile', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 24),
                      
                      TextFormField(
                        initialValue: name,
                        decoration: const InputDecoration(labelText: 'Full Name', border: OutlineInputBorder()),
                        validator: (v) => v!.isEmpty ? 'Required' : null,
                        onSaved: (v) => name = v!,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: mobileController,
                        keyboardType: TextInputType.phone,
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9+\-\s]')),
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Mobile Number',
                          hintText: '09XXXXXXXXX',
                          border: OutlineInputBorder(),
                        ),
                        onSaved: (v) => mobile = v!.trim(),
                      ),
                      const SizedBox(height: 16),
                      
                      DropdownButtonFormField<String>(
                        value: ['CWTS', 'LTS', 'ROTC'].contains(component) ? component : null,
                        decoration: const InputDecoration(labelText: 'NSTP Component', border: OutlineInputBorder()),
                        items: ['CWTS', 'LTS', 'ROTC'].map((String val) {
                          return DropdownMenuItem(value: val, child: Text(val));
                        }).toList(),
                        onChanged: (val) => setModalState(() => component = val!),
                        onSaved: (v) => component = v!,
                      ),
                      const SizedBox(height: 16),
                      
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: selectedMunicipality,
                        decoration: const InputDecoration(labelText: 'Municipality', border: OutlineInputBorder()),
                        items: AGUSAN_DEL_SUR_LOCATIONS.keys.map((String val) {
                          return DropdownMenuItem(value: val, child: Text(val));
                        }).toList(),
                        onChanged: (val) {
                          setModalState(() {
                            selectedMunicipality = val;
                            selectedBarangay = null;
                          });
                        },
                      ),
                      const SizedBox(height: 16),
                      
                      DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: selectedBarangay,
                        decoration: const InputDecoration(labelText: 'Barangay', border: OutlineInputBorder()),
                        items: selectedMunicipality == null 
                            ? [] 
                            : AGUSAN_DEL_SUR_LOCATIONS[selectedMunicipality]!.map((String val) {
                                return DropdownMenuItem(value: val, child: Text(val));
                              }).toList(),
                        onChanged: (val) => setModalState(() => selectedBarangay = val),
                      ),
                      
                      const SizedBox(height: 32),
                      SizedBox(
                        height: 50,
                        child: ElevatedButton(
                          onPressed: isUpdating ? null : () async {
                            if (formKey.currentState!.validate()) {
                              formKey.currentState!.save();
                              setModalState(() => isUpdating = true);
                              try {
                                await supabase.from('users').update({
                                  'full_name': name,
                                  'mobile_number': mobile,
                                  'nstp_component': component,
                                  'municipality': selectedMunicipality,
                                  'barangay': selectedBarangay,
                                }).eq('id', supabase.auth.currentUser!.id);
                                
                                if (!context.mounted) return;
                                Navigator.pop(context);
                                _fetchProfile(); // Refresh data
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Profile updated successfully!'), backgroundColor: Colors.green)
                                );
                              } catch (e) {
                                if (!context.mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red)
                                );
                                setModalState(() => isUpdating = false);
                              }
                            }
                          },
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.blue.shade600),
                          child: isUpdating 
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text('Save Changes', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            );
          }
        );
      }
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_userProfile == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Could not load profile.'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _handleLogout,
              child: const Text('Log Out'),
            )
          ],
        ),
      );
    }

    final isVerified = _userProfile!['is_verified'] ?? false;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('My Profile', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit, color: Colors.blue),
            onPressed: _showEditProfileModal,
            tooltip: 'Edit Profile',
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.red),
            onPressed: _handleLogout,
            tooltip: 'Log Out',
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const SizedBox(height: 24),
            // Avatar Placeholder
            CircleAvatar(
              radius: 50,
              backgroundColor: Colors.blue.shade100,
              child: Text(
                (_userProfile!['full_name'] ?? 'V')[0].toUpperCase(),
                style: TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: Colors.blue.shade800),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _userProfile!['full_name'] ?? 'Volunteer',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isVerified ? Colors.green.shade50 : Colors.yellow.shade50,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isVerified ? Colors.green.shade200 : Colors.yellow.shade200),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isVerified ? Icons.check_circle : Icons.pending,
                    color: isVerified ? Colors.green : Colors.yellow.shade800,
                    size: 16,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    isVerified ? 'Verified Volunteer' : 'Pending Verification',
                    style: TextStyle(
                      color: isVerified ? Colors.green.shade700 : Colors.yellow.shade800,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 48),

            // Details List
            _buildProfileItem(Icons.email_outlined, 'Email', _userProfile!['email']),
            const Divider(),
            _buildProfileItem(Icons.phone_outlined, 'Mobile Number', _userProfile!['mobile_number'] ?? 'Not set'),
            const Divider(),
            _buildProfileItem(Icons.class_outlined, 'NSTP Component', _userProfile!['nstp_component'] ?? 'Not set'),
            const Divider(),
            _buildProfileItem(Icons.location_city, 'Municipality', _userProfile!['municipality'] ?? 'Not set'),
            const Divider(),
            _buildProfileItem(Icons.map_outlined, 'Barangay', _userProfile!['barangay'] ?? 'Not set'),
            
            const SizedBox(height: 48),
            
            // Large Logout Button for easy tapping
            SizedBox(
              width: double.infinity,
              height: 56,
              child: OutlinedButton.icon(
                onPressed: _handleLogout,
                icon: const Icon(Icons.logout, color: Colors.red),
                label: const Text('Log Out', style: TextStyle(color: Colors.red, fontSize: 16, fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.red),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildProfileItem(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16.0),
      child: Row(
        children: [
          Icon(icon, color: Colors.grey.shade600),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
