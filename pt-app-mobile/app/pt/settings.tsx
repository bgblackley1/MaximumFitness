import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function SettingsScreen() {
  const { user, profile, logout } = useAuthStore();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'PT';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setLoggingOut(false);
      setConfirmingLogout(false);
    }
  };

  const menuItems = [
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Privacy Policy',
      onPress: () => Linking.openURL('https://maximumfitnessglasgow.com/privacy.html'),
    },
    {
      icon: 'trash-outline' as const,
      label: 'Delete My Data',
      onPress: () => Linking.openURL('https://maximumfitnessglasgow.com/data-deletion.html'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>Personal Trainer</Text>
          </View>
        </Card>

        {/* Account info */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={20} color={colors.gray500} />
            <Text style={styles.infoLabel}>Account</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
        </Card>

        {/* Legal links */}
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
        {!confirmingLogout ? (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => setConfirmingLogout(true)}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.red500} />
            <Text style={styles.logoutTxt}>Log out</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>Are you sure you want to log out?</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmingLogout(false)}
                disabled={loggingOut}
              >
                <Text style={styles.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmLogoutBtn, loggingOut && { opacity: 0.6 }]}
                onPress={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.confirmLogoutBtnTxt}>Log out</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.version}>Maximum Fitness v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.gray50 },
  scroll:      { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title:       { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black, marginBottom: spacing.xl },

  profileCard: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarTxt:  { color: colors.white, fontSize: fontSize.xxl, fontWeight: '700' },
  name:       { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  email:      { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  roleBadge: {
    marginTop: spacing.sm, backgroundColor: colors.black,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  roleText: { color: colors.white, fontSize: fontSize.xs, fontWeight: '600' },

  infoCard:   { marginBottom: spacing.lg, padding: spacing.lg },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoLabel:  { fontSize: fontSize.md, color: colors.gray700, flex: 1 },
  infoValue:  { fontSize: fontSize.sm, color: colors.gray400 },

  menuCard:   { marginBottom: spacing.lg, padding: 0, overflow: 'hidden' },
  menuItem:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md },
  menuTxt:    { flex: 1, fontSize: fontSize.md, color: colors.gray700 },
  divider:    { height: 1, backgroundColor: colors.gray100 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
    backgroundColor: colors.red50, borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
  },
  logoutTxt:  { fontSize: fontSize.md, fontWeight: '600', color: colors.red500 },

  confirmBox: {
    backgroundColor: colors.red50, borderRadius: borderRadius.sm,
    padding: spacing.xl, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.red500 + '40',
  },
  confirmText: {
    fontSize: fontSize.md, fontWeight: '500', color: colors.gray800,
    textAlign: 'center', marginBottom: spacing.lg,
  },
  confirmBtns: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray300, alignItems: 'center',
  },
  cancelBtnTxt: { fontSize: fontSize.md, fontWeight: '500', color: colors.gray700 },
  confirmLogoutBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    backgroundColor: colors.red500, alignItems: 'center',
  },
  confirmLogoutBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },

  version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.gray300 },
});