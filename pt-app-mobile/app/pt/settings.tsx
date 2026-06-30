import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function SettingsScreen() {
  const { user, profile, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            // Fire and forget — state clears synchronously in logout()
            // then we navigate immediately
            logout().catch(console.error);
            // Navigate straight away — state is already cleared
            router.replace('/login');
          },
        },
      ],
      { cancelable: true }
    );
  };

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'PT';

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

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.red500} />
          <Text style={styles.logoutTxt}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          💡 To test the client view, log out and sign in with a client account.
        </Text>

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
  roleText:   { color: colors.white, fontSize: fontSize.xs, fontWeight: '600' },

  infoCard:   { marginBottom: spacing.lg, padding: spacing.lg },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoLabel:  { fontSize: fontSize.md, color: colors.gray700, flex: 1 },
  infoValue:  { fontSize: fontSize.sm, color: colors.gray400 },

  logoutBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
    backgroundColor: colors.red50, borderRadius: borderRadius.sm,
    marginBottom: spacing.lg,
  },
  logoutTxt:  { fontSize: fontSize.md, fontWeight: '600', color: colors.red500 },

  hint: {
    fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center',
    backgroundColor: colors.gray100, padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.lg,
    lineHeight: 20,
  },
  version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.gray300 },
});