// pt-app-mobile/app/pt/workout-detail.tsx
import React, { useEffect, useState } from 'react';
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

  const [plan, setPlan]             = useState<any>(null);
  const [exercises, setExercises]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]         = useState(false);

  const [planExercises, setPlanExercises] = useState<any[]>([]);
  const [dayId, setDayId]                 = useState<string | null>(null);

  // ── Add exercise modal ──
  const [addModal, setAddModal]     = useState(false);
  const [exSearch, setExSearch]     = useState('');
  const [selectedEx, setSelectedEx] = useState<any | null>(null);
  const [exParams, setExParams]     = useState({ sets: '3', reps: '8-12', rest_seconds: '60', notes: '' });

  // ── Edit exercise in plan modal ──
  const [editPlanExModal, setEditPlanExModal]   = useState(false);
  const [editingPlanEx, setEditingPlanEx]       = useState<any | null>(null);
  const [editPlanExParams, setEditPlanExParams] = useState({ sets: '', reps: '', rest_seconds: '', notes: '' });

  // ── Settings modal ──
  const [settingsModal, setSettingsModal]     = useState(false);
  const [planSettings, setPlanSettings]       = useState({ title: '', goal_focus: '', visibility: 'draft' });
  const [allClients, setAllClients]           = useState<any[]>([]);
  const [assignedClientId, setAssignedClientId] = useState<string>('');

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
        const p = pR.value.data;
        setPlan(p);
        setPlanSettings({
          title:      p.title ?? '',
          goal_focus: p.goal_focus ?? '',
          visibility: p.visibility ?? 'draft',
        });
        setAssignedClientId(p.client_id ?? '');
        const firstDay = p.weeks?.[0]?.days?.[0];
        if (firstDay) {
          setDayId(firstDay.id);
          setPlanExercises(firstDay.exercises ?? []);
        }
      }
      if (eR.status === 'fulfilled') setExercises(eR.value.data);
      if (cR.status === 'fulfilled') setAllClients(cR.value.data);
    } catch (err) {
      console.error('loadAll:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // ── Save plan ─────────────────────────────────────────────────────────────
  const savePlanWithExercises = async (
    updatedExercises: any[],
    updatedSettings?: typeof planSettings,
    updatedClientId?: string,
  ) => {
    if (!plan) return;
    setSaving(true);
    const settings  = updatedSettings ?? planSettings;
    const clientId  = updatedClientId !== undefined ? updatedClientId : assignedClientId;
    try {
      await API.put(`/workout-plans/${id}`, {
        title:      settings.title || plan.title,
        client_id:  clientId || null,
        goal_focus: settings.goal_focus || null,
        visibility: settings.visibility,
        weeks: [{
          week_number: 1,
          days: [{
            day_label: 'Workout',
            day_order:  1,
            exercises: updatedExercises.map((e: any, idx: number) => ({
              exercise_id:  e.exercise_id ?? e.exercise?.id,
              order:        idx + 1,
              sets:         e.sets,
              reps:         e.reps,
              rest_seconds: e.rest_seconds,
              notes:        e.notes || null,
            })),
          }],
        }],
      });
      await loadAll();
    } catch (err: any) {
      Alert.alert('Save failed', err.response?.data?.detail ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // ── Add exercise ──────────────────────────────────────────────────────────
  const confirmAddExercise = async () => {
    if (!selectedEx) return;
    const newEntry = {
      exercise_id:  selectedEx.id,
      order:        planExercises.length + 1,
      sets:         parseInt(exParams.sets) || 3,
      reps:         exParams.reps || '8-12',
      rest_seconds: parseInt(exParams.rest_seconds) || 60,
      notes:        exParams.notes || null,
      exercise:     selectedEx,
    };
    const updated = [...planExercises, newEntry];
    setPlanExercises(updated);
    setAddModal(false);
    setSelectedEx(null);
    setExSearch('');
    setExParams({ sets: '3', reps: '8-12', rest_seconds: '60', notes: '' });
    await savePlanWithExercises(updated);
  };

  // ── Remove exercise ───────────────────────────────────────────────────────
  const removeExercise = (idx: number) => {
    Alert.alert(
      'Remove Exercise',
      `Remove "${planExercises[idx]?.exercise?.name}" from this routine?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const updated = planExercises.filter((_, i) => i !== idx);
            setPlanExercises(updated);
            await savePlanWithExercises(updated);
          },
        },
      ]
    );
  };

  // ── Open edit-in-plan modal ───────────────────────────────────────────────
  const openEditPlanEx = (ex: any) => {
    setEditingPlanEx(ex);
    setEditPlanExParams({
      sets:         String(ex.sets),
      reps:         ex.reps,
      rest_seconds: String(ex.rest_seconds),
      notes:        ex.notes ?? '',
    });
    setEditPlanExModal(true);
  };

  // ── Save edit-in-plan ─────────────────────────────────────────────────────
  const confirmEditPlanEx = async () => {
    if (!editingPlanEx) return;
    const updated = planExercises.map((e) => {
      const key  = e.exercise_id ?? e.exercise?.id;
      const eKey = editingPlanEx.exercise_id ?? editingPlanEx.exercise?.id;
      if (key === eKey && e.order === editingPlanEx.order) {
        return {
          ...e,
          sets:         parseInt(editPlanExParams.sets) || e.sets,
          reps:         editPlanExParams.reps || e.reps,
          rest_seconds: parseInt(editPlanExParams.rest_seconds) || e.rest_seconds,
          notes:        editPlanExParams.notes || null,
        };
      }
      return e;
    });
    setPlanExercises(updated);
    setEditPlanExModal(false);
    setEditingPlanEx(null);
    await savePlanWithExercises(updated);
  };

  // ── Save settings ─────────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSettingsModal(false);
    await savePlanWithExercises(planExercises, planSettings, assignedClientId);
  };

  const filteredExercises = exercises.filter((e) =>
    e.name.toLowerCase().includes(exSearch.toLowerCase()) ||
    (e.muscle_group ?? '').toLowerCase().includes(exSearch.toLowerCase())
  );

  const visibilityLabel = planSettings.visibility === 'client_visible'
    ? '✓ Visible to client'
    : '⬜ Draft (hidden)';

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
        {/* ↓ FIXED: always goes to workouts list, not home */}
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.navigate('/pt/workouts')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.black} />
          <Text style={styles.backTxt}>Back to Routines</Text>
        </TouchableOpacity>
        <Text style={styles.emptyText}>Plan not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header — FIXED back button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.navigate('/pt/workouts')}  // ← was router.back()
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{plan.title}</Text>
          <Text style={styles.headerSub}>
            {plan.goal_focus ? `${plan.goal_focus}  ·  ` : ''}{visibilityLabel}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsModal(true)}>
          <Ionicons name="settings-outline" size={20} color={colors.black} />
        </TouchableOpacity>
        {saving && (
          <ActivityIndicator color={colors.black} style={{ marginLeft: spacing.sm }} size="small" />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Exercises list */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Exercises ({planExercises.length})
          </Text>
          <TouchableOpacity
            style={styles.addExBtn}
            onPress={() => {
              setSelectedEx(null);
              setExSearch('');
              setExParams({ sets: '3', reps: '8-12', rest_seconds: '60', notes: '' });
              setAddModal(true);
            }}
          >
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.addExBtnTxt}>Add Exercise</Text>
          </TouchableOpacity>
        </View>

        {planExercises.length === 0 ? (
          <TouchableOpacity style={styles.emptyExCard} onPress={() => setAddModal(true)}>
            <Ionicons name="add-circle-outline" size={32} color={colors.gray300} />
            <Text style={styles.emptyExTitle}>No exercises yet</Text>
            <Text style={styles.emptyExText}>Tap to add your first exercise to this routine.</Text>
          </TouchableOpacity>
        ) : (
          planExercises.map((ex: any, idx: number) => (
            <Card key={`${ex.exercise_id ?? ex.exercise?.id}-${idx}`} style={styles.exCard}>
              <View style={styles.exRow}>
                <View style={styles.exNum}>
                  <Text style={styles.exNumTxt}>{idx + 1}</Text>
                </View>
                {ex.exercise?.image_url ? (
                  <Image source={{ uri: ex.exercise.image_url }} style={styles.exThumb} />
                ) : (
                  <View style={styles.exThumbEmpty}>
                    <Ionicons name="barbell-outline" size={18} color={colors.gray400} />
                  </View>
                )}
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditPlanEx(ex)}>
                  <Text style={styles.exName}>{ex.exercise?.name ?? 'Exercise'}</Text>
                  <Text style={styles.exMeta}>
                    {ex.sets} sets × {ex.reps} reps
                    {ex.rest_seconds ? `  ·  ${ex.rest_seconds}s rest` : ''}
                  </Text>
                  {ex.exercise?.muscle_group ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagTxt}>{ex.exercise.muscle_group}</Text>
                    </View>
                  ) : null}
                  {ex.notes ? <Text style={styles.exNotes}>{ex.notes}</Text> : null}
                  <Text style={styles.tapToEdit}>Tap to edit sets/reps →</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeExercise(idx)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={22} color={colors.gray300} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}

        {/* Coaching cues */}
        {planExercises.some((e) => e.exercise?.cues) && (
          <View style={styles.cuesSection}>
            <Text style={styles.cuesTitle}>Coaching Cues</Text>
            {planExercises.filter((e) => e.exercise?.cues).map((ex, idx) => (
              <Card key={idx} style={styles.cueCard}>
                <Text style={styles.cueName}>{ex.exercise.name}</Text>
                <Text style={styles.cueText}>{ex.exercise.cues}</Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Add Exercise Modal ── */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <TouchableOpacity onPress={() => { setAddModal(false); setSelectedEx(null); }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>

            {!selectedEx ? (
              <>
                <View style={styles.searchRow}>
                  <Ionicons name="search-outline" size={16} color={colors.gray400} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search exercises..."
                    placeholderTextColor={colors.gray400}
                    value={exSearch}
                    onChangeText={setExSearch}
                    autoFocus
                  />
                  {exSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setExSearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.gray400} />
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView style={styles.exPickList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
                  {filteredExercises.length === 0 ? (
                    <Text style={styles.noResultsTxt}>No exercises match "{exSearch}"</Text>
                  ) : (
                    filteredExercises.map((ex) => (
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
                    ))
                  )}
                </ScrollView>
              </>
            ) : (
              <ScrollView style={styles.exPickList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
                <TouchableOpacity
                  style={styles.backToListBtn}
                  onPress={() => setSelectedEx(null)}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.black} />
                  <Text style={styles.backToListTxt}>Back to list</Text>
                </TouchableOpacity>

                <Card style={styles.selectedExCard}>
                  {selectedEx.image_url ? (
                    <Image source={{ uri: selectedEx.image_url }} style={styles.selectedExImg} />
                  ) : null}
                  <Text style={styles.selectedExName}>{selectedEx.name}</Text>
                  {selectedEx.muscle_group ? (
                    <View style={styles.tag}><Text style={styles.tagTxt}>{selectedEx.muscle_group}</Text></View>
                  ) : null}
                  {selectedEx.cues ? (
                    <Text style={styles.selectedExCues} numberOfLines={3}>💡 {selectedEx.cues}</Text>
                  ) : null}
                </Card>

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
                  <Text style={styles.confirmBtnTxt}>Add to Routine</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Edit Plan Exercise Modal ── */}
      <Modal visible={editPlanExModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit: {editingPlanEx?.exercise?.name ?? 'Exercise'}
              </Text>
              <TouchableOpacity onPress={() => { setEditPlanExModal(false); setEditingPlanEx(null); }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.exPickList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <View style={styles.paramsGrid}>
                <View style={styles.paramField}>
                  <Text style={styles.paramLabel}>Sets</Text>
                  <TextInput
                    style={styles.paramInput}
                    value={editPlanExParams.sets}
                    onChangeText={(v) => setEditPlanExParams((f) => ({ ...f, sets: v }))}
                    keyboardType="numeric"
                    placeholderTextColor={colors.gray400}
                  />
                </View>
                <View style={styles.paramField}>
                  <Text style={styles.paramLabel}>Reps</Text>
                  <TextInput
                    style={styles.paramInput}
                    value={editPlanExParams.reps}
                    onChangeText={(v) => setEditPlanExParams((f) => ({ ...f, reps: v }))}
                    placeholderTextColor={colors.gray400}
                  />
                </View>
                <View style={styles.paramField}>
                  <Text style={styles.paramLabel}>Rest (sec)</Text>
                  <TextInput
                    style={styles.paramInput}
                    value={editPlanExParams.rest_seconds}
                    onChangeText={(v) => setEditPlanExParams((f) => ({ ...f, rest_seconds: v }))}
                    keyboardType="numeric"
                    placeholderTextColor={colors.gray400}
                  />
                </View>
              </View>
              <Text style={styles.paramLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.paramInput, { minHeight: 60, textAlignVertical: 'top', marginTop: spacing.sm }]}
                value={editPlanExParams.notes}
                onChangeText={(v) => setEditPlanExParams((f) => ({ ...f, notes: v }))}
                placeholder="Coaching notes for this exercise..."
                placeholderTextColor={colors.gray400}
                multiline
              />
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmEditPlanEx}>
                <Text style={styles.confirmBtnTxt}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Plan Settings Modal ── */}
      <Modal visible={settingsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Routine Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.exPickList} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.paramLabel}>Routine Name</Text>
              <TextInput
                style={[styles.paramInput, { marginBottom: spacing.md }]}
                value={planSettings.title}
                onChangeText={(v) => setPlanSettings((f) => ({ ...f, title: v }))}
                placeholder="e.g. Push Day, Chest Day, Leg Day"
                placeholderTextColor={colors.gray400}
              />

              <Text style={styles.paramLabel}>Goal / Focus</Text>
              <TextInput
                style={[styles.paramInput, { marginBottom: spacing.md }]}
                value={planSettings.goal_focus}
                onChangeText={(v) => setPlanSettings((f) => ({ ...f, goal_focus: v }))}
                placeholder="e.g. Hypertrophy, Strength"
                placeholderTextColor={colors.gray400}
              />

              <Text style={styles.paramLabel}>Assign to Client</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <TouchableOpacity
                  style={[styles.assignChip, !assignedClientId && styles.assignChipActive]}
                  onPress={() => setAssignedClientId('')}
                >
                  <Text style={[styles.assignChipTxt, !assignedClientId && { color: colors.white }]}>
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {allClients.filter((c: any) => c.status === 'active').map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.assignChip, assignedClientId === c.id && styles.assignChipActive]}
                    onPress={() => setAssignedClientId(c.id)}
                  >
                    <Text style={[styles.assignChipTxt, assignedClientId === c.id && { color: colors.white }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.paramLabel}>Visibility</Text>
              <View style={styles.visRow}>
                {[
                  { val: 'draft',          label: '⬜  Draft — hidden from client' },
                  { val: 'client_visible', label: '✓  Visible to assigned client' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.val}
                    style={[styles.visOption, planSettings.visibility === opt.val && styles.visOptionActive]}
                    onPress={() => setPlanSettings((f) => ({ ...f, visibility: opt.val }))}
                  >
                    <Text style={[
                      styles.visOptionTxt,
                      planSettings.visibility === opt.val && { color: colors.white },
                    ]}>
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
  iconBtn:    { padding: spacing.sm, marginLeft: spacing.xs },
  backRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  backTxt:    { fontSize: fontSize.md, color: colors.black },
  scroll:     { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  sectionTitle:{ fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.black, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
  },
  addExBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },
  emptyExCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl,
    gap: spacing.sm,
  },
  emptyExTitle:{ fontSize: fontSize.md, fontWeight: '600', color: colors.gray600 },
  emptyExText: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
  emptyText:   { fontSize: fontSize.md, color: colors.gray500, textAlign: 'center', marginTop: spacing.xxl },
  exCard:      { marginBottom: spacing.sm },
  exRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  exNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  exNumTxt:   { fontSize: fontSize.sm, fontWeight: '700', color: colors.gray600 },
  exThumb:    { width: 52, height: 52, borderRadius: borderRadius.sm, flexShrink: 0 },
  exThumbEmpty: {
    width: 52, height: 52, borderRadius: borderRadius.sm,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  exName:    { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  exMeta:    { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  tag: {
    alignSelf: 'flex-start', backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: borderRadius.full, marginTop: spacing.xs,
  },
  tagTxt:    { fontSize: fontSize.xs, color: colors.gray600 },
  exNotes:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs, fontStyle: 'italic' },
  tapToEdit: { fontSize: fontSize.xs, color: colors.gray300, marginTop: spacing.xs },
  removeBtn: { padding: spacing.xs },
  cuesSection: { marginTop: spacing.xl },
  cuesTitle:   { fontSize: fontSize.md, fontWeight: '700', color: colors.black, marginBottom: spacing.md },
  cueCard:     { marginBottom: spacing.sm },
  cueName:     { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginBottom: spacing.xs },
  cueText:     { fontSize: fontSize.sm, color: colors.gray500, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.black },
  exPickList:  { flex: 1, paddingHorizontal: spacing.xl },
  exPickRow: {
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
  noResultsTxt: { textAlign: 'center', color: colors.gray400, paddingVertical: spacing.xxl },
  backToListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, marginBottom: spacing.sm,
  },
  backToListTxt: { fontSize: fontSize.sm, fontWeight: '500', color: colors.black },
  selectedExCard: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  selectedExImg:  { width: '100%', height: 140, borderRadius: borderRadius.sm },
  selectedExName: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  selectedExCues: { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  paramsGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.md },
  paramField: { flex: 1 },
  paramLabel: {
    fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700,
    marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  paramInput: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  confirmBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl,
  },
  confirmBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  assignChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200, marginRight: spacing.sm,
  },
  assignChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  assignChipTxt:    { fontSize: fontSize.sm, color: colors.gray600 },
  visRow:           { gap: spacing.sm, marginBottom: spacing.lg },
  visOption: {
    padding: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray200,
  },
  visOptionActive:  { backgroundColor: colors.black, borderColor: colors.black },
  visOptionTxt:     { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray600 },
});