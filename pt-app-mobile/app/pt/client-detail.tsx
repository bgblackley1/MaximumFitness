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

  // ── Edit client details modal ──
  const [editClientModal,  setEditClientModal]  = useState(false);
  const [savingClient,     setSavingClient]     = useState(false);
  const [editForm, setEditForm] = useState({
    age:                '',
    sex:                '',
    height_cm:          '',
    starting_weight_kg: '',
    notes:              '',
    injuries:           '',   // comma-separated string, split on save
    status:             'active',
  });

  // ── Measurement modal ──
  const [mModal,  setMModal]  = useState(false);
  const [mSaving, setMSaving] = useState(false);
  const [mForm, setMForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight_kg: '', chest_cm: '', waist_cm: '',
    left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '',
  });

  // ── Goal modal ──
  const [gModal,  setGModal]  = useState(false);
  const [gSaving, setGSaving] = useState(false);
  const [gForm, setGForm] = useState({
    description: '', type: 'weight',
    target_value: '', target_unit: 'kg',
    target_date: '', current_value: '',
  });

  // ── Workout assignment modal ──
  const [workoutModal,      setWorkoutModal]      = useState(false);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([]);
  const [savingWorkouts,    setSavingWorkouts]    = useState(false);

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

  // ✅ FIX: canGoBack guard — never sends PT back to homepage
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/pt/clients' as any);
  };

  // ── Open edit client modal ───────────────────────────────────────────────
  const openEditClient = () => {
    if (!client) return;
    setEditForm({
      age:                client.age                != null ? String(client.age)                : '',
      sex:                client.sex                ?? '',
      height_cm:          client.height_cm          != null ? String(client.height_cm)          : '',
      starting_weight_kg: client.starting_weight_kg != null ? String(client.starting_weight_kg) : '',
      notes:              client.notes              ?? '',
      injuries:           Array.isArray(client.injuries) ? client.injuries.join(', ')            : '',
      status:             client.status             ?? 'active',
    });
    setEditClientModal(true);
  };

  // ── Save client edits ────────────────────────────────────────────────────
  const handleSaveClient = async () => {
    setSavingClient(true);
    try {
      const payload: any = {};
      if (editForm.age)                payload.age                = parseInt(editForm.age);
      if (editForm.sex)                payload.sex                = editForm.sex;
      if (editForm.height_cm)          payload.height_cm          = parseFloat(editForm.height_cm);
      if (editForm.starting_weight_kg) payload.starting_weight_kg = parseFloat(editForm.starting_weight_kg);
      if (editForm.notes !== undefined) payload.notes = editForm.notes || null;
      payload.injuries = editForm.injuries
        ? editForm.injuries.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      payload.status = editForm.status;

      const res = await API.put(`/clients/${id}`, payload);
      setClient((prev: any) => ({ ...prev, ...res.data }));
      setEditClientModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update client details');
    } finally {
      setSavingClient(false);
    }
  };

  // ── Save measurement ─────────────────────────────────────────────────────
  const saveMeasurement = async () => {
    if (!mForm.date) { Alert.alert('Error', 'Date is required'); return; }
    setMSaving(true);
    try {
      const payload: any = { date: mForm.date };
      ['weight_kg','chest_cm','waist_cm','left_arm_cm','right_arm_cm','thigh_cm','hips_cm'].forEach((k) => {
        const v = (mForm as any)[k];
        if (v !== '') payload[k] = parseFloat(v);
      });
      if (mForm.notes) payload.notes = mForm.notes;
      const res = await API.post(`/clients/${id}/measurements`, payload);
      setMeasurements((prev) => [res.data, ...prev]);
      setMModal(false);
      setMForm({ date: new Date().toISOString().split('T')[0], weight_kg: '', chest_cm: '', waist_cm: '', left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '' });
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed to save'); }
    finally { setMSaving(false); }
  };

  // ── Save goal ────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    if (!gForm.description || !gForm.target_value) { Alert.alert('Error', 'Description and target value are required'); return; }
    setGSaving(true);
    try {
      const payload: any = { description: gForm.description, type: gForm.type, target_value: parseFloat(gForm.target_value), target_unit: gForm.target_unit };
      if (gForm.target_date)   payload.target_date   = gForm.target_date;
      if (gForm.current_value) payload.current_value = parseFloat(gForm.current_value);
      const res = await API.post(`/clients/${id}/goals`, payload);
      setGoals((prev) => [res.data, ...prev]);
      setGModal(false);
      setGForm({ description: '', type: 'weight', target_value: '', target_unit: 'kg', target_date: '', current_value: '' });
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed to save'); }
    finally { setGSaving(false); }
  };

  // ── Save workout assignments ─────────────────────────────────────────────
  const saveWorkoutAssignments = async () => {
    setSavingWorkouts(true);
    try {
      await API.put(`/workout-plans/assignments/by-client/${id}`, { workout_ids: selectedWorkoutIds });
      const res = await API.get('/workout-plans', { params: { client_id: id } });
      setAssignedWorkouts(res.data);
      setWorkoutModal(false);
    } catch (err: any) { Alert.alert('Error', err.response?.data?.detail || 'Failed to save workout assignments'); }
    finally { setSavingWorkouts(false); }
  };

  const toggleWorkout = (wid: string) =>
    setSelectedWorkoutIds((prev) => prev.includes(wid) ? prev.filter((x) => x !== wid) : [...prev, wid]);

  const openWorkoutModal = () => {
    setSelectedWorkoutIds(assignedWorkouts.map((w) => w.id));
    setWorkoutModal(true);
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
        {/* ✅ FIX: back button uses canGoBack guard */}
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Client Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{client.name?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientEmail}>{client.email}</Text>
            </View>
            <Badge label={client.status || 'active'} variant={client.status === 'active' ? 'active' : 'inactive'} />
          </View>
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
          {client.injuries?.length > 0 && (
            <View style={styles.injuriesRow}>
              <Text style={styles.injuriesLabel}>Medical / Injuries:</Text>
              <Text style={styles.injuriesTxt}>{client.injuries.join(', ')}</Text>
            </View>
          )}
          {client.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{client.notes}</Text>
            </View>
          )}
          {/* ── Edit Details button ── */}
          <TouchableOpacity style={styles.editDetailsBtn} onPress={openEditClient}>
            <Ionicons name="create-outline" size={15} color={colors.gray600} />
            <Text style={styles.editDetailsBtnTxt}>Edit Client Details</Text>
          </TouchableOpacity>
        </Card>

        {/* Assigned Workouts */}
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
                onPress={() => router.push(`/pt/workout-detail?id=${w.id}` as any)}
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

        {/* Goals */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
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
                    {goal.current_value != null ? ` · Current: ${goal.current_value} ${goal.target_unit}` : ''}
                    {goal.target_date ? ` · Due: ${fmtDate(goal.target_date)}` : ''}
                  </Text>
                </View>
                <Badge label={goal.status.replace('_', ' ')} variant={goal.status === 'achieved' ? 'active' : goal.status === 'abandoned' ? 'danger' : 'pending'} />
              </View>
            </Card>
          ))
        )}

        {/* Measurements */}
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

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT CLIENT DETAILS MODAL
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editClientModal} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Edit Client Details</Text>
              <TouchableOpacity onPress={() => setEditClientModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">

              {/* Status */}
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

              {/* Age */}
              <Text style={styles.fieldLabel}>Age</Text>
              <TextInput
                style={styles.input}
                value={editForm.age}
                onChangeText={(v) => setEditForm((f) => ({ ...f, age: v }))}
                placeholder="e.g. 28"
                placeholderTextColor={colors.gray400}
                keyboardType="number-pad"
              />

              {/* Sex */}
              <Text style={styles.fieldLabel}>Sex</Text>
              <View style={styles.chipRow}>
                {['male', 'female', 'non-binary', 'prefer not to say'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, editForm.sex === s && styles.chipActive]}
                    onPress={() => setEditForm((f) => ({ ...f, sex: s }))}
                  >
                    <Text style={[styles.chipTxt, editForm.sex === s && { color: colors.white }]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Height */}
              <Text style={styles.fieldLabel}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={editForm.height_cm}
                onChangeText={(v) => setEditForm((f) => ({ ...f, height_cm: v }))}
                placeholder="e.g. 175"
                placeholderTextColor={colors.gray400}
                keyboardType="decimal-pad"
              />

              {/* Starting weight */}
              <Text style={styles.fieldLabel}>Starting Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={editForm.starting_weight_kg}
                onChangeText={(v) => setEditForm((f) => ({ ...f, starting_weight_kg: v }))}
                placeholder="e.g. 85"
                placeholderTextColor={colors.gray400}
                keyboardType="decimal-pad"
              />

              {/* Injuries / Medical */}
              <Text style={styles.fieldLabel}>Medical Conditions / Injuries</Text>
              <Text style={styles.fieldHint}>Comma-separated, e.g. "bad knee, lower back pain"</Text>
              <TextInput
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                value={editForm.injuries}
                onChangeText={(v) => setEditForm((f) => ({ ...f, injuries: v }))}
                placeholder="e.g. bad knee, lower back pain"
                placeholderTextColor={colors.gray400}
                multiline
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>Trainer Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                value={editForm.notes}
                onChangeText={(v) => setEditForm((f) => ({ ...f, notes: v }))}
                placeholder="Any additional notes about this client..."
                placeholderTextColor={colors.gray400}
                multiline
              />

              <TouchableOpacity
                style={[styles.saveBtn, savingClient && { opacity: 0.6 }]}
                onPress={handleSaveClient}
                disabled={savingClient}
              >
                {savingClient
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Changes</Text>}
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
                  <TouchableOpacity style={styles.createWorkoutBtn} onPress={() => { setWorkoutModal(false); router.push('/pt/workout-detail' as any); }}>
                    <Text style={styles.createWorkoutBtnTxt}>Create a Workout →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                allWorkouts.map((w) => {
                  const isSelected = selectedWorkoutIds.includes(w.id);
                  return (
                    <TouchableOpacity key={w.id} style={[styles.workoutRow, isSelected && styles.workoutRowSelected]} onPress={() => toggleWorkout(w.id)} activeOpacity={0.7}>
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
                  <TouchableOpacity style={[styles.saveBtn, savingWorkouts && { opacity: 0.6 }]} onPress={saveWorkoutAssignments} disabled={savingWorkouts}>
                    {savingWorkouts ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnTxt}>Save Assignments</Text>}
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
              <TouchableOpacity onPress={() => setMModal(false)}><Ionicons name="close" size={24} color={colors.gray600} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput style={styles.input} value={mForm.date} onChangeText={(v) => setMForm((f) => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.gray400} />
              {[['Weight (kg)', 'weight_kg'], ['Chest (cm)', 'chest_cm'], ['Waist (cm)', 'waist_cm'], ['L. Arm (cm)', 'left_arm_cm'], ['R. Arm (cm)', 'right_arm_cm'], ['Thigh (cm)', 'thigh_cm'], ['Hips (cm)', 'hips_cm']].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput style={styles.input} value={(mForm as any)[key]} onChangeText={(v) => setMForm((f) => ({ ...f, [key]: v }))} placeholder="Optional" placeholderTextColor={colors.gray400} keyboardType="decimal-pad" />
                </View>
              ))}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={mForm.notes} onChangeText={(v) => setMForm((f) => ({ ...f, notes: v }))} placeholder="Optional" placeholderTextColor={colors.gray400} multiline />
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
              <Text style={styles.modalTitle}>Add Goal</Text>
              <TouchableOpacity onPress={() => setGModal(false)}><Ionicons name="close" size={24} color={colors.gray600} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput style={styles.input} value={gForm.description} onChangeText={(v) => setGForm((f) => ({ ...f, description: v }))} placeholder="e.g. Lose 10kg by summer" placeholderTextColor={colors.gray400} />
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
  container:   { flex: 1, backgroundColor: colors.gray50 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '600' },
  scroll:      { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },
  profileCard: { marginBottom: spacing.lg },
  profileTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  avatar:      { width: 52, height: 52, borderRadius: borderRadius.full, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText:  { color: colors.white, fontSize: fontSize.xl, fontWeight: '700' },
  profileInfo: { flex: 1 },
  clientName:  { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  clientEmail: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  statsRow:    { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.lg },
  statItem:    { flex: 1, alignItems: 'center' },
  statLabel:   { fontSize: fontSize.xs, color: colors.gray400 },
  statValue:   { fontSize: fontSize.md, fontWeight: '600', color: colors.black, marginTop: 2 },
  injuriesRow: { borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.md, marginTop: spacing.lg },
  injuriesLabel:{ fontSize: fontSize.xs, color: colors.gray400, marginBottom: 2 },
  injuriesTxt: { fontSize: fontSize.sm, color: colors.gray700, lineHeight: 18 },
  notesSection:{ borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.lg, marginTop: spacing.lg },
  notesLabel:  { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.xs },
  notesText:   { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },
  // Edit client button on profile card
  editDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    justifyContent: 'center', marginTop: spacing.lg,
    borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.lg,
  },
  editDetailsBtnTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray600 },
  // Section headers
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  sectionTitle:  { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  sectionSub:    { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  addIcon:       { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  manageBtn:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.black, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 1, borderRadius: borderRadius.sm },
  manageBtnTxt:  { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },
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
  goalCard:    { marginBottom: spacing.sm },
  goalRow:     { flexDirection: 'row', alignItems: 'center' },
  goalDesc:    { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  goalMeta:    { fontSize: fontSize.sm, color: colors.gray400, marginTop: 4 },
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
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '88%' },
  modalHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalHint:   { fontSize: fontSize.sm, color: colors.gray500, lineHeight: 20, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  modalBody:   { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  fieldLabel:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  fieldHint:   { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.sm, marginTop: -spacing.xs },
  input:       { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: fontSize.md, color: colors.black },
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip:        { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray200 },
  chipActive:  { backgroundColor: colors.black, borderColor: colors.black },
  chipTxt:     { fontSize: fontSize.xs, color: colors.gray600 },
  saveBtn:     { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
  saveBtnTxt:  { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
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