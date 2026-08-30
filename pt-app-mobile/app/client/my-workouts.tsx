import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

const FOCUS_COLORS: Record<string, string> = {
  arms: '#E0F2FE', legs: '#D1FAE5', push: '#FEF3C7', pull: '#FCE7F3',
  back: '#EDE9FE', chest: '#FEE2E2', core: '#ECFDF5', full_body: '#F0FDF4', cardio: '#FFF7ED',
};
const FOCUS_TEXT: Record<string, string> = {
  arms: '#0369A1', legs: '#065F46', push: '#92400E', pull: '#9D174D',
  back: '#5B21B6', chest: '#991B1B', core: '#065F46', full_body: '#14532D', cardio: '#C2410C',
};

export default function MyWorkoutsScreen() {
  const [workouts,    setWorkouts]    = useState<any[]>([]);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, any>>({});

  useEffect(() => { loadWorkouts(); }, []);

  const loadWorkouts = async () => {
    try {
      const res = await API.get('/workout-plans');
      setWorkouts(res.data);
    } catch (e) {
      console.error('loadWorkouts:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkouts();
    setRefreshing(false);
  };

  const toggleWorkout = async (wid: string) => {
    if (expanded === wid) { setExpanded(null); return; }
    setExpanded(wid);
    if (!detailCache[wid]) {
      setLoadingDetail(wid);
      try {
        const res = await API.get(`/workout-plans/${wid}`);
        setDetailCache((prev) => ({ ...prev, [wid]: res.data }));
      } catch (e) { console.error(e); }
      finally { setLoadingDetail(null); }
    }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Workouts</Text>
        <Text style={styles.subtitle}>
          {workouts.length} workout{workouts.length !== 1 ? 's' : ''} assigned
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {workouts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={56} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No workouts assigned yet</Text>
            <Text style={styles.emptyText}>
              Your trainer will assign workouts once your programme begins.
            </Text>
          </View>
        ) : (
          workouts.map((w) => {
            const isOpen    = expanded === w.id;
            const detail    = detailCache[w.id];
            const isLoading = loadingDetail === w.id;
            const focusBg   = w.focus ? FOCUS_COLORS[w.focus] ?? colors.gray100 : null;
            const focusFg   = w.focus ? FOCUS_TEXT[w.focus]   ?? colors.gray700 : null;
            const focusTxt  = w.focus
              ? w.focus.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              : null;

            return (
              <View key={w.id} style={styles.workoutWrapper}>
                {/* Header */}
                <TouchableOpacity
                  style={[styles.workoutCard, isOpen && styles.workoutCardOpen]}
                  onPress={() => toggleWorkout(w.id)}
                  activeOpacity={0.85}
                >
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.workoutTitle, isOpen && styles.textWhite]}>
                        {w.title}
                      </Text>
                      {focusTxt && focusBg && !isOpen && (
                        <View style={[styles.focusPill, { backgroundColor: focusBg }]}>
                          <Text style={[styles.focusPillTxt, { color: focusFg! }]}>{focusTxt}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.workoutMeta, isOpen && { color: 'rgba(255,255,255,0.55)' }]}>
                      {w.exercise_count ?? 0} exercise{(w.exercise_count ?? 0) !== 1 ? 's' : ''}
                      {w.focus && isOpen ? `  ·  ${focusTxt}` : ''}
                      {'  ·  Added ' + fmtDate(w.created_at)}
                    </Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={isOpen ? colors.white : colors.gray400}
                  />
                </TouchableOpacity>

                {/* Expanded exercises */}
                {isOpen && (
                  <View style={styles.exerciseBody}>
                    {isLoading ? (
                      <ActivityIndicator color={colors.black} style={{ padding: spacing.xl }} />
                    ) : detail ? (
                      (detail.exercises ?? []).length === 0 ? (
                        <Text style={styles.noExTxt}>No exercises in this workout yet.</Text>
                      ) : (
                        (detail.exercises as any[]).map((ex, idx) => (
                          <View key={ex.id ?? idx} style={styles.exRow}>
                            <View style={styles.exNumBadge}>
                              <Text style={styles.exNumTxt}>{idx + 1}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.exName}>{ex.name}</Text>
                              {ex.muscle_group ? (
                                <Text style={styles.exMuscle}>{ex.muscle_group}</Text>
                              ) : null}
                              <Text style={styles.exDetail}>
                                {ex.sets} sets × {ex.reps}
                                {ex.rest_seconds ? `  ·  ${ex.rest_seconds}s rest` : ''}
                              </Text>
                              {ex.notes ? (
                                <Text style={styles.exNotes}>💡 {ex.notes}</Text>
                              ) : null}
                            </View>
                          </View>
                        ))
                      )
                    ) : (
                      <Text style={styles.errorTxt}>Could not load exercises.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  title:    { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  scroll:   { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  empty:      { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center', paddingHorizontal: spacing.xl },

  workoutWrapper: { marginBottom: spacing.md },
  workoutCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray200,
    padding: spacing.lg, gap: spacing.md,
  },
  workoutCardOpen: { backgroundColor: colors.black, borderColor: colors.black, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  workoutTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  workoutMeta:  { fontSize: fontSize.xs, color: colors.gray400 },
  textWhite:    { color: colors.white },
  focusPill: {
    paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full,
  },
  focusPillTxt: { fontSize: fontSize.xs, fontWeight: '600', textTransform: 'capitalize' },

  exerciseBody: {
    backgroundColor: colors.white, borderWidth: 1, borderTopWidth: 0,
    borderColor: colors.gray200, borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md, overflow: 'hidden',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg,
  },
  exRow: {
    flexDirection: 'row', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  exNumBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  exNumTxt:  { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray600 },
  exName:    { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  exMuscle:  { fontSize: fontSize.xs, color: colors.gray400, textTransform: 'capitalize', marginTop: 1 },
  exDetail:  { fontSize: fontSize.sm, color: colors.gray500, marginTop: spacing.xs },
  exNotes:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs, lineHeight: 16 },
  noExTxt:   { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center', padding: spacing.lg },
  errorTxt:  { fontSize: fontSize.sm, color: colors.red500, padding: spacing.lg },
});