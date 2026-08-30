import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

type Tab = 'measurements' | 'goals' | 'photos';

export default function ProgressScreen() {
  const { clientProfileId } = useAuthStore();
  const [activeTab, setActiveTab]       = useState<Tab>('measurements');
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [goals, setGoals]               = useState<any[]>([]);
  const [photos, setPhotos]             = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const [mModal,  setMModal]  = useState(false);
  const [mSaving, setMSaving] = useState(false);
  const [mForm, setMForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight_kg: '', chest_cm: '', waist_cm: '',
    left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '',
  });

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (clientProfileId) loadAll();
  }, [clientProfileId]);

  const loadAll = async () => {
    if (!clientProfileId) return;
    try {
      const [mR, gR, pR] = await Promise.allSettled([
        API.get(`/clients/${clientProfileId}/measurements`),
        API.get(`/clients/${clientProfileId}/goals`),
        API.get(`/clients/${clientProfileId}/photos`),
      ]);
      if (mR.status === 'fulfilled') setMeasurements(mR.value.data);
      if (gR.status === 'fulfilled') setGoals(gR.value.data);
      if (pR.status === 'fulfilled') setPhotos(pR.value.data);
    } catch (e) {
      console.error('progress loadAll:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const saveMeasurement = async () => {
    if (!mForm.date || !clientProfileId) {
      Alert.alert('Error', 'Date is required');
      return;
    }
    setMSaving(true);
    try {
      const payload: any = { date: mForm.date };
      const numKeys = ['weight_kg','chest_cm','waist_cm','left_arm_cm','right_arm_cm','thigh_cm','hips_cm'];
      numKeys.forEach(k => {
        const v = (mForm as any)[k];
        if (v !== '') payload[k] = parseFloat(v);
      });
      if (mForm.notes) payload.notes = mForm.notes;

      const res = await API.post(`/clients/${clientProfileId}/measurements`, payload);
      setMeasurements(prev => [res.data, ...prev]);
      setMModal(false);
      setMForm({
        date: new Date().toISOString().split('T')[0],
        weight_kg: '', chest_cm: '', waist_cm: '',
        left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '',
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save measurement');
    } finally {
      setMSaving(false);
    }
  };

  // ── FIX: Don't set Content-Type manually — let axios auto-set multipart boundary ──
  const pickAndUploadPhoto = async () => {
    if (!clientProfileId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri:  asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: 'progress_photo.jpg',
      } as any);

      // ✅ KEY FIX: Set Content-Type to undefined so axios detects FormData
      // and automatically adds the correct multipart/form-data boundary.
      // Manually setting 'multipart/form-data' WITHOUT a boundary causes 422.
      const res = await API.post(
        `/clients/${clientProfileId}/photos`,
        formData,
        {
          headers: {
            'Content-Type': undefined,
          },
        },
      );
      setPhotos(prev => [res.data, ...prev]);
      Alert.alert('Uploaded!', 'Your progress photo has been saved.');
    } catch (err: any) {
      Alert.alert(
        'Upload Failed',
        err.response?.data?.detail || 'Could not upload photo. Please try again.',
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const renderMeasurements = () => {
    const weights      = measurements.filter((m) => m.weight_kg).map((m) => m.weight_kg);
    const latestWeight = weights[0];
    const prevWeight   = weights[1];
    const weightDiff   = latestWeight && prevWeight ? latestWeight - prevWeight : null;

    return (
      <>
        <TouchableOpacity style={styles.actionTopBtn} onPress={() => setMModal(true)}>
          <Ionicons name="add-circle-outline" size={18} color={colors.white} />
          <Text style={styles.actionTopBtnTxt}>Log Measurement</Text>
        </TouchableOpacity>

        {measurements.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="body-outline" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No measurements yet</Text>
            <Text style={styles.emptyText}>
              Tap "Log Measurement" above or your trainer will add them during sessions.
            </Text>
          </View>
        ) : (
          <>
            {latestWeight && (
              <Card style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>CURRENT WEIGHT</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>{latestWeight} kg</Text>
                  {weightDiff !== null && (
                    <View style={[
                      styles.diffBadge,
                      { backgroundColor: weightDiff <= 0 ? colors.green50 : colors.red50 },
                    ]}>
                      <Ionicons
                        name={weightDiff <= 0 ? 'trending-down' : 'trending-up'}
                        size={14}
                        color={weightDiff <= 0 ? colors.green700 : colors.red700}
                      />
                      <Text style={[styles.diffTxt, { color: weightDiff <= 0 ? colors.green700 : colors.red700 }]}>
                        {Math.abs(weightDiff).toFixed(1)} kg from last check-in
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.summaryMeta}>Last updated {fmtDate(measurements[0].date)}</Text>
              </Card>
            )}
            {measurements.map((m) => (
              <Card key={m.id} style={styles.measureCard}>
                <Text style={styles.measureDate}>{fmtDate(m.date)}</Text>
                <View style={styles.metricsGrid}>
                  {[
                    { label: 'Weight',  value: m.weight_kg,    unit: 'kg' },
                    { label: 'Chest',   value: m.chest_cm,     unit: 'cm' },
                    { label: 'Waist',   value: m.waist_cm,     unit: 'cm' },
                    { label: 'L. Arm',  value: m.left_arm_cm,  unit: 'cm' },
                    { label: 'R. Arm',  value: m.right_arm_cm, unit: 'cm' },
                    { label: 'Thigh',   value: m.thigh_cm,     unit: 'cm' },
                    { label: 'Hips',    value: m.hips_cm,      unit: 'cm' },
                  ].filter((row) => row.value != null).map((row) => (
                    <View key={row.label} style={styles.metricItem}>
                      <Text style={styles.metricLabel}>{row.label}</Text>
                      <Text style={styles.metricValue}>{row.value} {row.unit}</Text>
                    </View>
                  ))}
                </View>
                {m.notes ? <Text style={styles.measureNotes}>{m.notes}</Text> : null}
              </Card>
            ))}
          </>
        )}
      </>
    );
  };

  const renderGoals = () => {
    if (goals.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="flag-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No goals set yet</Text>
          <Text style={styles.emptyText}>Speak with your trainer to set your goals.</Text>
        </View>
      );
    }

    const statusOrder: Record<string, number> = { in_progress: 0, achieved: 1, abandoned: 2 };
    const sorted = [...goals].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

    return sorted.map((g) => {
      const progress =
        g.current_value != null && g.target_value
          ? Math.min((g.current_value / g.target_value) * 100, 100)
          : null;

      return (
        <Card key={g.id} style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalDesc}>{g.description}</Text>
              <Text style={styles.goalType}>{g.type.replace('_', ' ')}</Text>
            </View>
            <Badge
              label={g.status.replace('_', ' ')}
              variant={g.status === 'achieved' ? 'active' : g.status === 'abandoned' ? 'danger' : 'pending'}
            />
          </View>
          <View style={styles.goalMetaRow}>
            <View style={styles.goalMetaItem}>
              <Text style={styles.goalMetaLabel}>Target</Text>
              <Text style={styles.goalMetaValue}>{g.target_value} {g.target_unit}</Text>
            </View>
            {g.current_value != null && (
              <View style={styles.goalMetaItem}>
                <Text style={styles.goalMetaLabel}>Current</Text>
                <Text style={styles.goalMetaValue}>{g.current_value} {g.target_unit}</Text>
              </View>
            )}
            {g.target_date && (
              <View style={styles.goalMetaItem}>
                <Text style={styles.goalMetaLabel}>Due</Text>
                <Text style={styles.goalMetaValue}>{fmtDate(g.target_date)}</Text>
              </View>
            )}
          </View>
          {progress !== null && g.status === 'in_progress' && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
            </View>
          )}
        </Card>
      );
    });
  };

  const renderPhotos = () => (
    <>
      <TouchableOpacity
        style={[styles.actionTopBtn, uploadingPhoto && { opacity: 0.6 }]}
        onPress={pickAndUploadPhoto}
        disabled={uploadingPhoto}
      >
        {uploadingPhoto
          ? <ActivityIndicator color={colors.white} size="small" />
          : <Ionicons name="camera-outline" size={18} color={colors.white} />}
        <Text style={styles.actionTopBtnTxt}>
          {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
        </Text>
      </TouchableOpacity>

      {photos.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No progress photos yet</Text>
          <Text style={styles.emptyText}>
            Tap "Upload Photo" above or your trainer will add them at key milestones.
          </Text>
        </View>
      ) : (
        <View style={styles.photoGrid}>
          {photos.map((p) => (
            <View key={p.id} style={styles.photoCell}>
              <Image source={{ uri: p.file_url }} style={styles.photoImg} resizeMode="cover" />
              <Text style={styles.photoDate}>{fmtDate(p.date)}</Text>
              {p.notes ? <Text style={styles.photoNotes} numberOfLines={2}>{p.notes}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'measurements', label: 'Measurements', count: measurements.length },
    { key: 'goals',        label: 'Goals',        count: goals.length        },
    { key: 'photos',       label: 'Photos',       count: photos.length       },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabTxt, activeTab === t.key && styles.tabTxtActive]}>
              {t.label} ({t.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'measurements' && renderMeasurements()}
        {activeTab === 'goals'        && renderGoals()}
        {activeTab === 'photos'       && renderPhotos()}
      </ScrollView>

      <Modal visible={mModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Measurement</Text>
              <TouchableOpacity onPress={() => setMModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: spacing.xxxl }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Date *</Text>
              <TextInput
                style={styles.input}
                value={mForm.date}
                onChangeText={v => setMForm(f => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.gray400}
              />
              {([
                ['Weight (kg)',  'weight_kg'],
                ['Chest (cm)',   'chest_cm'],
                ['Waist (cm)',   'waist_cm'],
                ['L. Arm (cm)',  'left_arm_cm'],
                ['R. Arm (cm)',  'right_arm_cm'],
                ['Thigh (cm)',   'thigh_cm'],
                ['Hips (cm)',    'hips_cm'],
              ] as [string, string][]).map(([label, key]) => (
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header:    { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title:     { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    backgroundColor: colors.white, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray200, padding: 3, marginBottom: spacing.md,
  },
  tab:        { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.sm - 2, alignItems: 'center' },
  tabActive:  { backgroundColor: colors.black },
  tabTxt:     { fontSize: fontSize.xs + 1, fontWeight: '500', color: colors.gray500 },
  tabTxtActive: { color: colors.white },
  scroll:     { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  actionTopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.md, marginBottom: spacing.lg,
  },
  actionTopBtnTxt: { color: colors.white, fontSize: fontSize.sm, fontWeight: '600' },
  empty:      { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 20 },
  summaryCard:  { marginBottom: spacing.md, backgroundColor: colors.black },
  summaryLabel: { fontSize: fontSize.xs, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, marginBottom: spacing.xs },
  summaryRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  summaryValue: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.white },
  summaryMeta:  { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: spacing.xs },
  diffBadge:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  diffTxt:      { fontSize: fontSize.xs, fontWeight: '600' },
  measureCard:  { marginBottom: spacing.sm },
  measureDate:  { fontSize: fontSize.sm, fontWeight: '700', color: colors.black, marginBottom: spacing.md },
  metricsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricItem:   { minWidth: '28%' },
  metricLabel:  { fontSize: fontSize.xs, color: colors.gray400 },
  metricValue:  { fontSize: fontSize.md, fontWeight: '600', color: colors.black, marginTop: 2 },
  measureNotes: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.md, fontStyle: 'italic' },
  goalCard:     { marginBottom: spacing.sm },
  goalHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  goalDesc:     { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  goalType:     { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2, textTransform: 'capitalize' },
  goalMetaRow:  { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.md },
  goalMetaItem: {},
  goalMetaLabel:{ fontSize: fontSize.xs, color: colors.gray400 },
  goalMetaValue:{ fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginTop: 2 },
  progressBar:  { height: 6, backgroundColor: colors.gray100, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.black, borderRadius: 3 },
  photoGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCell:    { width: '48%' },
  photoImg:     { width: '100%', aspectRatio: 0.75, borderRadius: borderRadius.sm, backgroundColor: colors.gray200 },
  photoDate:    { fontSize: fontSize.xs, color: colors.gray500, marginTop: spacing.xs, fontWeight: '500' },
  photoNotes:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '90%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle:   { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:    { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  fieldLabel:   { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  input:        { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.black },
  saveBtn:      { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
  saveBtnTxt:   { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});