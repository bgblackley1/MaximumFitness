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

export default function MyWorkoutsScreen() {
  const [plans, setPlans]       = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      const res = await API.get('/workout-plans');
      setPlans(res.data);
    } catch (e) {
      console.error('loadPlans:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPlans();
    setRefreshing(false);
  };

  const togglePlan = async (planId: string) => {
    if (expanded === planId) {
      setExpanded(null);
      return;
    }
    setExpanded(planId);
    if (!planDetail[planId]) {
      setLoadingDetail(planId);
      try {
        const res = await API.get(`/workout-plans/${planId}`);
        setPlanDetail((prev) => ({ ...prev, [planId]: res.data }));
      } catch (e) {
        console.error('loadPlanDetail:', e);
      } finally {
        setLoadingDetail(null);
      }
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
          {plans.length} plan{plans.length !== 1 ? 's' : ''} assigned
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {plans.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={56} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No workout plans yet</Text>
            <Text style={styles.emptyText}>
              Your trainer will assign a plan once your programme begins.
            </Text>
          </View>
        ) : (
          plans.map((plan) => {
            const isOpen   = expanded === plan.id;
            const detail   = planDetail[plan.id];
            const isLoadingThis = loadingDetail === plan.id;

            return (
              <View key={plan.id} style={styles.planWrapper}>
                {/* Plan header — tap to expand */}
                <TouchableOpacity
                  style={[styles.planCard, isOpen && styles.planCardOpen]}
                  onPress={() => togglePlan(plan.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, isOpen && styles.textWhite]}>
                      {plan.title}
                    </Text>
                    {plan.goal_focus ? (
                      <Text style={[styles.planGoal, isOpen && { color: 'rgba(255,255,255,0.65)' }]}>
                        {plan.goal_focus}
                      </Text>
                    ) : null}
                    <Text style={[styles.planMeta, isOpen && { color: 'rgba(255,255,255,0.5)' }]}>
                      Added {fmtDate(plan.created_at)}
                    </Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={isOpen ? colors.white : colors.gray400}
                  />
                </TouchableOpacity>

                {/* Expanded plan detail */}
                {isOpen && (
                  <View style={styles.planBody}>
                    {isLoadingThis ? (
                      <ActivityIndicator color={colors.black} style={{ padding: spacing.xl }} />
                    ) : detail ? (
                      detail.weeks.map((week: any) => (
                        <View key={week.id} style={styles.week}>
                          <Text style={styles.weekLabel}>Week {week.week_number}</Text>
                          {week.days.map((day: any) => (
                            <Card key={day.id} style={styles.dayCard}>
                              <View style={styles.dayHeader}>
                                <Ionicons name="calendar-outline" size={15} color={colors.gray500} />
                                <Text style={styles.dayLabel}>{day.day_label}</Text>
                              </View>
                              {day.exercises.length === 0 ? (
                                <Text style={styles.noExercises}>Rest day</Text>
                              ) : (
                                day.exercises.map((ex: any, idx: number) => (
                                  <View key={ex.id} style={styles.exerciseRow}>
                                    <View style={styles.exerciseNum}>
                                      <Text style={styles.exerciseNumTxt}>{idx + 1}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.exerciseName}>
                                        {ex.exercise?.name ?? 'Exercise'}
                                      </Text>
                                      <Text style={styles.exerciseMeta}>
                                        {ex.sets} × {ex.reps}
                                        {ex.rest_seconds
                                          ? `  ·  ${ex.rest_seconds}s rest`
                                          : ''}
                                      </Text>
                                      {ex.exercise?.muscle_group ? (
                                        <View style={styles.tagRow}>
                                          <View style={styles.tag}>
                                            <Text style={styles.tagTxt}>
                                              {ex.exercise.muscle_group}
                                            </Text>
                                          </View>
                                        </View>
                                      ) : null}
                                      {ex.notes ? (
                                        <Text style={styles.exerciseNotes}>{ex.notes}</Text>
                                      ) : null}
                                      {ex.exercise?.cues ? (
                                        <Text style={styles.exerciseCues} numberOfLines={2}>
                                          💡 {ex.exercise.cues}
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                ))
                              )}
                            </Card>
                          ))}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.errorTxt}>Could not load plan details.</Text>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title:    { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  scroll:   { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  empty: { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },

  planWrapper: { marginBottom: spacing.md },
  planCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray200,
    padding: spacing.lg,
  },
  planCardOpen: { backgroundColor: colors.black, borderColor: colors.black },
  planTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  planGoal:  { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  planMeta:  { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },
  textWhite: { color: colors.white },

  planBody: {
    backgroundColor: colors.white, borderWidth: 1, borderTopWidth: 0,
    borderColor: colors.gray200, borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md, overflow: 'hidden',
  },

  week:      { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  weekLabel: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.gray400,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  dayCard:   { marginBottom: spacing.sm, padding: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  dayLabel:  { fontSize: fontSize.sm, fontWeight: '700', color: colors.black },

  noExercises: { fontSize: fontSize.sm, color: colors.gray400, fontStyle: 'italic' },

  exerciseRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  exerciseNum: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  exerciseNumTxt: { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray600 },
  exerciseName:   { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  exerciseMeta:   { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  tagRow:         { flexDirection: 'row', marginTop: spacing.xs },
  tag: {
    backgroundColor: colors.gray100, paddingHorizontal: spacing.sm,
    paddingVertical: 2, borderRadius: borderRadius.full,
  },
  tagTxt:          { fontSize: fontSize.xs, color: colors.gray600 },
  exerciseNotes:   { fontSize: fontSize.xs, color: colors.gray500, marginTop: spacing.xs, fontStyle: 'italic' },
  exerciseCues:    { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs, lineHeight: 16 },

  errorTxt: { fontSize: fontSize.sm, color: colors.red500, padding: spacing.lg },
});