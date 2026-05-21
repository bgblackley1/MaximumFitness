import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── Measurements ────────────────────────────────────────────────────────

  const renderMeasurements = () => {
    if (measurements.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="body-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No measurements yet</Text>
          <Text style={styles.emptyText}>
            Your trainer will add measurements during your check-ins.
          </Text>
        </View>
      );
    }

    // Weight trend indicator
    const weights = measurements.filter((m) => m.weight_kg).map((m) => m.weight_kg);
    const latestWeight = weights[0];
    const prevWeight   = weights[1];
    const weightDiff   = latestWeight && prevWeight ? latestWeight - prevWeight : null;

    return (
      <>
        {/* Weight summary card */}
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
                  <Text style={[
                    styles.diffTxt,
                    { color: weightDiff <= 0 ? colors.green700 : colors.red700 },
                  ]}>
                    {Math.abs(weightDiff).toFixed(1)} kg from last check-in
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.summaryMeta}>
              Last updated {fmtDate(measurements[0].date)}
            </Text>
          </Card>
        )}

        {/* Measurement history */}
        {measurements.map((m) => (
          <Card key={m.id} style={styles.measureCard}>
            <Text style={styles.measureDate}>{fmtDate(m.date)}</Text>
            <View style={styles.metricsGrid}>
              {[
                { label: 'Weight',     value: m.weight_kg,     unit: 'kg'  },
                { label: 'Chest',      value: m.chest_cm,      unit: 'cm'  },
                { label: 'Waist',      value: m.waist_cm,      unit: 'cm'  },
                { label: 'L. Arm',     value: m.left_arm_cm,   unit: 'cm'  },
                { label: 'R. Arm',     value: m.right_arm_cm,  unit: 'cm'  },
                { label: 'Thigh',      value: m.thigh_cm,      unit: 'cm'  },
                { label: 'Hips',       value: m.hips_cm,       unit: 'cm'  },
              ]
                .filter((row) => row.value != null)
                .map((row) => (
                  <View key={row.label} style={styles.metricItem}>
                    <Text style={styles.metricLabel}>{row.label}</Text>
                    <Text style={styles.metricValue}>
                      {row.value} {row.unit}
                    </Text>
                  </View>
                ))}
            </View>
            {m.notes ? <Text style={styles.measureNotes}>{m.notes}</Text> : null}
          </Card>
        ))}
      </>
    );
  };

  // ── Goals ────────────────────────────────────────────────────────────────

  const renderGoals = () => {
    if (goals.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="flag-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No goals set yet</Text>
          <Text style={styles.emptyText}>
            Speak with your trainer to set your goals.
          </Text>
        </View>
      );
    }

    const statusOrder: Record<string, number> = { in_progress: 0, achieved: 1, abandoned: 2 };
    const sorted = [...goals].sort(
      (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    );

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
              variant={
                g.status === 'achieved'   ? 'active'
                : g.status === 'abandoned' ? 'danger'
                : 'pending'
              }
            />
          </View>

          <View style={styles.goalMetaRow}>
            <View style={styles.goalMetaItem}>
              <Text style={styles.goalMetaLabel}>Target</Text>
              <Text style={styles.goalMetaValue}>
                {g.target_value} {g.target_unit}
              </Text>
            </View>
            {g.current_value != null && (
              <View style={styles.goalMetaItem}>
                <Text style={styles.goalMetaLabel}>Current</Text>
                <Text style={styles.goalMetaValue}>
                  {g.current_value} {g.target_unit}
                </Text>
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

  // ── Photos ───────────────────────────────────────────────────────────────

  const renderPhotos = () => {
    if (photos.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={48} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No progress photos yet</Text>
          <Text style={styles.emptyText}>
            Your trainer will add photos at key milestones.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.photoGrid}>
        {photos.map((p) => (
          <View key={p.id} style={styles.photoCell}>
            <Image
              source={{ uri: p.file_url }}
              style={styles.photoImg}
              resizeMode="cover"
            />
            <Text style={styles.photoDate}>{fmtDate(p.date)}</Text>
            {p.notes ? (
              <Text style={styles.photoNotes} numberOfLines={2}>{p.notes}</Text>
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────────

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

      {/* Tabs */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },

  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    backgroundColor: colors.white, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray200, padding: 3, marginBottom: spacing.md,
  },
  tab: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.sm - 2, alignItems: 'center',
  },
  tabActive:    { backgroundColor: colors.black },
  tabTxt:       { fontSize: fontSize.xs + 1, fontWeight: '500', color: colors.gray500 },
  tabTxtActive: { color: colors.white },

  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  empty: { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center', paddingHorizontal: spacing.xl },

  // Measurements
  summaryCard:  { marginBottom: spacing.md, backgroundColor: colors.black },
  summaryLabel: { fontSize: fontSize.xs, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, marginBottom: spacing.xs },
  summaryRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  summaryValue: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.white },
  summaryMeta:  { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: spacing.xs },
  diffBadge:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  diffTxt:      { fontSize: fontSize.xs, fontWeight: '600' },

  measureCard: { marginBottom: spacing.sm },
  measureDate: { fontSize: fontSize.sm, fontWeight: '700', color: colors.black, marginBottom: spacing.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricItem:  { minWidth: '28%' },
  metricLabel: { fontSize: fontSize.xs, color: colors.gray400 },
  metricValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.black, marginTop: 2 },
  measureNotes:{ fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.md, fontStyle: 'italic' },

  // Goals
  goalCard:      { marginBottom: spacing.sm },
  goalHeader:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  goalDesc:      { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  goalType:      { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2, textTransform: 'capitalize' },
  goalMetaRow:   { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.md },
  goalMetaItem:  {},
  goalMetaLabel: { fontSize: fontSize.xs, color: colors.gray400 },
  goalMetaValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginTop: 2 },
  progressBar:   { height: 6, backgroundColor: colors.gray100, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: colors.black, borderRadius: 3 },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCell: { width: '48%' },
  photoImg:  { width: '100%', aspectRatio: 0.75, borderRadius: borderRadius.sm, backgroundColor: colors.gray200 },
  photoDate: { fontSize: fontSize.xs, color: colors.gray500, marginTop: spacing.xs, fontWeight: '500' },
  photoNotes:{ fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
});