import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import API from '@/services/api';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';
import { supabase } from '@/services/supabase';

export default function AccountScreen() {
  const { user, profile, logout } = useAuthStore();

  // ── Session pack state ──
  const [activePack, setActivePack]   = useState<any>(null);
  const [loadingPack, setLoadingPack] = useState(true);

  // ── Logout state ──
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut,       setLoggingOut]       = useState(false);

  // ── Edit name modal ──
  const [editModal,   setEditModal]   = useState(false);
  const [editName,    setEditName]    = useState(profile?.name ?? profile?.full_name ?? '');
  const [savingName,  setSavingName]  = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  // ── Change password modal ──
  const [pwModal,   setPwModal]   = useState(false);
  const [pw1,       setPw1]       = useState('');
  const [pw2,       setPw2]       = useState('');
  const [pwError,   setPwError]   = useState('');
  const [savingPw,  setSavingPw]  = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw1,   setShowPw1]   = useState(false);
  const [showPw2,   setShowPw2]   = useState(false);

  useEffect(() => {
    loadSessionPack();
  }, []);

  const loadSessionPack = async () => {
    try {
      const res = await API.get('/payments/session-packs');
      const packs: any[] = res.data;
      const active = packs.find((p) => p.status === 'active') ?? packs[0] ?? null;
      setActivePack(active);
    } catch (err) {
      console.error('loadSessionPack:', err);
    } finally {
      setLoadingPack(false);
    }
  };

  // ── Stripe placeholder handler ──
  // TODO: Replace URL below with your actual Stripe payment / checkout link
  const handleStripePayment = () => {
    // const stripeUrl = 'https://buy.stripe.com/YOUR_LINK_HERE';
    // Linking.openURL(stripeUrl);
  };

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

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSavingName(true);
    try {
      await supabase.auth.updateUser({ data: { full_name: editName.trim() } });
      setNameSuccess(true);
      setTimeout(() => { setNameSuccess(false); setEditModal(false); }, 1500);
    } catch (err) {
      console.error('Profile update error:', err);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    if (pw1.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    if (pw1 !== pw2)    { setPwError('Passwords do not match'); return; }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) { setPwError(error.message); return; }
      setPwSuccess(true);
      setPw1(''); setPw2('');
      setTimeout(() => { setPwSuccess(false); setPwModal(false); }, 2000);
    } catch (err: any) {
      setPwError(err.message ?? 'Something went wrong');
    } finally {
      setSavingPw(false);
    }
  };

  const displayName  = profile?.name ?? profile?.full_name ?? user?.email?.split('@')[0] ?? '?';
  const displayEmail = user?.email ?? '';
  const memberSince  = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  const sessionsRemaining = activePack?.sessions_remaining ?? null;
  const totalSessions     = activePack?.total_sessions ?? null;
  const packName          = activePack?.pack_name ?? null;
  const packStatus        = activePack?.status ?? null;
  const packExpiry        = activePack?.expires_at
    ? new Date(activePack.expires_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  const sessionBarWidth =
    sessionsRemaining != null && totalSessions != null && totalSessions > 0
      ? `${Math.max((sessionsRemaining / totalSessions) * 100, 0)}%`
      : '0%';

  const sessionBarColor =
    sessionsRemaining === 0    ? colors.red500
    : sessionsRemaining <= 2   ? '#F59E0B'
    : colors.black;

  const menuItems = [
    {
      icon: 'person-outline' as const,
      label: 'Edit Profile',
      onPress: () => { setEditName(profile?.name ?? profile?.full_name ?? ''); setEditModal(true); },
    },
    {
      icon: 'lock-closed-outline' as const,
      label: 'Change Password',
      onPress: () => { setPw1(''); setPw2(''); setPwError(''); setPwSuccess(false); setPwModal(true); },
    },
    { icon: 'notifications-outline' as const, label: 'Notifications', onPress: () => {} },
    { icon: 'help-circle-outline'   as const, label: 'Help & Support', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
        </View>

        {/* ── Profile card ── */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarTxt}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{displayEmail}</Text>
          {memberSince && <Text style={styles.since}>Member since {memberSince}</Text>}
        </Card>

        {/* ── Session Plan card ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelTxt}>SESSION PLAN</Text>
        </View>

        <Card style={styles.sessionCard}>
          {loadingPack ? (
            <ActivityIndicator color={colors.black} />
          ) : activePack ? (
            <>
              {/* Pack name + status chip */}
              <View style={styles.sessionTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.packName}>{packName}</Text>
                  {packExpiry && <Text style={styles.packExpiry}>Expires {packExpiry}</Text>}
                </View>
                <View style={[
                  styles.statusChip,
                  packStatus === 'active'    ? styles.statusActive
                  : packStatus === 'exhausted' ? styles.statusDanger
                  : styles.statusInactive,
                ]}>
                  <Text style={[
                    styles.statusChipTxt,
                    packStatus === 'active'    ? styles.statusActiveTxt
                    : packStatus === 'exhausted' ? styles.statusDangerTxt
                    : styles.statusInactiveTxt,
                  ]}>
                    {packStatus}
                  </Text>
                </View>
              </View>

              {/* Sessions remaining counter */}
              <View style={styles.sessionCountRow}>
                <Text style={[styles.sessionCount, { color: sessionBarColor }]}>
                  {sessionsRemaining}
                </Text>
                <Text style={styles.sessionCountOf}>/{totalSessions} sessions remaining</Text>
              </View>

              {/* Progress bar */}
              <View style={styles.sessionBar}>
                <View style={[
                  styles.sessionBarFill,
                  { width: sessionBarWidth as any, backgroundColor: sessionBarColor },
                ]} />
              </View>

              {sessionsRemaining === 0 && (
                <View style={styles.exhaustedBanner}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.red700} />
                  <Text style={styles.exhaustedTxt}>
                    You've used all your sessions. Purchase a new pack below.
                  </Text>
                </View>
              )}
              {sessionsRemaining !== null && sessionsRemaining <= 2 && sessionsRemaining > 0 && (
                <View style={styles.lowBanner}>
                  <Ionicons name="warning-outline" size={15} color="#92400E" />
                  <Text style={styles.lowTxt}>
                    Only {sessionsRemaining} session{sessionsRemaining !== 1 ? 's' : ''} left — consider topping up soon.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.stripeBtn}
                onPress={handleStripePayment}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={18} color={colors.white} />
                <Text style={styles.stripeBtnTxt}>Buy More Sessions</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.noPackWrap}>
                <Ionicons name="wallet-outline" size={36} color={colors.gray300} />
                <Text style={styles.noPackTitle}>No session plan found</Text>
                <Text style={styles.noPackText}>
                  Contact your trainer to set up a session pack, or purchase one below.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stripeBtn}
                onPress={handleStripePayment}
                activeOpacity={0.8}
              >
                <Ionicons name="card-outline" size={18} color={colors.white} />
                <Text style={styles.stripeBtnTxt}>Purchase Sessions</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* ── Settings menu ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelTxt}>SETTINGS</Text>
        </View>

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

        {/* ── Logout ── */}
        {!confirmingLogout ? (
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setConfirmingLogout(true)}>
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

      {/* ── Edit Profile Modal ── */}
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
                autoFocus
              />
              {nameSuccess && (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.green700} />
                  <Text style={styles.successTxt}>Name updated!</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, (savingName || nameSuccess) && { opacity: 0.7 }]}
                onPress={handleSaveName}
                disabled={savingName || nameSuccess}
              >
                {savingName
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Change Password Modal ── */}
      <Modal visible={pwModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPwModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {pwSuccess ? (
                <View style={styles.pwSuccessBox}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.green700} />
                  <Text style={styles.pwSuccessTitle}>Password updated!</Text>
                  <Text style={styles.pwSuccessSub}>Your new password is now active.</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>New Password</Text>
                  <View style={styles.pwInputRow}>
                    <TextInput
                      style={styles.pwInput}
                      value={pw1}
                      onChangeText={(v) => { setPw1(v); setPwError(''); }}
                      placeholder="At least 8 characters"
                      placeholderTextColor={colors.gray400}
                      secureTextEntry={!showPw1}
                      autoFocus
                    />
                    <TouchableOpacity style={styles.pwToggle} onPress={() => setShowPw1(v => !v)}>
                      <Ionicons name={showPw1 ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.gray400} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Confirm Password</Text>
                  <View style={styles.pwInputRow}>
                    <TextInput
                      style={styles.pwInput}
                      value={pw2}
                      onChangeText={(v) => { setPw2(v); setPwError(''); }}
                      placeholder="Re-enter your new password"
                      placeholderTextColor={colors.gray400}
                      secureTextEntry={!showPw2}
                    />
                    <TouchableOpacity style={styles.pwToggle} onPress={() => setShowPw2(v => !v)}>
                      <Ionicons name={showPw2 ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.gray400} />
                    </TouchableOpacity>
                  </View>

                  {pw1.length > 0 && pw1.length < 8 && (
                    <Text style={styles.hintTxt}>{8 - pw1.length} more character{8 - pw1.length !== 1 ? 's' : ''} needed</Text>
                  )}
                  {pw1.length >= 8 && pw2.length > 0 && pw1 !== pw2 && (
                    <Text style={styles.hintTxtError}>Passwords don't match</Text>
                  )}
                  {pw1.length >= 8 && pw2.length >= 8 && pw1 === pw2 && (
                    <Text style={styles.hintTxtOk}>✓ Passwords match</Text>
                  )}

                  {pwError ? (
                    <View style={styles.pwErrorBox}>
                      <Ionicons name="alert-circle-outline" size={16} color={colors.red700} />
                      <Text style={styles.pwErrorTxt}>{pwError}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { marginTop: spacing.xl },
                      (savingPw || pw1 !== pw2 || pw1.length < 8) && { opacity: 0.5 },
                    ]}
                    onPress={handleChangePassword}
                    disabled={savingPw || pw1 !== pw2 || pw1.length < 8}
                  >
                    {savingPw
                      ? <ActivityIndicator color={colors.white} />
                      : <Text style={styles.saveBtnTxt}>Update Password</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll:    { paddingBottom: spacing.xxxl },
  header:    { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title:     { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },

  profileCard: { alignItems: 'center', marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  avatarTxt: { color: colors.white, fontSize: fontSize.xxl, fontWeight: '700' },
  name:      { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  email:     { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  since:     { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },

  sectionLabel: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  sectionLabelTxt: {
    fontSize: fontSize.xs, fontWeight: '700',
    color: colors.gray400, letterSpacing: 0.8,
  },

  // Session plan card
  sessionCard: { marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  sessionTopRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg,
  },
  packName:   { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  packExpiry: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  statusChip: {
    paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, borderRadius: borderRadius.full,
  },
  statusActive:      { backgroundColor: '#D1FAE5' },
  statusDanger:      { backgroundColor: colors.red50 },
  statusInactive:    { backgroundColor: colors.gray100 },
  statusChipTxt:     { fontSize: fontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
  statusActiveTxt:   { color: '#065F46' },
  statusDangerTxt:   { color: colors.red700 },
  statusInactiveTxt: { color: colors.gray500 },

  sessionCountRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: spacing.sm,
  },
  sessionCount:   { fontSize: 40, fontWeight: '800', lineHeight: 44 },
  sessionCountOf: { fontSize: fontSize.sm, color: colors.gray500, marginBottom: 6 },
  sessionBar: {
    height: 8, backgroundColor: colors.gray100,
    borderRadius: 4, overflow: 'hidden', marginBottom: spacing.md,
  },
  sessionBarFill: { height: '100%', borderRadius: 4 },

  exhaustedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.red50, padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  exhaustedTxt: { flex: 1, fontSize: fontSize.xs, color: colors.red700, lineHeight: 18 },
  lowBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: '#FFFBEB', padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  lowTxt: { flex: 1, fontSize: fontSize.xs, color: '#92400E', lineHeight: 18 },

  stripeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.black,
    borderRadius: borderRadius.sm, paddingVertical: spacing.md + 2, marginTop: spacing.sm,
  },
  stripeBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },

  noPackWrap: {
    alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm,
  },
  noPackTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray600 },
  noPackText: {
    fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center', lineHeight: 20,
  },

  // Menu card
  menuCard: {
    marginHorizontal: spacing.xl, padding: 0, overflow: 'hidden', marginBottom: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md,
  },
  menuTxt:  { flex: 1, fontSize: fontSize.md, color: colors.gray700 },
  divider:  { height: 1, backgroundColor: colors.gray100 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.lg,
    backgroundColor: colors.red50, borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.lg,
  },
  logoutTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.red500 },
  confirmBox: {
    backgroundColor: colors.red50, borderRadius: borderRadius.sm,
    padding: spacing.xl, marginHorizontal: spacing.xl, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.red500 + '40',
  },
  confirmText: {
    fontSize: fontSize.md, fontWeight: '500', color: colors.gray800,
    textAlign: 'center', marginBottom: spacing.lg,
  },
  confirmBtns:         { flexDirection: 'row', gap: spacing.md },
  cancelBtn:           { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1.5, borderColor: colors.gray300, alignItems: 'center' },
  cancelBtnTxt:        { fontSize: fontSize.md, fontWeight: '500', color: colors.gray700 },
  confirmLogoutBtn:    { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.red500, alignItems: 'center' },
  confirmLogoutBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },

  version: { textAlign: 'center', fontSize: fontSize.xs, color: colors.gray300, marginTop: spacing.lg },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:   { padding: spacing.xl },
  fieldLabel:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black, marginBottom: spacing.lg,
  },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.green50, padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  successTxt: { fontSize: fontSize.sm, color: colors.green700, fontWeight: '500' },
  saveBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  pwInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    paddingRight: spacing.md, marginBottom: spacing.xs,
  },
  pwInput:  { flex: 1, padding: spacing.md, fontSize: fontSize.md, color: colors.black },
  pwToggle: { padding: spacing.xs },
  hintTxt:       { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.xs },
  hintTxtError:  { fontSize: fontSize.xs, color: colors.red500, marginBottom: spacing.xs },
  hintTxtOk:     { fontSize: fontSize.xs, color: colors.green700, marginBottom: spacing.xs },
  pwErrorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.red50, padding: spacing.md,
    borderRadius: borderRadius.sm, marginTop: spacing.md,
  },
  pwErrorTxt:     { fontSize: fontSize.sm, color: colors.red700, flex: 1 },
  pwSuccessBox:   { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  pwSuccessTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  pwSuccessSub:   { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center' },
});