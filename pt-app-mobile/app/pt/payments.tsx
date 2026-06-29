import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

type Tab = 'packs' | 'invoices';

const PRESET_PACKS = [
  { label: '5 Sessions',  sessions: 5  },
  { label: '10 Sessions', sessions: 10 },
  { label: '20 Sessions', sessions: 20 },
];

export default function PaymentsScreen() {
  const [activeTab, setActiveTab]         = useState<Tab>('packs');
  const [packs, setPacks]                 = useState<any[]>([]);
  const [invoices, setInvoices]           = useState<any[]>([]);
  const [clients, setClients]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New pack modal
  const [newPackModal, setNewPackModal] = useState(false);
  const [packForm, setPackForm] = useState({
    client_id:    '',
    pack_name:    '',
    total_sessions: 10,
    price_pence:  '',
    notes:        '',
  });
  const [savingPack, setSavingPack] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [pR, iR, cR] = await Promise.allSettled([
        API.get('/payments/session-packs'),
        API.get('/payments/invoices'),
        API.get('/clients'),
      ]);
      if (pR.status === 'fulfilled') setPacks(pR.value.data);
      if (iR.status === 'fulfilled') setInvoices(iR.value.data);
      if (cR.status === 'fulfilled') setClients(cR.value.data);
    } catch (e) {
      console.error('payments loadAll:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleUseSession = (pack: any) => {
    if (pack.sessions_remaining <= 0) {
      Alert.alert('No sessions remaining', 'This pack is exhausted.');
      return;
    }
    Alert.alert(
      'Use 1 Session',
      `Mark 1 session as used for ${clientName(pack.client_id)}?\n${pack.sessions_remaining - 1} will remain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionLoading(pack.id);
            try {
              const res = await API.put(`/payments/session-packs/${pack.id}/adjust`, {
                adjustment: -1,
                reason: 'Session used',
              });
              setPacks((prev) => prev.map((p) => p.id === pack.id ? res.data : p));
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail ?? 'Failed');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleAddSession = (pack: any) => {
    Alert.alert(
      'Add 1 Session',
      `Add 1 bonus session to ${clientName(pack.client_id)}'s pack?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            setActionLoading(pack.id);
            try {
              const res = await API.put(`/payments/session-packs/${pack.id}/adjust`, {
                adjustment: 1,
                reason: 'Bonus session added',
              });
              setPacks((prev) => prev.map((p) => p.id === pack.id ? res.data : p));
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail ?? 'Failed');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelPack = (packId: string) => {
    Alert.alert('Cancel Pack', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Pack',
        style: 'destructive',
        onPress: async () => {
          try {
            await API.delete(`/payments/session-packs/${packId}`);
            setPacks((prev) => prev.map((p) => p.id === packId ? { ...p, status: 'cancelled' } : p));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail ?? 'Failed');
          }
        },
      },
    ]);
  };

  const handleCreatePack = async () => {
    if (!packForm.client_id || !packForm.pack_name || !packForm.price_pence) {
      Alert.alert('Missing fields', 'Client, pack name, and price are required.');
      return;
    }
    setSavingPack(true);
    try {
      const res = await API.post('/payments/session-packs', {
        client_id:       packForm.client_id,
        pack_name:       packForm.pack_name,
        total_sessions:  packForm.total_sessions,
        price_paid_pence: parseInt(packForm.price_pence) * 100, // £ → pence
        notes:           packForm.notes || null,
      });
      setPacks((prev) => [res.data, ...prev]);
      setNewPackModal(false);
      setPackForm({ client_id: '', pack_name: '', total_sessions: 10, price_pence: '', notes: '' });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail ?? 'Failed to create pack');
    } finally {
      setSavingPack(false);
    }
  };

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Unknown';

  const fmtMoney = (pence: number) =>
    `£${(pence / 100).toFixed(2)}`;

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusVariant = (s: string) =>
    s === 'active'    ? 'active'
    : s === 'exhausted'? 'inactive'
    : 'danger';

  // Stats
  const activePacks   = packs.filter((p) => p.status === 'active');
  const totalSessions = activePacks.reduce((s, p) => s + p.sessions_remaining, 0);
  const totalRevenue  = invoices.reduce((s, i) => s + i.amount_pence, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>Session pack management</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setNewPackModal(true)}>
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{activePacks.length}</Text>
          <Text style={styles.statLabel}>Active{'\n'}Packs</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{totalSessions}</Text>
          <Text style={styles.statLabel}>Sessions{'\n'}Remaining</Text>
        </View>
        <View style={[styles.statCard, { flex: 2 }]}>
          <Text style={styles.statVal}>{fmtMoney(totalRevenue)}</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['packs', 'invoices'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtActive]}>
              {t === 'packs'
                ? `Session Packs (${packs.length})`
                : `Invoices (${invoices.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── SESSION PACKS ── */}
        {activeTab === 'packs' && (
          packs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="wallet-outline" size={48} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No session packs yet</Text>
              <Text style={styles.emptyText}>Tap + to create a session pack for a client.</Text>
            </View>
          ) : (
            packs.map((pack) => {
              const busy = actionLoading === pack.id;
              const pct  = pack.total_sessions > 0
                ? (pack.sessions_remaining / pack.total_sessions) * 100
                : 0;
              return (
                <Card key={pack.id} style={styles.packCard}>
                  {/* Header row */}
                  <View style={styles.packHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packClient}>{clientName(pack.client_id)}</Text>
                      <Text style={styles.packName}>{pack.pack_name}</Text>
                    </View>
                    <Badge
                      label={pack.status}
                      variant={statusVariant(pack.status)}
                    />
                  </View>

                  {/* Sessions counter */}
                  <View style={styles.sessionCounter}>
                    <View style={styles.sessionNumbers}>
                      <Text style={styles.sessionRemaining}>{pack.sessions_remaining}</Text>
                      <Text style={styles.sessionTotal}> / {pack.total_sessions} sessions</Text>
                    </View>
                    <Text style={styles.sessionPaid}>
                      {fmtMoney(pack.price_paid_pence)} paid
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%` as any },
                        pct <= 20 && { backgroundColor: colors.red500 },
                        pct > 20 && pct <= 50 && { backgroundColor: '#F59E0B' },
                      ]}
                    />
                  </View>

                  {pack.notes ? (
                    <Text style={styles.packNotes}>{pack.notes}</Text>
                  ) : null}

                  {/* Actions */}
                  {pack.status !== 'cancelled' && (
                    busy ? (
                      <ActivityIndicator color={colors.black} style={{ marginTop: spacing.md }} />
                    ) : (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={[styles.actionBtn, pack.sessions_remaining === 0 && styles.actionBtnDisabled]}
                          onPress={() => handleUseSession(pack)}
                          disabled={pack.sessions_remaining === 0}
                        >
                          <Ionicons name="remove-circle-outline" size={16} color={colors.gray600} />
                          <Text style={styles.actionBtnTxt}>Use Session</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.green50 }]}
                          onPress={() => handleAddSession(pack)}
                        >
                          <Ionicons name="add-circle-outline" size={16} color={colors.green700} />
                          <Text style={[styles.actionBtnTxt, { color: colors.green700 }]}>Add Session</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnDanger]}
                          onPress={() => handleCancelPack(pack.id)}
                        >
                          <Ionicons name="close-circle-outline" size={16} color={colors.red700} />
                          <Text style={[styles.actionBtnTxt, { color: colors.red700 }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                </Card>
              );
            })
          )
        )}

        {/* ── INVOICES ── */}
        {activeTab === 'invoices' && (
          invoices.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No invoices yet</Text>
              <Text style={styles.emptyText}>Invoices are created automatically when you add a session pack.</Text>
            </View>
          ) : (
            invoices.map((inv) => (
              <Card key={inv.id} style={styles.invoiceCard}>
                <View style={styles.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceClient}>{clientName(inv.client_id)}</Text>
                    <Text style={styles.invoiceDesc}>{inv.description}</Text>
                    <Text style={styles.invoiceDate}>{fmtDate(inv.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                    <Text style={styles.invoiceAmt}>{fmtMoney(inv.amount_pence)}</Text>
                    <Badge
                      label={inv.status}
                      variant={inv.status === 'paid' ? 'active' : 'danger'}
                    />
                  </View>
                </View>
              </Card>
            ))
          )
        )}
      </ScrollView>

      {/* ── New Session Pack Modal ── */}
      <Modal visible={newPackModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Session Pack</Text>
              <TouchableOpacity onPress={() => setNewPackModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>

              {/* Select Client */}
              <Text style={styles.fieldLabel}>Select Client *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {clients.filter((c: any) => c.status === 'active').map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, packForm.client_id === c.id && styles.chipActive]}
                    onPress={() => setPackForm((f) => ({ ...f, client_id: c.id }))}
                  >
                    <Text style={[styles.chipTxt, packForm.client_id === c.id && styles.chipTxtActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Number of sessions */}
              <Text style={styles.fieldLabel}>Number of Sessions *</Text>
              <View style={styles.presetsRow}>
                {PRESET_PACKS.map((p) => (
                  <TouchableOpacity
                    key={p.sessions}
                    style={[
                      styles.presetChip,
                      packForm.total_sessions === p.sessions && styles.chipActive,
                    ]}
                    onPress={() => setPackForm((f) => ({
                      ...f,
                      total_sessions: p.sessions,
                      pack_name: p.label,
                    }))}
                  >
                    <Text style={[
                      styles.presetChipTxt,
                      packForm.total_sessions === p.sessions && { color: colors.white },
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pack name */}
              <Text style={styles.fieldLabel}>Pack Name *</Text>
              <TextInput
                style={styles.input}
                value={packForm.pack_name}
                onChangeText={(v) => setPackForm((f) => ({ ...f, pack_name: v }))}
                placeholder="e.g. 10 Session Pack"
                placeholderTextColor={colors.gray400}
              />

              {/* Price */}
              <Text style={styles.fieldLabel}>Price (£) *</Text>
              <TextInput
                style={styles.input}
                value={packForm.price_pence}
                onChangeText={(v) => setPackForm((f) => ({ ...f, price_pence: v }))}
                placeholder="e.g. 500 for £500"
                keyboardType="numeric"
                placeholderTextColor={colors.gray400}
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={packForm.notes}
                onChangeText={(v) => setPackForm((f) => ({ ...f, notes: v }))}
                placeholder="Any notes about this pack..."
                placeholderTextColor={colors.gray400}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, savingPack && { opacity: 0.6 }]}
                onPress={handleCreatePack}
                disabled={savingPack}
              >
                {savingPack
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Create Session Pack</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  title:    { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.md,
    padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.gray200,
  },
  statVal:   { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  statLabel: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs, textAlign: 'center' },
  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    backgroundColor: colors.white, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray200, padding: 3, marginBottom: spacing.md,
  },
  tab:        { flex: 1, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm - 2, alignItems: 'center' },
  tabActive:  { backgroundColor: colors.black },
  tabTxt:     { fontSize: fontSize.xs + 1, fontWeight: '500', color: colors.gray500 },
  tabTxtActive: { color: colors.white },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },

  packCard:        { marginBottom: spacing.sm },
  packHeader:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  packClient:      { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  packName:        { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  sessionCounter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  sessionNumbers:  { flexDirection: 'row', alignItems: 'baseline' },
  sessionRemaining:{ fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  sessionTotal:    { fontSize: fontSize.sm, color: colors.gray400 },
  sessionPaid:     { fontSize: fontSize.sm, color: colors.gray400 },
  progressBar:     { height: 8, backgroundColor: colors.gray100, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.sm },
  progressFill:    { height: '100%', backgroundColor: colors.black, borderRadius: 4 },
  packNotes:       { fontSize: fontSize.xs, color: colors.gray400, fontStyle: 'italic', marginBottom: spacing.sm },
  actionRow:       { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.md, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
  },
  actionBtnDisabled:{ opacity: 0.4 },
  actionBtnDanger:  { backgroundColor: colors.red50 },
  actionBtnTxt:     { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray600 },

  invoiceCard: { marginBottom: spacing.sm },
  invoiceRow:  { flexDirection: 'row', alignItems: 'center' },
  invoiceClient:{ fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  invoiceDesc: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  invoiceDate: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  invoiceAmt:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:  { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  chipScroll:   { marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  chipActive:   { backgroundColor: colors.black, borderColor: colors.black },
  chipTxt:      { fontSize: fontSize.sm, color: colors.gray600 },
  chipTxtActive:{ color: colors.white },
  presetsRow:   { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
  presetChip: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray200, alignItems: 'center',
  },
  presetChipTxt:{ fontSize: fontSize.sm, fontWeight: '600', color: colors.gray600 },
  saveBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl,
  },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});