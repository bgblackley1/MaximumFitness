import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, RefreshControl, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExerciseLib {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  category: string | null;
}

interface EditEx {
  _key:         string;
  exercise_id:  string;
  name:         string;
  muscle_group: string | null;
  sets:         number;
  reps:         string;
  rest_seconds: number;
  notes:        string;
  order:        number;
}

const FOCUS_OPTIONS = [
  { value: 'arms',      label: 'Arms'      },
  { value: 'legs',      label: 'Legs'      },
  { value: 'push',      label: 'Push'      },
  { value: 'pull',      label: 'Pull'      },
  { value: 'back',      label: 'Back'      },
  { value: 'chest',     label: 'Chest'     },
  { value: 'core',      label: 'Core'      },
  { value: 'full_body', label: 'Full Body' },
  { value: 'cardio',    label: 'Cardio'    },
];

const newKey = () => Math.random().toString(36).slice(2);

// ── Screen ────────────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router  = useRouter();
  const isNew   = !id;

  // Plan state
  const [title,      setTitle]      = useState('');
  const [focus,      setFocus]      = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'draft' | 'client_visible'>('draft');
  const [exercises,  setExercises]  = useState<EditEx[]>([]);

  // UI state
  const [loading,    setLoading]    = useState(!isNew);
  const [refreshing, setRefreshing] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState('');

  // Assigned clients (display only)
  const [assignedClients, setAssignedClients] = useState<{ id: string; name: string }[]>([]);

  // Exercise picker modal
  const [showPicker,     setShowPicker]     = useState(false);
  const [exSearch,       setExSearch]       = useState('');
  const [exLibrary,      setExLibrary]      = useState<ExerciseLib[]>([]);
  const [loadingEx,      setLoadingEx]      = useState(false);

  // Inline exercise creator (within picker)
  const [showCreateEx,   setShowCreateEx]   = useState(false);
  const [creatingEx,     setCreatingEx]     = useState(false);
  const [newExForm,      setNewExForm]      = useState({
    name: '', muscle_group: '', equipment: '', category: 'isolation', cues: '',
  });

  // Edit single exercise (sets/reps/rest)
  const [editTarget, setEditTarget] = useState<EditEx | null>(null);
  const [editForm,   setEditForm]   = useState<Partial<EditEx>>({});
  const [showEdit,   setShowEdit]   = useState(false);

  useEffect(() => {
    loadExLibrary();
    if (!isNew && id) loadWorkout();
  }, [id]);

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadWorkout = async () => {
    try {
      const res  = await API.get(`/workout-plans/${id}`);
      const data = res.data;
      setTitle(data.title ?? '');
      setFocus(data.focus ?? null);
      setVisibility(data.visibility ?? 'draft');
      setAssignedClients(data.assigned_clients ?? []);
      setExercises(
        (data.exercises ?? []).map((e: any) => ({
          _key:         e.id ?? newKey(),
          exercise_id:  e.exercise_id,
          name:         e.name ?? 'Unknown',
          muscle_group: e.muscle_group ?? null,
          sets:         e.sets,
          reps:         e.reps,
          rest_seconds: e.rest_seconds,
          notes:        e.notes ?? '',
          order:        e.order,
        }))
      );
    } catch (e) {
      console.error('loadWorkout:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    if (isNew) return;
    setRefreshing(true);
    await loadWorkout();
    setRefreshing(false);
  };

  const loadExLibrary = async () => {
    setLoadingEx(true);
    try {
      const res = await API.get('/exercises');
      setExLibrary(res.data);
    } catch (e) {
      console.error('loadExLibrary:', e);
    } finally {
      setLoadingEx(false);
    }
  };

  // ── Save workout ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) { setSaveError('Workout title is required.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        title:      title.trim(),
        focus:      focus,
        visibility: visibility,
        exercises:  exercises.map((e, i) => ({
          exercise_id:  e.exercise_id,
          order:        i + 1,
          sets:         e.sets,
          reps:         e.reps,
          rest_seconds: e.rest_seconds,
          notes:        e.notes || null,
        })),
      };
      if (isNew) {
        const res = await API.post('/workout-plans', payload);
        router.replace(`/pt/workout-detail?id=${res.data.plan_id}` as any);
      } else {
        await API.put(`/workout-plans/${id}`, payload);
        await loadWorkout();
      }
    } catch (e: any) {
      setSaveError(e.response?.data?.detail ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Exercise picker ───────────────────────────────────────────────────────

  const openPicker = () => {
    setExSearch('');
    setShowCreateEx(false);
    setNewExForm({ name: '', muscle_group: '', equipment: '', category: 'isolation', cues: '' });
    setShowPicker(true);
  };

  const addExercise = (ex: ExerciseLib) => {
    setExercises((prev) => [
      ...prev,
      {
        _key:         newKey(),
        exercise_id:  ex.id,
        name:         ex.name,
        muscle_group: ex.muscle_group,
        sets:         3,
        reps:         '8-12',
        rest_seconds: 60,
        notes:        '',
        order:        prev.length + 1,
      },
    ]);
    setShowPicker(false);
  };

  const removeExercise = (key: string) => {
    setExercises((prev) => prev.filter((e) => e._key !== key));
  };

  // ── Inline exercise creation ──────────────────────────────────────────────

  const handleCreateExercise = async () => {
    if (!newExForm.name.trim()) {
      Alert.alert('Error', 'Exercise name is required.');
      return;
    }
    setCreatingEx(true);
    try {
      const res = await API.post('/exercises', {
        name:         newExForm.name.trim(),
        muscle_group: newExForm.muscle_group || null,
        equipment:    newExForm.equipment || null,
        category:     newExForm.category || null,
        cues:         newExForm.cues || null,
      });
      const newEx: ExerciseLib = res.data;
      // Add to library
      setExLibrary((prev) => [newEx, ...prev]);
      // Add to workout directly
      setExercises((prev) => [
        ...prev,
        {
          _key:         newKey(),
          exercise_id:  newEx.id,
          name:         newEx.name,
          muscle_group: newEx.muscle_group,
          sets:         3,
          reps:         '8-12',
          rest_seconds: 60,
          notes:        '',
          order:        prev.length + 1,
        },
      ]);
      setShowPicker(false);
      setShowCreateEx(false);
      setNewExForm({ name: '', muscle_group: '', equipment: '', category: 'isolation', cues: '' });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Failed to create exercise.');
    } finally {
      setCreatingEx(false);
    }
  };

  // ── Edit exercise ─────────────────────────────────────────────────────────

  const openEditEx = (ex: EditEx) => {
    setEditTarget(ex);
    setEditForm({ sets: ex.sets, reps: ex.reps, rest_seconds: ex.rest_seconds, notes: ex.notes });
    setShowEdit(true);
  };

  const saveEditEx = () => {
    if (!editTarget) return;
    setExercises((prev) =>
      prev.map((e) =>
        e._key !== editTarget._key ? e : {
          ...e,
          sets:         Number(editForm.sets)         || e.sets,
          reps:         editForm.reps                 ?? e.reps,
          rest_seconds: Number(editForm.rest_seconds) || e.rest_seconds,
          notes:        editForm.notes                ?? e.notes,
        }
      )
    );
    setShowEdit(false);
    setEditTarget(null);
  };

  const moveExercise = (key: string, dir: 'up' | 'down') => {
    setExercises((prev) => {
      const idx = prev.findIndex((e) => e._key === key);
      if (idx < 0) return prev;
      if (dir === 'up'   && idx === 0)            return prev;
      if (dir === 'down' && idx === prev.length - 1) return prev;
      const next  = [...prev];
      const swap  = dir === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const filteredLibrary = exLibrary.filter(
    (e) =>
      e.name.toLowerCase().includes(exSearch.toLowerCase()) ||
      (e.muscle_group ?? '').toLowerCase().includes(exSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {title || 'New Workout'}
        </Text>
        <TouchableOpacity
          style={[styles.saveTopBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={styles.saveTopBtnTxt}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Workout name (e.g. Arms Day)"
          placeholderTextColor={colors.gray300}
        />

        {/* Focus selector */}
        <Text style={styles.sectionLabel}>FOCUS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.focusScroll}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {FOCUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.focusChip, focus === opt.value && styles.focusChipActive]}
              onPress={() => setFocus((prev) => prev === opt.value ? null : opt.value)}
            >
              <Text style={[styles.focusChipTxt, focus === opt.value && styles.focusChipTxtActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Visibility */}
        <Text style={styles.sectionLabel}>VISIBILITY</Text>
        <View style={styles.visRow}>
          <TouchableOpacity
            style={[styles.visOption, visibility === 'draft' && styles.visOptionActive]}
            onPress={() => setVisibility('draft')}
          >
            <Ionicons
              name="eye-off-outline"
              size={18}
              color={visibility === 'draft' ? colors.white : colors.gray500}
            />
            <Text style={[styles.visLabel, visibility === 'draft' && styles.visLabelActive]}>
              Draft
            </Text>
            <Text style={[styles.visDesc, visibility === 'draft' && { color: 'rgba(255,255,255,0.65)' }]}>
              Only you
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.visOption, visibility === 'client_visible' && styles.visOptionActive]}
            onPress={() => setVisibility('client_visible')}
          >
            <Ionicons
              name="eye-outline"
              size={18}
              color={visibility === 'client_visible' ? colors.white : colors.gray500}
            />
            <Text style={[styles.visLabel, visibility === 'client_visible' && styles.visLabelActive]}>
              Visible
            </Text>
            <Text style={[styles.visDesc, visibility === 'client_visible' && { color: 'rgba(255,255,255,0.65)' }]}>
              Clients can see
            </Text>
          </TouchableOpacity>
        </View>

        {/* Assigned clients banner */}
        {!isNew && (
          <View style={styles.assignedBanner}>
            <Ionicons name="people-outline" size={16} color={colors.gray500} />
            <Text style={styles.assignedBannerTxt}>
              {assignedClients.length === 0
                ? 'Not assigned to any clients'
                : `Assigned to: ${assignedClients.map((c) => c.name).join(', ')}`}
            </Text>
          </View>
        )}

        {/* Exercises */}
        <View style={styles.exHeader}>
          <Text style={styles.sectionTitle}>
            Exercises
            <Text style={styles.exCount}> ({exercises.length})</Text>
          </Text>
        </View>

        {exercises.length === 0 ? (
          <View style={styles.emptyExercises}>
            <Ionicons name="barbell-outline" size={36} color={colors.gray300} />
            <Text style={styles.emptyExTxt}>No exercises yet — tap "Add Exercise" below</Text>
          </View>
        ) : (
          exercises.map((ex, idx) => (
            <View key={ex._key} style={styles.exCard}>
              {/* Num badge */}
              <View style={styles.exNum}>
                <Text style={styles.exNumTxt}>{idx + 1}</Text>
              </View>
              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.name}</Text>
                {ex.muscle_group ? (
                  <Text style={styles.exMuscle}>{ex.muscle_group}</Text>
                ) : null}
                <Text style={styles.exDetail}>
                  {ex.sets} sets × {ex.reps}  ·  {ex.rest_seconds}s rest
                </Text>
                {ex.notes ? (
                  <Text style={styles.exNotes} numberOfLines={1}>{ex.notes}</Text>
                ) : null}
              </View>
              {/* Actions */}
              <View style={styles.exActions}>
                <TouchableOpacity onPress={() => moveExercise(ex._key, 'up')} style={styles.exActionBtn}>
                  <Ionicons name="chevron-up" size={14} color={colors.gray400} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveExercise(ex._key, 'down')} style={styles.exActionBtn}>
                  <Ionicons name="chevron-down" size={14} color={colors.gray400} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEditEx(ex)} style={styles.exActionBtn}>
                  <Ionicons name="pencil-outline" size={15} color={colors.gray500} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeExercise(ex._key)} style={styles.exActionBtn}>
                  <Ionicons name="close" size={15} color={colors.red500} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Add exercise button */}
        <TouchableOpacity style={styles.addExBtn} onPress={openPicker}>
          <Ionicons name="add-circle-outline" size={20} color={colors.black} />
          <Text style={styles.addExBtnTxt}>Add Exercise</Text>
        </TouchableOpacity>

        {/* Save error */}
        {saveError ? (
          <View style={styles.saveError}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.red700} />
            <Text style={styles.saveErrorTxt}>{saveError}</Text>
          </View>
        ) : null}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={colors.white} />
            : <>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
                <Text style={styles.saveBtnTxt}>{isNew ? 'Create Workout' : 'Save Changes'}</Text>
              </>}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Exercise Picker + Inline Creator Modal ── */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showCreateEx ? 'Create Exercise' : 'Add Exercise'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (showCreateEx) { setShowCreateEx(false); }
                  else { setShowPicker(false); }
                }}
              >
                <Ionicons name={showCreateEx ? 'arrow-back' : 'close'} size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>

            {showCreateEx ? (
              /* ── Create Exercise Form ── */
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: spacing.xxxl }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.createExHint}>
                  The new exercise will be saved to your library and immediately added to this workout.
                </Text>

                <Text style={styles.fieldLabel}>Exercise Name *</Text>
                <TextInput
                  style={styles.input}
                  value={newExForm.name}
                  onChangeText={(v) => setNewExForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Barbell Bicep Curl"
                  placeholderTextColor={colors.gray400}
                  autoFocus
                />

                <Text style={styles.fieldLabel}>Muscle Group</Text>
                <TextInput
                  style={styles.input}
                  value={newExForm.muscle_group}
                  onChangeText={(v) => setNewExForm((f) => ({ ...f, muscle_group: v }))}
                  placeholder="e.g. Biceps"
                  placeholderTextColor={colors.gray400}
                />

                <Text style={styles.fieldLabel}>Equipment</Text>
                <TextInput
                  style={styles.input}
                  value={newExForm.equipment}
                  onChangeText={(v) => setNewExForm((f) => ({ ...f, equipment: v }))}
                  placeholder="e.g. Barbell, Dumbbell, Cable"
                  placeholderTextColor={colors.gray400}
                />

                <Text style={styles.fieldLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {['compound', 'isolation', 'cardio'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.selChip, newExForm.category === cat && styles.selChipActive]}
                      onPress={() => setNewExForm((f) => ({ ...f, category: cat }))}
                    >
                      <Text style={[styles.selChipTxt, newExForm.category === cat && { color: colors.white }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Coaching Cues (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={newExForm.cues}
                  onChangeText={(v) => setNewExForm((f) => ({ ...f, cues: v }))}
                  placeholder="Key technique points..."
                  placeholderTextColor={colors.gray400}
                  multiline
                />

                <TouchableOpacity
                  style={[styles.createExBtn, creatingEx && { opacity: 0.6 }]}
                  onPress={handleCreateExercise}
                  disabled={creatingEx}
                >
                  {creatingEx
                    ? <ActivityIndicator color={colors.white} />
                    : <>
                        <Ionicons name="add-circle-outline" size={18} color={colors.white} />
                        <Text style={styles.createExBtnTxt}>Save & Add to Workout</Text>
                      </>}
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* ── Exercise Picker ── */
              <>
                {/* Create new exercise button */}
                <TouchableOpacity
                  style={styles.createNewBtn}
                  onPress={() => { setShowCreateEx(true); setExSearch(''); }}
                >
                  <View style={styles.createNewIcon}>
                    <Ionicons name="add" size={18} color={colors.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.createNewTitle}>Create New Exercise</Text>
                    <Text style={styles.createNewSub}>Add to your library and this workout</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                </TouchableOpacity>

                {/* Search */}
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={16} color={colors.gray400} />
                  <TextInput
                    style={styles.searchInput}
                    value={exSearch}
                    onChangeText={setExSearch}
                    placeholder="Search exercises..."
                    placeholderTextColor={colors.gray400}
                  />
                  {exSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setExSearch('')}>
                      <Ionicons name="close-circle" size={16} color={colors.gray400} />
                    </TouchableOpacity>
                  )}
                </View>

                {loadingEx ? (
                  <ActivityIndicator color={colors.black} style={{ padding: spacing.xxxl }} />
                ) : filteredLibrary.length === 0 ? (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyTxt}>
                      {exSearch ? 'No exercises match your search.' : 'No exercises in your library yet.'}
                    </Text>
                    <TouchableOpacity
                      style={styles.pickerEmptyBtn}
                      onPress={() => setShowCreateEx(true)}
                    >
                      <Text style={styles.pickerEmptyBtnTxt}>Create First Exercise →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView style={styles.pickerList}>
                    {filteredLibrary.map((ex) => {
                      const alreadyAdded = exercises.some((e) => e.exercise_id === ex.id);
                      return (
                        <TouchableOpacity
                          key={ex.id}
                          style={[styles.pickerRow, alreadyAdded && styles.pickerRowAdded]}
                          onPress={() => !alreadyAdded && addExercise(ex)}
                          activeOpacity={alreadyAdded ? 1 : 0.7}
                        >
                          <View style={styles.pickerIcon}>
                            <Ionicons name="barbell-outline" size={17} color={colors.gray500} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pickerName}>{ex.name}</Text>
                            {ex.muscle_group ? (
                              <Text style={styles.pickerMuscle}>{ex.muscle_group}</Text>
                            ) : null}
                          </View>
                          {alreadyAdded ? (
                            <View style={styles.addedBadge}>
                              <Ionicons name="checkmark" size={12} color={colors.green700} />
                              <Text style={styles.addedBadgeTxt}>Added</Text>
                            </View>
                          ) : (
                            <Ionicons name="add-circle-outline" size={22} color={colors.black} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ height: spacing.xxxl }} />
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Edit Exercise Modal ── */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Exercise</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              {editTarget ? (
                <>
                  <Text style={styles.editExName}>{editTarget.name}</Text>
                  {editTarget.muscle_group ? (
                    <Text style={styles.editExMuscle}>{editTarget.muscle_group}</Text>
                  ) : null}

                  <Text style={styles.fieldLabel}>Sets</Text>
                  <TextInput
                    style={styles.input}
                    value={String(editForm.sets ?? '')}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, sets: parseInt(v) || 0 }))}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.gray400}
                  />

                  <Text style={styles.fieldLabel}>Reps</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.reps ?? ''}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, reps: v }))}
                    placeholder="e.g. 8-12 or 10"
                    placeholderTextColor={colors.gray400}
                  />

                  <Text style={styles.fieldLabel}>Rest (seconds)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(editForm.rest_seconds ?? '')}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, rest_seconds: parseInt(v) || 0 }))}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.gray400}
                  />

                  <Text style={styles.fieldLabel}>Coaching Notes</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                    value={editForm.notes ?? ''}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, notes: v }))}
                    placeholder="Cues, tempo, technique reminders..."
                    placeholderTextColor={colors.gray400}
                    multiline
                  />

                  <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEditEx}>
                    <Text style={styles.modalSaveBtnTxt}>Save</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  backBtn:       { width: 36, alignItems: 'center' },
  topBarTitle:   { flex: 1, fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  saveTopBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  saveTopBtnTxt: { color: colors.white, fontSize: fontSize.sm, fontWeight: '700' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  titleInput: {
    fontSize: fontSize.xxl, fontWeight: '700', color: colors.black,
    borderBottomWidth: 2, borderBottomColor: colors.gray200,
    paddingBottom: spacing.sm, marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.gray400,
    letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  exCount:      { color: colors.gray400, fontWeight: '400' },
  focusScroll:  { marginBottom: spacing.xl },
  focusChip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1.5,
    borderColor: colors.gray200, backgroundColor: colors.white,
  },
  focusChipActive:    { backgroundColor: colors.black, borderColor: colors.black },
  focusChipTxt:       { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray500 },
  focusChipTxtActive: { color: colors.white },
  visRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  visOption: {
    flex: 1, padding: spacing.lg, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.gray200, alignItems: 'center', gap: spacing.xs,
  },
  visOptionActive: { backgroundColor: colors.black, borderColor: colors.black },
  visLabel:        { fontSize: fontSize.sm, fontWeight: '700', color: colors.gray700 },
  visLabelActive:  { color: colors.white },
  visDesc:         { fontSize: fontSize.xs, color: colors.gray400, textAlign: 'center' },
  assignedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.gray100, borderRadius: borderRadius.sm,
    padding: spacing.md, marginBottom: spacing.xl,
  },
  assignedBannerTxt: { fontSize: fontSize.sm, color: colors.gray500, flex: 1 },
  exHeader: { marginBottom: spacing.md },
  emptyExercises: {
    alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gray300,
    marginBottom: spacing.lg,
  },
  emptyExTxt: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
  exCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray200,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md,
  },
  exNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  exNumTxt:  { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },
  exName:    { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  exMuscle:  { fontSize: fontSize.xs, color: colors.gray400, textTransform: 'capitalize', marginTop: 1 },
  exDetail:  { fontSize: fontSize.sm, color: colors.gray500, marginTop: spacing.xs },
  exNotes:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2, fontStyle: 'italic' },
  exActions: { flexDirection: 'column', gap: spacing.xs, flexShrink: 0 },
  exActionBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
    borderRadius: borderRadius.sm, backgroundColor: colors.gray50,
  },
  addExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: colors.gray300, borderRadius: borderRadius.md,
    paddingVertical: spacing.lg, marginBottom: spacing.xl,
  },
  addExBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  saveError: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.red50, padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  saveErrorTxt: { flex: 1, fontSize: fontSize.sm, color: colors.red700 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.black,
    borderRadius: borderRadius.md, paddingVertical: spacing.lg + 2,
    marginTop: spacing.md,
  },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:  { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  fieldLabel: {
    fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  selChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray200,
  },
  selChipActive: { backgroundColor: colors.black, borderColor: colors.black },
  selChipTxt:    { fontSize: fontSize.xs, color: colors.gray600 },
  createExHint: {
    fontSize: fontSize.sm, color: colors.gray500, lineHeight: 20,
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
  createExBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.black,
    borderRadius: borderRadius.sm, paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  createExBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  // Picker
  createNewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.gray50, margin: spacing.xl,
    padding: spacing.lg, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.black,
  },
  createNewIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center',
  },
  createNewTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  createNewSub:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.md,
    backgroundColor: colors.gray50, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray200,
    paddingHorizontal: spacing.md, height: 42,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.black },
  pickerList:  {},
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md + 2,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  pickerRowAdded: { opacity: 0.5 },
  pickerIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerName:   { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  pickerMuscle: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1, textTransform: 'capitalize' },
  addedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.green50, paddingHorizontal: spacing.sm,
    paddingVertical: 2, borderRadius: borderRadius.full,
  },
  addedBadgeTxt: { fontSize: fontSize.xs, color: colors.green700, fontWeight: '600' },
  pickerEmpty: { alignItems: 'center', padding: spacing.xxxl, gap: spacing.md },
  pickerEmptyTxt: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
  pickerEmptyBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  pickerEmptyBtnTxt: { color: colors.white, fontSize: fontSize.sm, fontWeight: '600' },
  // Edit exercise
  editExName:   { fontSize: fontSize.xl, fontWeight: '700', color: colors.black, marginTop: spacing.md },
  editExMuscle: { fontSize: fontSize.sm, color: colors.gray400, textTransform: 'capitalize', marginBottom: spacing.xs },
  modalSaveBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl,
  },
  modalSaveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});