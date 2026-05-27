import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';
import { supabase } from '@/services/supabase';

export default function AccountScreen() {
  const { user, profile, clientProfileId, logout } = useAuthStore();
  const router = useRouter();
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName]   = useState(profile?.full_name ?? '');
  const [saving, setSaving]       = useState(false);

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const displayName  = profile?.full_name ?? user?.email?.split('@')[0] ?? '?';
  const displayEmail = user?.email ?? '';
  const memberSince  = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  const menuItems = [
    { icon: 'person-outline'        as const, label: 'Edit Profile',   onPress: () => setEditModal(true) },
    { icon: 'notifications-outline' as const, label: 'Notifications',  onPress: () => {} },
    { icon: 'lock-closed-outline'   as const, label: 'Change Password', onPress: () => {} },
    { icon: 'help-circle-outline'   as const, label: 'Help & Support',  onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* Profile card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarTxt}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{displayEmail}</Text>
          {memberSince ? (
            <Text style={styles.since}>Member since {memberSince}</Text>
          ) : null}
        </Card>

        {/* Menu */}
        <Card style={styles.menuCard}>
          {menuItems.map((item, idx) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
                <Ionicons name={item.icon} size={20} color={colors.gray600} />
                <Text style={styles.menuTxt}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.gray300} />
              </TouchableOpacity>
              {idx < menuItems.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </Card>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.red500} />
          <Text style={styles.logoutTxt}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Maximum Fitness v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.gray400}
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={async () => {
                  if (!editName.trim()) return;
                  setSaving(true);
                  try {
                    // Update Supabase auth metadata
                    await supabase.auth.updateUser({
                      data: { full_name: editName.trim() },
                    });
                    // Update the profiles table row
                    await supabase
                      .from('profiles')
                      .update({ full_name: editName.trim() })
                      .eq('id', user?.id);
                    setEditModal(false);
                  } catch (err) {
                    Alert.alert('Error', 'Failed to update profile. Please try again.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { paddingBottom: spacing.xxxl },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },

  profileCard: { alignItems: 'center', marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.black, alignItems: 'center',
    justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarTxt: { color: colors.white, fontSize: fontSize.xxl, fontWeight: '700' },
  name:  { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  email: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  since: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },

  menuCard:  { marginHorizontal: spacing.xl, padding: 0, overflow: 'hidden', marginBottom: spacing.lg },
  menuItem:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md },
  menuTxt:   { flex: 1, fontSize: fontSize.md, color: colors.gray700 },
  divider:   { height: 1, backgroundColor: colors.gray100, marginLeft: spacing.xl + spacing.md + 20 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  logoutTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.red500 },
  version:   { textAlign: 'center', fontSize: fontSize.xs, color: colors.gray300, marginTop: spacing.lg },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:  { padding: spacing.xl },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black, marginBottom: spacing.lg,
  },
  saveBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});