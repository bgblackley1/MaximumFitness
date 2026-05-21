import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

type Tab = 'subscriptions' | 'invoices';

export default function PaymentsScreen() {
  const [activeTab, setActiveTab]           = useState<Tab>('subscriptions');
  const [subscriptions, setSubscriptions]   = useState<any[]>([]);
  const [invoices, setInvoices]             = useState<any[]>([]);
  const [clients, setClients]               = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);

  // New subscription modal
  const [newSubModal, setNewSubModal] = useState(false);
  const [subForm, setSubForm] = useState({
    client_id:       '',
    plan_name:       '',
    amount:          '',
    billing_cycle:   'monthly',
    stripe_customer_id: '',
    stripe_price_id: '',
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [sR, iR, cR] = await Promise.allSettled([
        API.get('/payments/subscriptions'),
        API.get('/payments/invoices'),
        API.get('/clients'),
      ]);
      if (sR.status === 'fulfilled') setSubscriptions(sR.value.data);
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

  const handleAction = (subId: string, action: 'cancel' | 'pause' | 'resume') => {
    const labels: Record<string, string> = {
      cancel:  'Cancel this subscription?',
      pause:   'Pause this subscription?',
      resume:  'Resume this subscription?',
    };
    Alert.alert(labels[action], undefined, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: action === 'cancel' ? 'destructive' : 'default',
        onPress: async () => {
          setActionLoading(subId);
          try {
            const res = await API.put(`/payments/subscriptions/${subId}`, { action });
            setSubscriptions((prev) =>
              prev.map((s) => (s.id === subId ? res.data : s))
            );
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail ?? 'Action failed');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const fmtPence = (p: number, currency = 'GBP') =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(p / 100);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusVariant = (s: string) =>
    s === 'active'    ? 'active'
    : s === 'paused'  ? 'pending'
    : s === 'past_due'? 'danger'
    : 'inactive';

  const clientName = (id: string) =>
    clients.find((c) => c.id === id)?.name ?? 'Unknown';

  // ── Stats bar ──────────────────────────────────────────────────────────

  const active   = subscriptions.filter((s) => s.status === 'active').length;
  const pastDue  = subscriptions.filter((s) => s.status === 'past_due').length;
  const monthlyMRR = subscriptions
    .filter((s) => s.status === 'active' && s.billing_cycle === 'monthly')
    .reduce((sum, s) => sum + s.amount_pence, 0);

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
          <Text style={styles.subtitle}>Stripe subscription management</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setNewSubModal(true)}>
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* MRR stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statVal}>{active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statVal, pastDue > 0 && { color: colors.red500 }]}>
            {pastDue}
          </Text>
          <Text style={styles.statLabel}>Past Due</Text>
        </View>
        <View style={[styles.statCard, { flex: 2 }]}>
          <Text style={styles.statVal}>{fmtPence(monthlyMRR)}</Text>
          <Text style={styles.statLabel}>Monthly Revenue</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['subscriptions', 'invoices'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtActive]}>
              {t === 'subscriptions'
                ? `Subscriptions (${subscriptions.length})`
                : `Invoices (${invoices.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── SUBSCRIPTIONS ── */}
        {activeTab === 'subscriptions' && (
          subscriptions.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={48} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No subscriptions yet</Text>
              <Text style={styles.emptyText}>
                Tap + to create a client subscription via Stripe.
              </Text>
            </View>
          ) : (
            subscriptions.map((sub) => {
              const busy = actionLoading === sub.id;
              return (
                <Card key={sub.id} style={styles.subCard}>
                  <View style={styles.subHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subClient}>{clientName(sub.client_id)}</Text>
                      <Text style={styles.subPlan}>{sub.plan_name}</Text>
                    </View>
                    <Badge label={sub.status.replace('_', ' ')} variant={statusVariant(sub.status)} />
                  </View>

                  <View style={styles.subMeta}>
                    <View style={styles.subMetaItem}>
                      <Text style={styles.subMetaLabel}>Amount</Text>
                      <Text style={styles.subMetaValue}>
                        {fmtPence(sub.amount_pence, sub.currency.toUpperCase())} / {sub.billing_cycle}
                      </Text>
                    </View>
                    {sub.current_period_end && (
                      <View style={styles.subMetaItem}>
                        <Text style={styles.subMetaLabel}>
                          {sub.status === 'active' ? 'Renews' : 'Ends'}
                        </Text>
                        <Text style={styles.subMetaValue}>
                          {fmtDate(sub.current_period_end)}
                        </Text>
                      </View>
                    )}
                    {sub.payment_method_last4 && (
                      <View style={styles.subMetaItem}>
                        <Text style={styles.subMetaLabel}>Card</Text>
                        <Text style={styles.subMetaValue}>•••• {sub.payment_method_last4}</Text>
                      </View>
                    )}
                  </View>

                  {/* Action buttons */}
                  {busy ? (
                    <ActivityIndicator color={colors.black} style={{ marginTop: spacing.md }} />
                  ) : (
                    <View style={styles.actionRow}>
                      {sub.status === 'active' && (
                        <>
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleAction(sub.id, 'pause')}
                          >
                            <Ionicons name="pause-circle-outline" size={16} color={colors.gray600} />
                            <Text style={styles.actionBtnTxt}>Pause</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnDanger]}
                            onPress={() => handleAction(sub.id, 'cancel')}
                          >
                            <Ionicons name="close-circle-outline" size={16} color={colors.red700} />
                            <Text style={[styles.actionBtnTxt, { color: colors.red700 }]}>
                              Cancel
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {sub.status === 'paused' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.green50 }]}
                          onPress={() => handleAction(sub.id, 'resume')}
                        >
                          <Ionicons name="play-circle-outline" size={16} color={colors.green700} />
                          <Text style={[styles.actionBtnTxt, { color: colors.green700 }]}>
                            Resume
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
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
              <Text style={styles.emptyText}>Invoices will appear here after payments.</Text>
            </View>
          ) : (
            invoices.map((inv) => (
              <Card key={inv.id} style={styles.invoiceCard}>
                <View style={styles.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceClient}>{clientName(inv.client_id)}</Text>
                    <Text style={styles.invoiceDate}>{fmtDate(inv.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                    <Text style={styles.invoiceAmt}>
                      {fmtPence(inv.amount_pence)}
                    </Text>
                    <Badge
                      label={inv.status}
                      variant={
                        inv.status === 'paid'   ? 'active'
                        : inv.status === 'failed'? 'danger'
                        : 'pending'
                      }
                    />
                  </View>
                </View>
                {inv.pdf_url && (
                  <TouchableOpacity style={styles.pdfBtn}>
                    <Ionicons name="document-text-outline" size={14} color={colors.gray600} />
                    <Text style={styles.pdfBtnTxt}>View PDF</Text>
                  </TouchableOpacity>
                )}
              </Card>
            ))
          )
        )}
      </ScrollView>

      {/* ── New Subscription Modal ── */}
      <Modal visible={newSubModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Subscription</Text>
              <TouchableOpacity onPress={() => setNewSubModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>

              <Text style={styles.fieldLabel}>Select Client</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {clients.map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, subForm.client_id === c.id && styles.chipActive]}
                    onPress={() => setSubForm((f) => ({ ...f, client_id: c.id }))}
                  >
                    <Text style={[styles.chipTxt, subForm.client_id === c.id && styles.chipTxtActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Plan Name</Text>
              <TextInput
                style={styles.input}
                value={subForm.plan_name}
                onChangeText={(v) => setSubForm((f) => ({ ...f, plan_name: v }))}
                placeholder="e.g. Monthly PT Package"
                placeholderTextColor={colors.gray400}
              />

              <Text style={styles.fieldLabel}>Amount (in pence / cents)</Text>
              <TextInput
                style={styles.input}
                value={subForm.amount}
                onChangeText={(v) => setSubForm((f) => ({ ...f, amount: v }))}
                placeholder="e.g. 15000 = £150.00"
                keyboardType="numeric"
                placeholderTextColor={colors.gray400}
              />

              <Text style={styles.fieldLabel}>Billing Cycle</Text>
              <View style={styles.cycleRow}>
                {['monthly', 'weekly'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, subForm.billing_cycle === c && styles.chipActive]}
                    onPress={() => setSubForm((f) => ({ ...f, billing_cycle: c }))}
                  >
                    <Text style={[styles.chipTxt, subForm.billing_cycle === c && styles.chipTxtActive]}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Stripe Customer ID</Text>
              <TextInput
                style={styles.input}
                value={subForm.stripe_customer_id}
                onChangeText={(v) => setSubForm((f) => ({ ...f, stripe_customer_id: v }))}
                placeholder="cus_..."
                placeholderTextColor={colors.gray400}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Stripe Price ID</Text>
              <TextInput
                style={styles.input}
                value={subForm.stripe_price_id}
                onChangeText={(v) => setSubForm((f) => ({ ...f, stripe_price_id: v }))}
                placeholder="price_..."
                placeholderTextColor={colors.gray400}
                autoCapitalize="none"
              />

              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={15} color={colors.gray500} />
                <Text style={styles.infoTxt}>
                  Create the customer and price in your Stripe dashboard first, then enter the IDs here.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={async () => {
                  if (!subForm.client_id || !subForm.plan_name || !subForm.stripe_customer_id || !subForm.stripe_price_id) {
                    Alert.alert('Missing fields', 'Please fill in all required fields.');
                    return;
                  }
                  try {
                    await API.post('/payments/create-subscription', {
                      client_id:          subForm.client_id,
                      stripe_customer_id: subForm.stripe_customer_id,
                      stripe_price_id:    subForm.stripe_price_id,
                      plan_name:          subForm.plan_name,
                      amount_pence:       parseInt(subForm.amount) || 0,
                      billing_cycle:      subForm.billing_cycle,
                    });
                    setNewSubModal(false);
                    setSubForm({ client_id: '', plan_name: '', amount: '', billing_cycle: 'monthly', stripe_customer_id: '', stripe_price_id: '' });
                    await loadAll();
                  } catch (err: any) {
                    Alert.alert('Error', err.response?.data?.detail ?? 'Failed to create subscription');
                  }
                }}
              >
                <Text style={styles.saveBtnTxt}>Create Subscription</Text>
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
  statLabel: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },

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

  subCard:   { marginBottom: spacing.sm },
  subHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  subClient: { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  subPlan:   { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  subMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.md },
  subMetaItem:  {},
  subMetaLabel: { fontSize: fontSize.xs, color: colors.gray400 },
  subMetaValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.md },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
  },
  actionBtnDanger: { backgroundColor: colors.red50 },
  actionBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray600 },

  invoiceCard:   { marginBottom: spacing.sm },
  invoiceRow:    { flexDirection: 'row', alignItems: 'center' },
  invoiceClient: { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  invoiceDate:   { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  invoiceAmt:    { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  pdfBtn:        { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, alignSelf: 'flex-start' },
  pdfBtnTxt:     { fontSize: fontSize.sm, color: colors.gray600, fontWeight: '500' },

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
  modalBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  chipScroll: { marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  chipActive:   { backgroundColor: colors.black, borderColor: colors.black },
  chipTxt:      { fontSize: fontSize.sm, color: colors.gray600 },
  chipTxtActive:{ color: colors.white },
  cycleRow:     { flexDirection: 'row', gap: spacing.sm },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.gray50,
    padding: spacing.md, borderRadius: borderRadius.sm, gap: spacing.sm, marginTop: spacing.lg,
  },
  infoTxt: { fontSize: fontSize.xs, color: colors.gray500, flex: 1, lineHeight: 17 },
  saveBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl,
  },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});