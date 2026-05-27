// pt-app-mobile/app/pt/client-detail.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import LoadingScreen from '@/components/LoadingScreen';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [client,       setClient]       = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [goals,        setGoals]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  // ── Add Measurement modal ──
  const [mModal,   setMModal]   = useState(false);
  const [mSaving,  setMSaving]  = useState(false);
  const [mForm, setMForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight_kg: '', chest_cm: '', waist_cm: '',
    left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '',
  });

  // ── Add Goal modal ──
  const [gModal,  setGModal]  = useState(false);
  const [gSaving, setGSaving] = useState(false);
  const [gForm, setGForm] = useState({
    description: '', type: 'weight',
    target_value: '', target_unit: 'kg',
    target_date: '', current_value: '',
  });

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [cR, mR, gR] = await Promise.allSettled([
        API.get(`/clients/${id}`),
        API.get(`/clients/${id}/measurements`),
        API.get(`/clients/${id}/goals`),
      ]);
      if (cR.status === 'fulfilled') setClient(cR.value.data);
      if (mR.status === 'fulfilled') setMeasurements(mR.value.data);
      if (gR.status === 'fulfilled') setGoals(gR.value.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Save measurement ──────────────────────────────────────────────────────
  const saveMeasurement = async () => {
    if (!mForm.date) { Alert.alert('Error', 'Date is required'); return; }
    setMSaving(true);
    try {
      const payload: any = { date: mForm.date };
      const nums = ['weight_kg','chest_cm','waist_cm','left_arm_cm','right_arm_cm','thigh_cm','hips_cm'];
      nums.forEach(k => {
        const v = (mForm as any)[k];
        if (v !== '') payload[k] = parseFloat(v);
      });
      if (mForm.notes) payload.notes = mForm.notes;
      const res = await API.post(`/clients/${id}/measurements`, payload);
      setMeasurements(prev => [res.data, ...prev]);
      setMModal(false);
      setMForm({ date: new Date().toISOString().split('T')[0], weight_kg: '', chest_cm: '',
        waist_cm: '', left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '' });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save measurement');
    } finally { setMSaving(false); }
  };

  // ── Save goal ─────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    if (!gForm.description || !gForm.target_value) {
      Alert.alert('Error', 'Description and target value are required'); return;
    }
    setGSaving(true);
    try {
      const payload: any = {
        description:  gForm.description,
        type:         gForm.type,
        target_value: parseFloat(gForm.target_value),
        target_unit:  gForm.target_unit,
      };
      if (gForm.target_date)   payload.target_date   = gForm.target_date;
      if (gForm.current_value) payload.current_value = parseFloat(gForm.current_value);
      const res = await API.post(`/clients/${id}/goals`, payload);
      setGoals(prev => [res.data, ...prev]);
      setGModal(false);
      setGForm({ description: '', type: 'weight', target_value: '', target_unit: 'kg', target_date: '', current_value: '' });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save goal');
    } finally { setGSaving(false); }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <LoadingScreen />;
  if (!client) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>Client not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Client Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{client.name?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientEmail}>{client.email}</Text>
            </View>
            <Badge
              label={client.status || 'active'}
              variant={client.status === 'active' ? 'active' : 'inactive'}
            />
          </View>
          <View style={styles.statsRow}>
            {[
              { label: 'Age',    value: client.age ? `${client.age}` : '—' },
              { label: 'Sex',    value: client.sex ?? '—' },
              { label: 'Height', value: client.height_cm ? `${client.height_cm}cm` : '—' },
              { label: 'Weight', value: client.starting_weight_kg ? `${client.starting_weight_kg}kg` : '—' },
            ].map(s => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>{s.value}</Text>
              </View>
            ))}
          </View>
          {client.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{client.notes}</Text>
            </View>
          )}
        </Card>

        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/pt/workouts?client_id=${id}` as any)}
          >
            <Ionicons name="barbell-outline" size={18} color={colors.black} />
            <Text style={styles.actionBtnTxt}>Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/pt/calendar?client_id=${id}` as any)}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.black} />
            <Text style={styles.actionBtnTxt}>Bookings</Text>
          </TouchableOpacity>
        </View>

        {/* Goals Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <TouchableOpacity style={styles.addIcon} onPress={() => setGModal(true)}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        {goals.length === 0 ? (
          <Card><Text style={styles.emptyText}>No goals set yet.</Text></Card>
        ) : (
          goals.map((goal) => (
            <Card key={goal.id} style={styles.goalCard}>
              <View style={styles.goalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalDesc}>{goal.description}</Text>
                  <Text style={styles.goalMeta}>
                    Target: {goal.target_value} {goal.target_unit}
                    {goal.current_value != null
                      ? ` · Current: ${goal.current_value} ${goal.target_unit}`
                      : ''}
                    {goal.target_date ? ` · Due: ${fmtDate(goal.target_date)}` : ''}
                  </Text>
                </View>
                <Badge
                  label={goal.status.replace('_', ' ')}
                  variant={goal.status === 'achieved' ? 'active' : goal.status === 'abandoned' ? 'danger' : 'pending'}
                />
              </View>
            </Card>
          ))
        )}

        {/* Measurements Section */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Measurements</Text>
          <TouchableOpacity style={styles.addIcon} onPress={() => setMModal(true)}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
        {measurements.length === 0 ? (
          <Card><Text style={styles.emptyText}>No measurements recorded yet.</Text></Card>
        ) : (
          measurements.slice(0, 8).map((m) => (
            <Card key={m.id} style={styles.measureCard}>
              <Text style={styles.measureDate}>{fmtDate(m.date)}</Text>
              <View style={styles.metricsRow}>
                {[
                  { label: 'Weight',  value: m.weight_kg,    unit: 'kg' },
                  { label: 'Chest',   value: m.chest_cm,     unit: 'cm' },
                  { label: 'Waist',   value: m.waist_cm,     unit: 'cm' },
                  { label: 'L. Arm',  value: m.left_arm_cm,  unit: 'cm' },
                  { label: 'R. Arm',  value: m.right_arm_cm, unit: 'cm' },
                  { label: 'Thigh',   value: m.thigh_cm,     unit: 'cm' },
                  { label: 'Hips',    value: m.hips_cm,      unit: 'cm' },
                ].filter(r => r.value != null).map(r => (
                  <View key={r.label} style={styles.metricItem}>
                    <Text style={styles.metricLabel}>{r.label}</Text>
                    <Text style={styles.metricValue}>{r.value} {r.unit}</Text>
                  </View>
                ))}
              </View>
              {m.notes ? <Text style={styles.measureNotes}>{m.notes}</Text> : null}
            </Card>
          ))
        )}
      </ScrollView>

      {/* ── Add Measurement Modal ── */}
      <Modal visible={mModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add Measurement</Text>
              <TouchableOpacity onPress={() => setMModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              {/* Date */}
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.input}
                value={mForm.date}
                onChangeText={v => setMForm(f => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.gray400}
              />
              {/* Two-column grid for metrics */}
              {[
                ['Weight (kg)', 'weight_kg'], ['Chest (cm)', 'chest_cm'],
                ['Waist (cm)', 'waist_cm'],   ['L. Arm (cm)', 'left_arm_cm'],
                ['R. Arm (cm)', 'right_arm_cm'], ['Thigh (cm)', 'thigh_cm'],
                ['Hips (cm)', 'hips_cm'],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.input}
                    value={(mForm as any)[key]}
                    onChangeText={v => setMForm(f => ({ ...f, [key]: v }))}
                    placeholder="Optional"
                    placeholderTextColor={colors.gray400}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={mForm.notes}
                onChangeText={v => setMForm(f => ({ ...f, notes: v }))}
                placeholder="Optional"
                placeholderTextColor={colors.gray400}
                multiline
              />
              <TouchableOpacity
                style={[styles.saveBtn, mSaving && { opacity: 0.6 }]}
                onPress={saveMeasurement}
                disabled={mSaving}
              >
                {mSaving
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Measurement</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Goal Modal ── */}
      <Modal visible={gModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add Goal</Text>
              <TouchableOpacity onPress={() => setGModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                style={styles.input}
                value={gForm.description}
                onChangeText={v => setGForm(f => ({ ...f, description: v }))}
                placeholder="e.g. Lose 10kg by summer"
                placeholderTextColor={colors.gray400}
              />
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {['weight', 'strength', 'movement', 'custom'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, gForm.type === t && styles.chipActive]}
                    onPress={() => setGForm(f => ({ ...f, type: t }))}
                  >
                    <Text style={[styles.chipTxt, gForm.type === t && { color: colors.white }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Target Value *</Text>
              <TextInput
                style={styles.input}
                value={gForm.target_value}
                onChangeText={v => setGForm(f => ({ ...f, target_value: v }))}
                placeholder="e.g. 80"
                placeholderTextColor={colors.gray400}
                keyboardType="decimal-pad"
              />
              <Text style={styles.fieldLabel}>Unit</Text>
              <View style={styles.chipRow}>
                {['kg', 'lbs', 'reps', 'mins', '%', 'other'].map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, gForm.target_unit === u && styles.chipActive]}
                    onPress={() => setGForm(f => ({ ...f, target_unit: u }))}
                  >
                    <Text style={[styles.chipTxt, gForm.target_unit === u && { color: colors.white }]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Current Value (optional)</Text>
              <TextInput
                style={styles.input}
                value={gForm.current_value}
                onChangeText={v => setGForm(f => ({ ...f, current_value: v }))}
                placeholder="e.g. 90"
                placeholderTextColor={colors.gray400}
                keyboardType="decimal-pad"
              />
              <Text style={styles.fieldLabel}>Target Date (optional)</Text>
              <TextInput
                style={styles.input}
                value={gForm.target_date}
                onChangeText={v => setGForm(f => ({ ...f, target_date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.gray400}
              />
              <TouchableOpacity
                style={[styles.saveBtn, gSaving && { opacity: 0.6 }]}
                onPress={saveGoal}
                disabled={gSaving}
              >
                {gSaving
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Goal</Text>}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '600' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },

  profileCard:  { marginBottom: spacing.lg },
  profileTop:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 52, height: 52, borderRadius: borderRadius.full,
    backgroundColor: colors.black, alignItems: 'center',
    justifyContent: 'center', marginRight: spacing.md,
  },
  avatarText:   { color: colors.white, fontSize: fontSize.xl, fontWeight: '700' },
  profileInfo:  { flex: 1 },
  clientName:   { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  clientEmail:  { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  statsRow: {
    flexDirection: 'row', borderTopWidth: 1,
    borderTopColor: colors.gray100, paddingTop: spacing.lg,
  },
  statItem:  { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: fontSize.xs, color: colors.gray400 },
  statValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.black, marginTop: 2 },
  notesSection: {
    borderTopWidth: 1, borderTopColor: colors.gray100,
    paddingTop: spacing.lg, marginTop: spacing.lg,
  },
  notesLabel: { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.xs },
  notesText:  { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },

  actionRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.white, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray200, padding: spacing.lg,
  },
  actionBtnTxt: { fontSize: fontSize.sm, fontWeight: '500', color: colors.black },

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  addIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },

  goalCard: { marginBottom: spacing.sm },
  goalRow:  { flexDirection: 'row', alignItems: 'center' },
  goalDesc: { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  goalMeta: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 4 },

  measureCard:  { marginBottom: spacing.sm },
  measureDate:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginBottom: spacing.sm },
  metricsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricItem:   { minWidth: '28%' },
  metricLabel:  { fontSize: fontSize.xs, color: colors.gray400 },
  metricValue:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginTop: 2 },
  measureNotes: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.sm, fontStyle: 'italic' },

  emptyText: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:  { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  chipRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray200,
  },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipTxt:    { fontSize: fontSize.xs, color: colors.gray600 },
  saveBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl,
  },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});