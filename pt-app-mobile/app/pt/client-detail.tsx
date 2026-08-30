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

const FOCUS_LABELS: Record<string, string> = {
  arms: 'Arms', legs: 'Legs', push: 'Push', pull: 'Pull',
  back: 'Back', chest: 'Chest', core: 'Core', full_body: 'Full Body', cardio: 'Cardio',
};

const GOAL_PRESETS = [
  'Lose Weight', 'Build Muscle', 'Improve Fitness', 'Increase Strength',
  'Improve Flexibility', 'Sports Performance', 'Injury Recovery',
  'General Health', 'Improve Endurance', 'Tone Up',
];

const PLAN_TYPES = ['Monthly', 'Quarterly', 'Pay As You Go', '6 Month', 'Annual', 'Custom'];

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [client,           setClient]           = useState<any>(null);
  const [measurements,     setMeasurements]     = useState<any[]>([]);
  const [goals,            setGoals]            = useState<any[]>([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState<any[]>([]);
  const [allWorkouts,      setAllWorkouts]      = useState<any[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);

  // ── Edit client modal ──
  const [editModal,    setEditModal]    = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [editForm, setEditForm] = useState({
    // Contact
    name:  '',
    phone: '',
    // Physical
    age:                '',
    sex:                '',
    height_cm:          '',
    starting_weight_kg: '',
    // Tags
    goals:       [] as string[],
    injuries:    [] as string[],
    goalInput:   '',
    injuryInput: '',
    // Membership
    status:    'active',
    plan_type: '',
    // Notes
    notes: '',
  });

  // ── Goal status update ──
  const [updatingGoal, setUpdatingGoal] = useState<string | null>(null);

  // ── Measurement modal ──
  const [mModal,  setMModal]  = useState(false);
  const [mSaving, setMSaving] = useState(false);
  const [mForm, setMForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight_kg: '', chest_cm: '', waist_cm: '',
    left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '',
  });

  // ── Goal add modal ──
  const [gModal,  setGModal]  = useState(false);
  const [gSaving, setGSaving] = useState(false);
  const [gForm, setGForm] = useState({
    description: '', type: 'weight', target_value: '', target_unit: 'kg',
    target_date: '', current_value: '',
  });

  // ── Workout assignment modal ──
  const [workoutModal,       setWorkoutModal]       = useState(false);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([]);
  const [savingWorkouts,     setSavingWorkouts]     = useState(false);

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [cR, mR, gR, awR, wR] = await Promise.allSettled([
        API.get(`/clients/${id}`),
        API.get(`/clients/${id}/measurements`),
        API.get(`/clients/${id}/goals`),
        API.get('/workout-plans', { params: { client_id: id } }),
        API.get('/workout-plans', { params: { status: 'active' } }),
      ]);
      if (cR.status === 'fulfilled') setClient(cR.value.data);
      if (mR.status === 'fulfilled') setMeasurements(mR.value.data);
      if (gR.status === 'fulfilled') setGoals(gR.value.data);
      if (awR.status === 'fulfilled') {
        const aw = awR.value.data;
        setAssignedWorkouts(aw);
        setSelectedWorkoutIds(aw.map((w: any) => w.id));
      }
      if (wR.status === 'fulfilled') setAllWorkouts(wR.value.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ✅ FIX: Use router.navigate to go to the clients TAB — reliable for hidden tab screens
  const handleBack = () => {
    router.navigate('/pt/clients' as any);
  };

  // ── Open edit client modal ─────────────────────────────────────────────────
  const openEditClient = () => {
    if (!client) return;
    setEditForm({
      name:               client.name   ?? '',
      phone:              client.phone  ?? '',
      age:                client.age    != null ? String(client.age)                : '',
      sex:                client.sex    ?? '',
      height_cm:          client.height_cm          != null ? String(client.height_cm)          : '',
      starting_weight_kg: client.starting_weight_kg != null ? String(client.starting_weight_kg) : '',
      goals:       Array.isArray(client.goals)    ? [...client.goals]    : [],
      injuries:    Array.isArray(client.injuries) ? [...client.injuries] : [],
      goalInput:   '',
      injuryInput: '',
      status:    client.status    ?? 'active',
      plan_type: client.plan_type ?? '',
      notes:     client.notes     ?? '',
    });
    setEditModal(true);
  };

  // ── Tag helpers ────────────────────────────────────────────────────────────
  const addGoalTag = (tag: string) => {
    const t = tag.trim();
    if (!t || editForm.goals.includes(t)) return;
    setEditForm((f) => ({ ...f, goals: [...f.goals, t], goalInput: '' }));
  };

  const removeGoalTag = (tag: string) => {
    setEditForm((f) => ({ ...f, goals: f.goals.filter((g) => g !== tag) }));
  };

  const toggleGoalPreset = (preset: string) => {
    if (editForm.goals.includes(preset)) {
      removeGoalTag(preset);
    } else {
      setEditForm((f) => ({ ...f, goals: [...f.goals, preset] }));
    }
  };

  const addInjuryTag = (tag: string) => {
    const t = tag.trim();
    if (!t || editForm.injuries.includes(t)) return;
    setEditForm((f) => ({ ...f, injuries: [...f.injuries, t], injuryInput: '' }));
  };

  const removeInjuryTag = (tag: string) => {
    setEditForm((f) => ({ ...f, injuries: f.injuries.filter((i) => i !== tag) }));
  };

  // ── Save client ────────────────────────────────────────────────────────────
  const handleSaveClient = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Error', 'Client name is required');
      return;
    }
    setSavingClient(true);
    try {
      const payload: any = {
        name:     editForm.name.trim(),
        goals:    editForm.goals,
        injuries: editForm.injuries,
        status:   editForm.status,
      };
      if (editForm.phone.trim())        payload.phone              = editForm.phone.trim();
      if (editForm.age)                 payload.age                = parseInt(editForm.age);
      if (editForm.sex)                 payload.sex                = editForm.sex;
      if (editForm.height_cm)           payload.height_cm          = parseFloat(editForm.height_cm);
      if (editForm.starting_weight_kg)  payload.starting_weight_kg = parseFloat(editForm.starting_weight_kg);
      if (editForm.plan_type.trim())    payload.plan_type          = editForm.plan_type.trim();
      payload.notes = editForm.notes.trim() || null;

      const res = await API.put(`/clients/${id}`, payload);
      setClient((prev: any) => ({ ...prev, ...res.data }));
      setEditModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update client details');
    } finally {
      setSavingClient(false);
    }
  };

  // ── Goal status update ─────────────────────────────────────────────────────
  const updateGoalStatus = async (
    goalId: string,
    newStatus: 'achieved' | 'abandoned' | 'in_progress',
  ) => {
    setUpdatingGoal(goalId);
    try {
      const res = await API.put(`/clients/${id}/goals/${goalId}`, { status: newStatus });
      setGoals((prev) => prev.map((g) => g.id === goalId ? res.data : g));
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update goal');
    } finally {
      setUpdatingGoal(null);
    }
  };

  // ── Save measurement ───────────────────────────────────────────────────────
  const saveMeasurement = async () => {
    if (!mForm.date) { Alert.alert('Error', 'Date is required'); return; }
    setMSaving(true);
    try {
      const payload: any = { date: mForm.date };
      ['weight_kg','chest_cm','waist_cm','left_arm_cm','right_arm_cm','thigh_cm','hips_cm']
        .forEach((k) => {
          const v = (mForm as any)[k];
          if (v !== '') payload[k] = parseFloat(v);
        });
      if (mForm.notes) payload.notes = mForm.notes;
      const res = await API.post(`/clients/${id}/measurements`, payload);
      setMeasurements((prev) => [res.data, ...prev]);
      setMModal(false);
      setMForm({
        date: new Date().toISOString().split('T')[0],
        weight_kg: '', chest_cm: '', waist_cm: '',
        left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '',
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally { setMSaving(false); }
  };

  // ── Save goal ──────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    if (!gForm.description || !gForm.target_value) {
      Alert.alert('Error', 'Description and target value are required'); return;
    }
    setGSaving(true);
    try {
      const payload: any = {
        description: gForm.description, type: gForm.type,
        target_value: parseFloat(gForm.target_value), target_unit: gForm.target_unit,
      };
      if (gForm.target_date)   payload.target_date   = gForm.target_date;
      if (gForm.current_value) payload.current_value = parseFloat(gForm.current_value);
      const res = await API.post(`/clients/${id}/goals`, payload);
      setGoals((prev) => [res.data, ...prev]);
      setGModal(false);
      setGForm({ description: '', type: 'weight', target_value: '', target_unit: 'kg', target_date: '', current_value: '' });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally { setGSaving(false); }
  };

  // ── Save workout assignments ───────────────────────────────────────────────
  const saveWorkoutAssignments = async () => {
    setSavingWorkouts(true);
    try {
      await API.put(`/workout-plans/assignments/by-client/${id}`, { workout_ids: selectedWorkoutIds });
      const res = await API.get('/workout-plans', { params: { client_id: id } });
      setAssignedWorkouts(res.data);
      setWorkoutModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save workout assignments');
    } finally { setSavingWorkouts(false); }
  };

  const toggleWorkout = (wid: string) =>
    setSelectedWorkoutIds((prev) =>
      prev.includes(wid) ? prev.filter((x) => x !== wid) : [...prev, wid]
    );

  const openWorkoutModal = () => {
    setSelectedWorkoutIds(assignedWorkouts.map((w) => w.id));
    setWorkoutModal(true);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusBadgeVariant = (s: string) =>
    s === 'achieved' ? 'active' : s === 'abandoned' ? 'danger' : 'pending';

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
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Client Profile</Text>
        <TouchableOpacity onPress={openEditClient} style={styles.editHeaderBtn}>
          <Ionicons name="create-outline" size={20} color={colors.black} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Profile card ── */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{client.name?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientEmail}>{client.email}</Text>
              {client.phone ? (
                <Text style={styles.clientPhone}>{client.phone}</Text>
              ) : null}
            </View>
            <Badge
              label={client.status || 'active'}
              variant={client.status === 'active' ? 'active' : 'inactive'}
            />
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {[
              { label: 'Age',    value: client.age           ? `${client.age}`           : '—' },
              { label: 'Sex',    value: client.sex           ?? '—'                           },
              { label: 'Height', value: client.height_cm     ? `${client.height_cm}cm`   : '—' },
              { label: 'Weight', value: client.starting_weight_kg ? `${client.starting_weight_kg}kg` : '—' },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Plan type */}
          {client.plan_type ? (
            <View style={styles.planRow}>
              <Ionicons name="card-outline" size={14} color={colors.gray500} />
              <Text style={styles.planTxt}>{client.plan_type} plan</Text>
            </View>
          ) : null}

          {/* Profile goals (JSONB tags) */}
          {client.goals?.length > 0 ? (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsTitle}>Goals</Text>
              <View style={styles.tagsWrap}>
                {client.goals.map((g: string) => (
                  <View key={g} style={styles.goalTag}>
                    <Text style={styles.goalTagTxt}>{g}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Injuries / Medical */}
          {client.injuries?.length > 0 ? (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsTitle}>Medical / Injuries</Text>
              <View style={styles.tagsWrap}>
                {client.injuries.map((inj: string) => (
                  <View key={inj} style={styles.injuryTag}>
                    <Text style={styles.injuryTagTxt}>{inj}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Notes */}
          {client.notes ? (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Trainer Notes</Text>
              <Text style={styles.notesText}>{client.notes}</Text>
            </View>
          ) : null}

          {/* Edit details button */}
          <TouchableOpacity style={styles.editDetailsBtn} onPress={openEditClient}>
            <Ionicons name="create-outline" size={15} color={colors.gray600} />
            <Text style={styles.editDetailsBtnTxt}>Edit All Client Details</Text>
          </TouchableOpacity>
        </Card>

        {/* ── Assigned Workouts ── */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Assigned Workouts</Text>
            <Text style={styles.sectionSub}>
              {assignedWorkouts.length} workout{assignedWorkouts.length !== 1 ? 's' : ''} assigned
            </Text>
          </View>
          <TouchableOpacity style={styles.manageBtn} onPress={openWorkoutModal}>
            <Ionicons name="settings-outline" size={14} color={colors.white} />
            <Text style={styles.manageBtnTxt}>Manage</Text>
          </TouchableOpacity>
        </View>

        {assignedWorkouts.length === 0 ? (
          <Card style={styles.emptyWorkoutsCard}>
            <Ionicons name="barbell-outline" size={32} color={colors.gray300} />
            <Text style={styles.emptyWorkoutsTxt}>No workouts assigned yet</Text>
            <TouchableOpacity style={styles.assignNowBtn} onPress={openWorkoutModal}>
              <Text style={styles.assignNowBtnTxt}>Assign Workouts →</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <View style={styles.workoutGrid}>
            {assignedWorkouts.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.workoutCard}
                onPress={() => router.navigate(`/pt/workout-detail?id=${w.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.workoutCardTitle}>{w.title}</Text>
                {w.focus ? (
                  <View style={styles.workoutFocusBadge}>
                    <Text style={styles.workoutFocusTxt}>{FOCUS_LABELS[w.focus] ?? w.focus}</Text>
                  </View>
                ) : null}
                <Text style={styles.workoutExCount}>
                  {w.exercise_count ?? 0} exercise{(w.exercise_count ?? 0) !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Goals (Goal model) ── */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Progress Goals</Text>
          <TouchableOpacity style={styles.addIcon} onPress={() => setGModal(true)}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {goals.length === 0 ? (
          <Card><Text style={styles.emptyText}>No goals set yet. Tap + to add one.</Text></Card>
        ) : (
          goals.map((goal) => {
            const isUpdating = updatingGoal === goal.id;
            const canAct     = goal.status === 'in_progress';
            const progress   =
              goal.current_value != null && goal.target_value && goal.target_value > 0
                ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                : null;

            return (
              <Card key={goal.id} style={styles.goalCard}>
                {/* Goal header */}
                <View style={styles.goalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalDesc}>{goal.description}</Text>
                    <Text style={styles.goalMeta}>
                      Target: {goal.target_value} {goal.target_unit}
                      {goal.current_value != null
                        ? ` · Current: ${goal.current_value} ${goal.target_unit}` : ''}
                      {goal.target_date ? ` · Due: ${fmtDate(goal.target_date)}` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={goal.status.replace('_', ' ')}
                    variant={statusBadgeVariant(goal.status)}
                  />
                </View>

                {/* Progress bar for in_progress goals */}
                {progress !== null && canAct && (
                  <View style={styles.goalProgressBar}>
                    <View style={[styles.goalProgressFill, { width: `${progress}%` as any }]} />
                  </View>
                )}

                {/* ✅ NEW: Goal action buttons */}
                {isUpdating ? (
                  <ActivityIndicator color={colors.black} style={{ marginTop: spacing.md }} />
                ) : canAct ? (
                  <View style={styles.goalActions}>
                    <TouchableOpacity
                      style={styles.goalCompleteBtn}
                      onPress={() => updateGoalStatus(goal.id, 'achieved')}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.green700} />
                      <Text style={styles.goalCompleteBtnTxt}>Mark Complete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.goalAbandonBtn}
                      onPress={() => updateGoalStatus(goal.id, 'abandoned')}
                    >
                      <Ionicons name="close-circle-outline" size={14} color={colors.gray500} />
                      <Text style={styles.goalAbandonBtnTxt}>Abandon</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* Re-open achieved/abandoned goals */
                  <TouchableOpacity
                    style={styles.goalReopenBtn}
                    onPress={() => updateGoalStatus(goal.id, 'in_progress')}
                  >
                    <Ionicons name="refresh-outline" size={14} color={colors.gray500} />
                    <Text style={styles.goalReopenBtnTxt}>Re-open Goal</Text>
                  </TouchableOpacity>
                )}
              </Card>
            );
          })
        )}

        {/* ── Measurements ── */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Measurements</Text>
          <TouchableOpacity style={styles.addIcon} onPress={() => setMModal(true)}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {measurements.length === 0 ? (
          <Card><Text style={styles.emptyText}>No measurements recorded yet.</Text></Card>
        ) : (
          measurements.slice(0, 6).map((m) => (
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
                ].filter((r) => r.value != null).map((r) => (
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

      {/* ════════════════════════════════════════════════════════════════════
          EDIT CLIENT MODAL — Full client info form
      ════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Edit Client Details</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: spacing.xxxl + 20 }}
              keyboardShouldPersistTaps="handled"
            >

              {/* ── CONTACT DETAILS ── */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Contact Details</Text>

                <Text style={styles.fieldLabel}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.name}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
                  placeholder="Client's full name"
                  placeholderTextColor={colors.gray400}
                  autoFocus
                />

                <Text style={styles.fieldLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.phone}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                  placeholder="e.g. 07700 900123"
                  placeholderTextColor={colors.gray400}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyTxt}>{client.email}</Text>
                </View>
                <Text style={styles.fieldHint}>Email cannot be changed after account creation.</Text>
              </View>

              {/* ── PHYSICAL STATS ── */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Physical Stats</Text>

                <Text style={styles.fieldLabel}>Sex / Gender</Text>
                <View style={styles.chipRow}>
                  {['Male', 'Female', 'Non-Binary', 'Prefer Not to Say'].map((s) => {
                    const val = s.toLowerCase().replace(/ /g, '-');
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.chip, editForm.sex === val && styles.chipActive]}
                        onPress={() => setEditForm((f) => ({ ...f, sex: f.sex === val ? '' : val }))}
                      >
                        <Text style={[styles.chipTxt, editForm.sex === val && { color: colors.white }]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.twoColRow}>
                  <View style={styles.twoColItem}>
                    <Text style={styles.fieldLabel}>Age</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.age}
                      onChangeText={(v) => setEditForm((f) => ({ ...f, age: v }))}
                      placeholder="e.g. 28"
                      placeholderTextColor={colors.gray400}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.twoColItem}>
                    <Text style={styles.fieldLabel}>Height (cm)</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.height_cm}
                      onChangeText={(v) => setEditForm((f) => ({ ...f, height_cm: v }))}
                      placeholder="e.g. 175"
                      placeholderTextColor={colors.gray400}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Starting Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.starting_weight_kg}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, starting_weight_kg: v }))}
                  placeholder="e.g. 85"
                  placeholderTextColor={colors.gray400}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* ── FITNESS GOALS (tags) ── */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Fitness Goals</Text>
                <Text style={styles.fieldHint}>
                  Tap a preset or type your own below.
                </Text>

                {/* Preset chips */}
                <View style={styles.chipRow}>
                  {GOAL_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.chip, editForm.goals.includes(preset) && styles.chipActive]}
                      onPress={() => toggleGoalPreset(preset)}
                    >
                      <Text style={[styles.chipTxt, editForm.goals.includes(preset) && { color: colors.white }]}>
                        {preset}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom goal input */}
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={editForm.goalInput}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, goalInput: v }))}
                    placeholder="Add custom goal..."
                    placeholderTextColor={colors.gray400}
                    onSubmitEditing={() => addGoalTag(editForm.goalInput)}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.tagAddBtn}
                    onPress={() => addGoalTag(editForm.goalInput)}
                  >
                    <Ionicons name="add" size={20} color={colors.white} />
                  </TouchableOpacity>
                </View>

                {/* Selected tags */}
                {editForm.goals.length > 0 && (
                  <View style={styles.selectedTags}>
                    {editForm.goals.map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={styles.removableTag}
                        onPress={() => removeGoalTag(g)}
                      >
                        <Text style={styles.removableTagTxt}>{g}</Text>
                        <Ionicons name="close" size={12} color={colors.gray600} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* ── MEDICAL / INJURIES ── */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Medical Conditions & Injuries</Text>
                <Text style={styles.fieldHint}>
                  Add any conditions, injuries or restrictions the PT should know about.
                </Text>

                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={editForm.injuryInput}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, injuryInput: v }))}
                    placeholder="e.g. Bad knee, Lower back pain"
                    placeholderTextColor={colors.gray400}
                    onSubmitEditing={() => addInjuryTag(editForm.injuryInput)}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.tagAddBtn}
                    onPress={() => addInjuryTag(editForm.injuryInput)}
                  >
                    <Ionicons name="add" size={20} color={colors.white} />
                  </TouchableOpacity>
                </View>

                {editForm.injuries.length > 0 ? (
                  <View style={styles.selectedTags}>
                    {editForm.injuries.map((inj) => (
                      <TouchableOpacity
                        key={inj}
                        style={[styles.removableTag, styles.removableTagRed]}
                        onPress={() => removeInjuryTag(inj)}
                      >
                        <Text style={[styles.removableTagTxt, { color: colors.red700 }]}>{inj}</Text>
                        <Ionicons name="close" size={12} color={colors.red700} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noTagsTxt}>No conditions added — tap + to add</Text>
                )}
              </View>

              {/* ── MEMBERSHIP ── */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Membership</Text>

                <Text style={styles.fieldLabel}>Status</Text>
                <View style={styles.chipRow}>
                  {['active', 'inactive', 'archived'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, editForm.status === s && styles.chipActive]}
                      onPress={() => setEditForm((f) => ({ ...f, status: s }))}
                    >
                      <Text style={[styles.chipTxt, editForm.status === s && { color: colors.white }]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Plan / Membership Type</Text>
                <View style={styles.chipRow}>
                  {PLAN_TYPES.map((pt) => (
                    <TouchableOpacity
                      key={pt}
                      style={[styles.chip, editForm.plan_type === pt && styles.chipActive]}
                      onPress={() => setEditForm((f) => ({ ...f, plan_type: f.plan_type === pt ? '' : pt }))}
                    >
                      <Text style={[styles.chipTxt, editForm.plan_type === pt && { color: colors.white }]}>
                        {pt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]}
                  value={editForm.plan_type}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, plan_type: v }))}
                  placeholder="Or type a custom plan type..."
                  placeholderTextColor={colors.gray400}
                />
              </View>

              {/* ── TRAINER NOTES ── */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Trainer Notes</Text>
                <TextInput
                  style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
                  value={editForm.notes}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, notes: v }))}
                  placeholder="Any additional notes about this client..."
                  placeholderTextColor={colors.gray400}
                  multiline
                />
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, savingClient && { opacity: 0.6 }]}
                onPress={handleSaveClient}
                disabled={savingClient}
              >
                {savingClient
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Client Details</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Workout Assignment Modal ── */}
      <Modal visible={workoutModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Assign Workouts</Text>
              <TouchableOpacity onPress={() => setWorkoutModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Select which workouts {client.name} should have access to.
            </Text>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              {allWorkouts.length === 0 ? (
                <View style={styles.noWorkoutsWrap}>
                  <Text style={styles.noWorkoutsTxt}>No active workouts in your library yet.</Text>
                  <TouchableOpacity
                    style={styles.createWorkoutBtn}
                    onPress={() => { setWorkoutModal(false); router.navigate('/pt/workouts' as any); }}
                  >
                    <Text style={styles.createWorkoutBtnTxt}>Go to Workouts →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                allWorkouts.map((w) => {
                  const isSelected = selectedWorkoutIds.includes(w.id);
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.workoutRow, isSelected && styles.workoutRowSelected]}
                      onPress={() => toggleWorkout(w.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.workoutRowAvatar, isSelected && { backgroundColor: colors.black }]}>
                        <Ionicons name="barbell-outline" size={16} color={isSelected ? colors.white : colors.gray500} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workoutRowTitle}>{w.title}</Text>
                        <Text style={styles.workoutRowMeta}>
                          {w.focus ? `${FOCUS_LABELS[w.focus] ?? w.focus}  ·  ` : ''}
                          {w.exercise_count ?? 0} exercise{(w.exercise_count ?? 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={13} color={colors.white} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
              {allWorkouts.length > 0 && (
                <>
                  <Text style={styles.selectedCount}>
                    {selectedWorkoutIds.length === 0
                      ? 'No workouts selected'
                      : `${selectedWorkoutIds.length} workout${selectedWorkoutIds.length !== 1 ? 's' : ''} selected`}
                  </Text>
                  <TouchableOpacity
                    style={[styles.saveBtn, savingWorkouts && { opacity: 0.6 }]}
                    onPress={saveWorkoutAssignments}
                    disabled={savingWorkouts}
                  >
                    {savingWorkouts
                      ? <ActivityIndicator color={colors.white} />
                      : <Text style={styles.saveBtnTxt}>Save Assignments</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput style={styles.input} value={mForm.date} onChangeText={(v) => setMForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.gray400} />
              {[['Weight (kg)', 'weight_kg'], ['Chest (cm)', 'chest_cm'], ['Waist (cm)', 'waist_cm'],
                ['L. Arm (cm)', 'left_arm_cm'], ['R. Arm (cm)', 'right_arm_cm'],
                ['Thigh (cm)', 'thigh_cm'], ['Hips (cm)', 'hips_cm']].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput style={styles.input} value={(mForm as any)[key]}
                    onChangeText={(v) => setMForm((f) => ({ ...f, [key]: v }))}
                    placeholder="Optional" placeholderTextColor={colors.gray400} keyboardType="decimal-pad" />
                </View>
              ))}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={mForm.notes} onChangeText={(v) => setMForm((f) => ({ ...f, notes: v }))}
                placeholder="Optional" placeholderTextColor={colors.gray400} multiline />
              <TouchableOpacity style={[styles.saveBtn, mSaving && { opacity: 0.6 }]} onPress={saveMeasurement} disabled={mSaving}>
                {mSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnTxt}>Save Measurement</Text>}
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
              <Text style={styles.modalTitle}>Add Progress Goal</Text>
              <TouchableOpacity onPress={() => setGModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput style={styles.input} value={gForm.description} onChangeText={(v) => setGForm((f) => ({ ...f, description: v }))} placeholder="e.g. Reach 80kg bodyweight" placeholderTextColor={colors.gray400} />
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {['weight', 'strength', 'movement', 'custom'].map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, gForm.type === t && styles.chipActive]} onPress={() => setGForm((f) => ({ ...f, type: t }))}>
                    <Text style={[styles.chipTxt, gForm.type === t && { color: colors.white }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Target Value *</Text>
              <TextInput style={styles.input} value={gForm.target_value} onChangeText={(v) => setGForm((f) => ({ ...f, target_value: v }))} placeholder="e.g. 80" placeholderTextColor={colors.gray400} keyboardType="decimal-pad" />
              <Text style={styles.fieldLabel}>Unit</Text>
              <View style={styles.chipRow}>
                {['kg', 'lbs', 'reps', 'mins', '%', 'other'].map((u) => (
                  <TouchableOpacity key={u} style={[styles.chip, gForm.target_unit === u && styles.chipActive]} onPress={() => setGForm((f) => ({ ...f, target_unit: u }))}>
                    <Text style={[styles.chipTxt, gForm.target_unit === u && { color: colors.white }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Current Value (optional)</Text>
              <TextInput style={styles.input} value={gForm.current_value} onChangeText={(v) => setGForm((f) => ({ ...f, current_value: v }))} placeholder="e.g. 90" placeholderTextColor={colors.gray400} keyboardType="decimal-pad" />
              <Text style={styles.fieldLabel}>Target Date (optional)</Text>
              <TextInput style={styles.input} value={gForm.target_date} onChangeText={(v) => setGForm((f) => ({ ...f, target_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.gray400} />
              <TouchableOpacity style={[styles.saveBtn, gSaving && { opacity: 0.6 }]} onPress={saveGoal} disabled={gSaving}>
                {gSaving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnTxt}>Save Goal</Text>}
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
  header:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  backBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  editHeaderBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },

  // Profile card
  profileCard: { marginBottom: spacing.lg },
  profileTop:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl },
  avatar:      {
    width: 52, height: 52, borderRadius: borderRadius.full, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0,
  },
  avatarText:  { color: colors.white, fontSize: fontSize.xl, fontWeight: '700' },
  profileInfo: { flex: 1 },
  clientName:  { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  clientEmail: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  clientPhone: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  statsRow:    {
    flexDirection: 'row', borderTopWidth: 1,
    borderTopColor: colors.gray100, paddingTop: spacing.lg,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statLabel:   { fontSize: fontSize.xs, color: colors.gray400 },
  statValue:   { fontSize: fontSize.md, fontWeight: '600', color: colors.black, marginTop: 2 },
  planRow:     {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  planTxt:     { fontSize: fontSize.sm, color: colors.gray500 },
  tagsSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray100 },
  tagsTitle:   { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray400, letterSpacing: 0.6, marginBottom: spacing.sm },
  tagsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  goalTag: {
    backgroundColor: '#EFF6FF', paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs, borderRadius: borderRadius.full,
  },
  goalTagTxt: { fontSize: fontSize.xs, color: '#1D4ED8', fontWeight: '500' },
  injuryTag: {
    backgroundColor: colors.red50, paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs, borderRadius: borderRadius.full,
  },
  injuryTagTxt: { fontSize: fontSize.xs, color: colors.red700, fontWeight: '500' },
  notesSection: {
    borderTopWidth: 1, borderTopColor: colors.gray100,
    paddingTop: spacing.lg, marginTop: spacing.lg,
  },
  notesLabel: { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.xs },
  notesText:  { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },
  editDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    justifyContent: 'center', marginTop: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.lg,
  },
  editDetailsBtnTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray600 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  sectionSub:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  addIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.black, paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 1, borderRadius: borderRadius.sm,
  },
  manageBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },

  // Workout grid
  emptyWorkoutsCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, marginBottom: spacing.lg },
  emptyWorkoutsTxt:  { fontSize: fontSize.sm, color: colors.gray500 },
  assignNowBtn:      { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.xs },
  assignNowBtnTxt:   { color: colors.white, fontSize: fontSize.sm, fontWeight: '600' },
  workoutGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  workoutCard:       { width: '47%', backgroundColor: colors.black, borderRadius: borderRadius.md, padding: spacing.lg, gap: spacing.xs },
  workoutCardTitle:  { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
  workoutFocusBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  workoutFocusTxt:   { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'capitalize' },
  workoutExCount:    { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // Goals
  goalCard: { marginBottom: spacing.sm },
  goalRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  goalDesc: { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  goalMeta: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 4, lineHeight: 18 },
  goalProgressBar: {
    height: 5, backgroundColor: colors.gray100, borderRadius: 3,
    overflow: 'hidden', marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  goalProgressFill: { height: '100%', backgroundColor: colors.black, borderRadius: 3 },

  // Goal action buttons
  goalActions: {
    flexDirection: 'row', gap: spacing.sm,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  goalCompleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.green50, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  goalCompleteBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.green700 },
  goalAbandonBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
  },
  goalAbandonBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500 },
  goalReopenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.gray100,
    alignSelf: 'flex-start',
  },
  goalReopenBtnTxt: { fontSize: fontSize.xs, color: colors.gray400 },

  // Measurements
  measureCard: { marginBottom: spacing.sm },
  measureDate: { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginBottom: spacing.sm },
  metricsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricItem:  { minWidth: '28%' },
  metricLabel: { fontSize: fontSize.xs, color: colors.gray400 },
  metricValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginTop: 2 },
  measureNotes:{ fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.sm, fontStyle: 'italic' },
  emptyText:   { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },

  // Modals
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:  { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '92%' },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle:{ fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalHint: { fontSize: fontSize.sm, color: colors.gray500, lineHeight: 20, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  modalBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },

  // Edit form sections
  formSection:     { marginBottom: spacing.xl },
  formSectionTitle:{
    fontSize: fontSize.xs, fontWeight: '700', color: colors.gray400,
    letterSpacing: 0.8, marginBottom: spacing.md,
    paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  fieldHint:  { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.sm, lineHeight: 16 },
  input:      { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.black },
  readonlyField: {
    borderWidth: 1.5, borderColor: colors.gray100, borderRadius: borderRadius.sm,
    padding: spacing.md, backgroundColor: colors.gray50,
  },
  readonlyTxt: { fontSize: fontSize.md, color: colors.gray400 },
  twoColRow:   { flexDirection: 'row', gap: spacing.md },
  twoColItem:  { flex: 1 },

  // Chip selects
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray200,
  },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipTxt:    { fontSize: fontSize.xs, color: colors.gray600 },

  // Tag inputs
  tagInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm },
  tagAddBtn:   {
    width: 40, height: 46, backgroundColor: colors.black, borderRadius: borderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  removableTag: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100, paddingLeft: spacing.sm + 2,
    paddingRight: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200,
  },
  removableTagRed: { backgroundColor: colors.red50, borderColor: '#FCA5A5' },
  removableTagTxt: { fontSize: fontSize.xs, color: colors.gray700, fontWeight: '500' },
  noTagsTxt: { fontSize: fontSize.xs, color: colors.gray400, fontStyle: 'italic', marginTop: spacing.xs },

  // Save
  saveBtn:    { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },

  // Workout assignment rows
  workoutRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  workoutRowSelected: { backgroundColor: colors.gray50 },
  workoutRowAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  workoutRowTitle:    { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  workoutRowMeta:     { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1, textTransform: 'capitalize' },
  checkbox:           { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gray300, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected:   { backgroundColor: colors.black, borderColor: colors.black },
  selectedCount:      { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xs },
  noWorkoutsWrap:     { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  noWorkoutsTxt:      { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center' },
  createWorkoutBtn:   { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  createWorkoutBtnTxt:{ color: colors.white, fontSize: fontSize.sm, fontWeight: '600' },
});