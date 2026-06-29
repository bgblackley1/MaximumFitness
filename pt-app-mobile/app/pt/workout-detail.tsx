// pt-app-mobile/app/pt/workout-detail.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [plan, setPlan]           = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [clients, setClients]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]       = useState(false);

  // Add exercise modal
  const [addExModal, setAddExModal] = useState(false);
  const [targetDayId, setTargetDayId] = useState<string | null>(null);
  const [exSearch, setExSearch]     = useState('');
  const [selectedEx, setSelectedEx] = useState<any | null>(null);
  const [exParams, setExParams]     = useState({ sets: '3', reps: '8-12', rest_seconds: '60', notes: '' });

  // Settings modal
  const [settingsModal, setSettingsModal] = useState(false);
  const [planSettings, setPlanSettings]   = useState({ title: '', goal_focus: '', client_id: '', visibility: 'draft' });

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    try {
      const [pR, eR, cR] = await Promise.allSettled([
        API.get(`/workout-plans/${id}`),
        API.get('/exercises'),
        API.get('/clients'),
      ]);
      if (pR.status === 'fulfilled') {
        setPlan(pR.value.data);
        const p = pR.value.data;
        setPlanSettings({
          title:      p.title,
          goal_focus: p.goal_focus ?? '',
          client_id:  p.client_id ?? '',
          visibility: p.visibility ?? 'draft',
        });
      }
      if (eR.status === 'fulfilled') setExercises(eR.value.data);
      if (cR.status === 'fulfilled') setClients(cR.value.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // ── Rebuild and save entire plan ──────────────────────────────────────────
  const savePlan = async (updatedPlan: any) => {
    setSaving(true);
    try {
      await API.put(`/workout-plans/${id}`, {
        title:      updatedPlan.title,
        client_id:  updatedPlan.client_id || null,
        goal_focus: updatedPlan.goal_focus || null,
        visibility: updatedPlan.visibility,
        weeks: updatedPlan.weeks.map((w: any) => ({
          week_number: w.week_number,
          days: w.days.map((d: any) => ({
            day_label: d.day_label,
            day_order: d.day_order,
            exercises: d.exercises.map((e: any) => ({
              exercise_id:  e.exercise_id ?? e.exercise?.id,
              order:        e.order,
              sets:         e.sets,
              reps:         e.reps,
              rest_seconds: e.rest_seconds,
              notes:        e.notes || null,
            })),
          })),
        })),
      });
      await loadAll();
    } catch (err: any) {
      Alert.alert('Save failed', err.response?.data?.detail ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // ── Add week ──────────────────────────────────────────────────────────────
  const addWeek = async () => {
    if (!plan) return;
    const nextWeek = (plan.weeks?.length ?? 0) + 1;
    const updated  = {
      ...plan,
      ...planSettings,
      weeks: [
        ...(plan.weeks ?? []),
        {
          week_number: nextWeek,
          days: [{ day_label: 'Day 1', day_order: 1, exercises: [] }],
        },
      ],
    };
    await savePlan(updated);
  };

  // ── Add day to week ───────────────────────────────────────────────────────
  const addDay = async (weekIndex: number) => {
    if (!plan) return;
    const weeks    = [...(plan.weeks ?? [])];
    const week     = { ...weeks[weekIndex] };
    const dayOrder = (week.days?.length ?? 0) + 1;
    week.days = [
      ...(week.days ?? []),
      { day_label: `Day ${dayOrder}`, day_order: dayOrder, exercises: [] },
    ];
    weeks[weekIndex] = week;
    await savePlan({ ...plan, ...planSettings, weeks });
  };

  // ── Remove day ────────────────────────────────────────────────────────────
  const removeDay = async (weekIndex: number, dayIndex: number) => {
    if (!plan) return;
    Alert.alert('Remove Day', 'Remove this day and all its exercises?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const weeks = [...(plan.weeks ?? [])];
          weeks[weekIndex] = {
            ...weeks[weekIndex],
            days: weeks[weekIndex].days.filter((_: any, i: number) => i !== dayIndex),
          };
          await savePlan({ ...plan, ...planSettings, weeks });
        },
      },
    ]);
  };

  // ── Remove week ───────────────────────────────────────────────────────────
  const removeWeek = async (weekIndex: number) => {
    if (!plan) return;
    Alert.alert('Remove Week', 'Remove this week and all its days?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const weeks = (plan.weeks ?? []).filter((_: any, i: number) => i !== weekIndex);
          await savePlan({ ...plan, ...planSettings, weeks });
        },
      },
    ]);
  };

  // ── Open add exercise modal ───────────────────────────────────────────────
  const openAddExercise = (dayId: string) => {
    setTargetDayId(dayId);
    setSelectedEx(null);
    setExSearch('');
    setExParams({ sets: '3', reps: '8-12', rest_seconds: '60', notes: '' });
    setAddExModal(true);
  };

  // ── Confirm add exercise ──────────────────────────────────────────────────
  const confirmAddExercise = async () => {
    if (!selectedEx || !plan || !targetDayId) return;
    const weeks = (plan.weeks ?? []).map((w: any) => ({
      ...w,
      days: w.days.map((d: any) => {
        if (d.id !== targetDayId) return d;
        const order = (d.exercises?.length ?? 0) + 1;
        return {
          ...d,
          exercises: [
            ...(d.exercises ?? []),
            {
              exercise_id:  selectedEx.id,
              order,
              sets:         parseInt(exParams.sets) || 3,
              reps:         exParams.reps || '8-12',
              rest_seconds: parseInt(exParams.rest_seconds) || 60,
              notes:        exParams.notes || null,
              exercise:     selectedEx, // for local display
            },
          ],
        };
      }),
    }));
    setAddExModal(false);
    await savePlan({ ...plan, ...planSettings, weeks });
  };

  // ── Remove exercise from day ──────────────────────────────────────────────
  const removeExercise = async (dayId: string, exIndex: number) => {
    if (!plan) return;
    const weeks = (plan.weeks ?? []).map((w: any) => ({
      ...w,
      days: w.days.map((d: any) => {
        if (d.id !== dayId) return d;
        return {
          ...d,
          exercises: d.exercises.filter((_: any, i: number) => i !== exIndex),
        };
      }),
    }));
    await savePlan({ ...plan, ...planSettings, weeks });
  };

  // ── Save settings ─────────────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!plan) return;
    setSettingsModal(false);
    await savePlan({ ...plan, ...planSettings });
  };

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(exSearch.toLowerCase()) ||
    (e.muscle_group ?? '').toLowerCase().includes(exSearch.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.black} />
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: 'center', marginTop: 40, color: colors.gray500 }}>
          Plan not found.
        </Text>
      </SafeAreaView>
    );
  }

  const visibilityLabel = planSettings.visibility === 'client_visible' ? 'Visible to Client' : 'Draft';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{plan.title}</Text>
          <Text style={styles.headerSub}>{visibilityLabel}</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setSettingsModal(true)}>
          <Ionicons name="settings-outline" size={20} color={colors.black} />
        </TouchableOpacity>
        {saving && <ActivityIndicator color={colors.black} style={{ marginLeft: spacing.sm }} />}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Weeks */}
        {(plan.weeks ?? []).map((week: any, wIdx: number) => (
          <View key={week.id ?? wIdx} style={styles.weekContainer}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>WEEK {week.week_number}</Text>
              <View style={styles.weekActions}>
                <TouchableOpacity
                  style={styles.weekActionBtn}
                  onPress={() => addDay(wIdx)}
                >
                  <Ionicons name="add" size={16} color={colors.black} />
                  <Text style={styles.weekActionTxt}>Add Day</Text>
                </TouchableOpacity>
                {(plan.weeks?.length ?? 0) > 1 && (
                  <TouchableOpacity onPress={() => removeWeek(wIdx)}>
                    <Ionicons name="trash-outline" size={16} color={colors.red500} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Days */}
            {(week.days ?? []).map((day: any, dIdx: number) => (
              <Card key={day.id ?? dIdx} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{day.day_label}</Text>
                  <View style={styles.dayActions}>
                    <TouchableOpacity
                      style={styles.addExBtn}
                      onPress={() => openAddExercise(day.id)}
                    >
                      <Ionicons name="add" size={14} color={colors.white} />
                      <Text style={styles.addExBtnTxt}>Exercise</Text>
                    </TouchableOpacity>
                    {(week.days?.length ?? 0) > 1 && (
                      <TouchableOpacity
                        onPress={() => removeDay(wIdx, dIdx)}
                        style={{ marginLeft: spacing.sm }}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.red500} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Exercises */}
                {(day.exercises ?? []).length === 0 ? (
                  <TouchableOpacity
                    style={styles.emptyDayBtn}
                    onPress={() => openAddExercise(day.id)}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={colors.gray400} />
                    <Text style={styles.emptyDayTxt}>Tap to add exercises</Text>
                  </TouchableOpacity>
                ) : (
                  (day.exercises ?? []).map((ex: any, eIdx: number) => (
                    <View key={ex.id ?? eIdx} style={styles.exRow}>
                      <View style={styles.exNum}>
                        <Text style={styles.exNumTxt}>{eIdx + 1}</Text>
                      </View>
                      {ex.exercise?.image_url ? (
                        <Image source={{ uri: ex.exercise.image_url }} style={styles.exThumb} />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exName}>
                          {ex.exercise?.name ?? 'Exercise'}
                        </Text>
                        <Text style={styles.exMeta}>
                          {ex.sets} sets × {ex.reps} reps · {ex.rest_seconds}s rest
                        </Text>
                        {ex.exercise?.muscle_group ? (
                          <View style={styles.exTag}>
                            <Text style={styles.exTagTxt}>{ex.exercise.muscle_group}</Text>
                          </View>
                        ) : null}
                        {ex.notes ? (
                          <Text style={styles.exNotes}>{ex.notes}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        onPress={() => Alert.alert('Remove?', `Remove ${ex.exercise?.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeExercise(day.id, eIdx) },
                        ])}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.gray300} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </Card>
            ))}
          </View>
        ))}

        {/* Add week button */}
        <TouchableOpacity style={styles.addWeekBtn} onPress={addWeek}>
          <Ionicons name="add" size={20} color={colors.gray600} />
          <Text style={styles.addWeekTxt}>Add Week {(plan.weeks?.length ?? 0) + 1}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Add Exercise Modal ── */}
      <Modal visible={addExModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <TouchableOpacity onPress={() => setAddExModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={16} color={colors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor={colors.gray400}
                value={exSearch}
                onChangeText={setExSearch}
              />
            </View>

            {!selectedEx ? (
              // Exercise list
              <ScrollView style={styles.exList} contentContainerStyle={{ paddingBottom: spacing.xl }}>
                {filteredExercises.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={styles.exPickRow}
                    onPress={() => setSelectedEx(ex)}
                  >
                    {ex.image_url ? (
                      <Image source={{ uri: ex.image_url }} style={styles.exPickThumb} />
                    ) : (
                      <View style={styles.exPickThumbEmpty}>
                        <Ionicons name="barbell-outline" size={18} color={colors.gray400} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exPickName}>{ex.name}</Text>
                      <Text style={styles.exPickMeta}>
                        {[ex.muscle_group, ex.equipment].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
                  </TouchableOpacity>
                ))}
                {filteredExercises.length === 0 && (
                  <Text style={styles.noResults}>No exercises match "{exSearch}"</Text>
                )}
              </ScrollView>
            ) : (
              // Set params
              <ScrollView style={styles.exList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
                <TouchableOpacity
                  style={styles.backToList}
                  onPress={() => setSelectedEx(null)}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.black} />
                  <Text style={styles.backToListTxt}>Back to list</Text>
                </TouchableOpacity>

                <View style={styles.selectedExCard}>
                  {selectedEx.image_url ? (
                    <Image source={{ uri: selectedEx.image_url }} style={styles.selectedExImg} />
                  ) : null}
                  <Text style={styles.selectedExName}>{selectedEx.name}</Text>
                  {selectedEx.muscle_group ? (
                    <Text style={styles.selectedExMeta}>{selectedEx.muscle_group}</Text>
                  ) : null}
                </View>

                <View style={styles.paramsGrid}>
                  <View style={styles.paramField}>
                    <Text style={styles.paramLabel}>Sets</Text>
                    <TextInput
                      style={styles.paramInput}
                      value={exParams.sets}
                      onChangeText={(v) => setExParams((f) => ({ ...f, sets: v }))}
                      keyboardType="numeric"
                      placeholder="3"
                      placeholderTextColor={colors.gray400}
                    />
                  </View>
                  <View style={styles.paramField}>
                    <Text style={styles.paramLabel}>Reps</Text>
                    <TextInput
                      style={styles.paramInput}
                      value={exParams.reps}
                      onChangeText={(v) => setExParams((f) => ({ ...f, reps: v }))}
                      placeholder="8-12"
                      placeholderTextColor={colors.gray400}
                    />
                  </View>
                  <View style={styles.paramField}>
                    <Text style={styles.paramLabel}>Rest (sec)</Text>
                    <TextInput
                      style={styles.paramInput}
                      value={exParams.rest_seconds}
                      onChangeText={(v) => setExParams((f) => ({ ...f, rest_seconds: v }))}
                      keyboardType="numeric"
                      placeholder="60"
                      placeholderTextColor={colors.gray400}
                    />
                  </View>
                </View>

                <Text style={styles.paramLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.paramInput, { minHeight: 60, textAlignVertical: 'top', marginTop: spacing.sm }]}
                  value={exParams.notes}
                  onChangeText={(v) => setExParams((f) => ({ ...f, notes: v }))}
                  placeholder="e.g. Pause at bottom for 1 second..."
                  placeholderTextColor={colors.gray400}
                  multiline
                />

                <TouchableOpacity style={styles.confirmBtn} onPress={confirmAddExercise}>
                  <Text style={styles.confirmBtnTxt}>Add to Plan</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Plan Settings Modal ── */}
      <Modal visible={settingsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.exList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                value={planSettings.title}
                onChangeText={(v) => setPlanSettings((f) => ({ ...f, title: v }))}
                placeholder="Plan title"
                placeholderTextColor={colors.gray400}
              />

              <Text style={styles.fieldLabel}>Goal / Focus</Text>
              <TextInput
                style={styles.textInput}
                value={planSettings.goal_focus}
                onChangeText={(v) => setPlanSettings((f) => ({ ...f, goal_focus: v }))}
                placeholder="e.g. Hypertrophy"
                placeholderTextColor={colors.gray400}
              />

              <Text style={styles.fieldLabel}>Assign to Client</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.settingsChip, !planSettings.client_id && styles.settingsChipActive]}
                  onPress={() => setPlanSettings((f) => ({ ...f, client_id: '' }))}
                >
                  <Text style={[styles.settingsChipTxt, !planSettings.client_id && { color: colors.white }]}>
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {clients.map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.settingsChip, planSettings.client_id === c.id && styles.settingsChipActive]}
                    onPress={() => setPlanSettings((f) => ({ ...f, client_id: c.id }))}
                  >
                    <Text style={[styles.settingsChipTxt, planSettings.client_id === c.id && { color: colors.white }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Visibility</Text>
              <View style={styles.visRow}>
                {[
                  { val: 'draft', label: 'Draft (hidden from client)' },
                  { val: 'client_visible', label: 'Visible to Client' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.val}
                    style={[styles.visOption, planSettings.visibility === opt.val && styles.visOptionActive]}
                    onPress={() => setPlanSettings((f) => ({ ...f, visibility: opt.val }))}
                  >
                    <Text style={[styles.visOptionTxt, planSettings.visibility === opt.val && { color: colors.white }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.confirmBtn} onPress={saveSettings}>
                <Text style={styles.confirmBtnTxt}>Save Settings</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  backBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  headerSub:  { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1 },
  settingsBtn:{ padding: spacing.sm },
  scroll:     { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, paddingBottom: spacing.xxxl * 2 },

  weekContainer: { marginBottom: spacing.xl },
  weekHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.sm,
  },
  weekLabel:  { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray400, letterSpacing: 1, textTransform: 'uppercase' },
  weekActions:{ flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weekActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full,
  },
  weekActionTxt: { fontSize: fontSize.xs, fontWeight: '500', color: colors.black },

  dayCard:    { marginBottom: spacing.sm },
  dayHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  dayLabel:   { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  dayActions: { flexDirection: 'row', alignItems: 'center' },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.black, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: borderRadius.full,
  },
  addExBtnTxt:{ fontSize: fontSize.xs, color: colors.white, fontWeight: '600' },

  emptyDayBtn:{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, justifyContent: 'center' },
  emptyDayTxt:{ fontSize: fontSize.sm, color: colors.gray400 },

  exRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  exNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  exNumTxt:  { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray600 },
  exThumb:   { width: 40, height: 40, borderRadius: borderRadius.sm, flexShrink: 0 },
  exName:    { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  exMeta:    { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  exTag: {
    alignSelf: 'flex-start', backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: borderRadius.full, marginTop: spacing.xs,
  },
  exTagTxt:  { fontSize: fontSize.xs, color: colors.gray600 },
  exNotes:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs, fontStyle: 'italic' },

  addWeekBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.lg, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  addWeekTxt: { fontSize: fontSize.md, fontWeight: '500', color: colors.gray600 },

  // Modal
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
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  searchInput:{ flex: 1, fontSize: fontSize.md, color: colors.black },
  exList:     { flex: 1, paddingHorizontal: spacing.xl },
  exPickRow:  {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  exPickThumb:      { width: 44, height: 44, borderRadius: borderRadius.sm },
  exPickThumbEmpty: {
    width: 44, height: 44, borderRadius: borderRadius.sm,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  exPickName: { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  exPickMeta: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  noResults:  { textAlign: 'center', color: colors.gray400, paddingVertical: spacing.xxl },

  backToList:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  backToListTxt: { fontSize: fontSize.sm, fontWeight: '500', color: colors.black },
  selectedExCard: { alignItems: 'center', paddingVertical: spacing.lg },
  selectedExImg:  { width: 80, height: 60, borderRadius: borderRadius.sm, marginBottom: spacing.sm },
  selectedExName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  selectedExMeta: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },

  paramsGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  paramField: { flex: 1 },
  paramLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginBottom: spacing.sm },
  paramInput: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  textInput: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  confirmBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl,
  },
  confirmBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },

  settingsChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200, marginRight: spacing.sm,
  },
  settingsChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  settingsChipTxt:    { fontSize: fontSize.sm, color: colors.gray600 },
  visRow:             { gap: spacing.sm, marginBottom: spacing.lg },
  visOption: {
    padding: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray200,
  },
  visOptionActive:  { backgroundColor: colors.black, borderColor: colors.black },
  visOptionTxt:     { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray600 },
});