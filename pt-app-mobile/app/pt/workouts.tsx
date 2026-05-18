// app/pt/workouts.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

type Tab = 'plans' | 'exercises';

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body',
];

const CATEGORIES = ['Compound', 'Isolation', 'Cardio', 'Plyometric', 'Stretch'];

const EQUIPMENT = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight',
  'Kettlebell', 'Resistance Band', 'Other',
];

export default function WorkoutsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [plans, setPlans] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Exercise Modal State
  const [exerciseModal, setExerciseModal] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    category: '',
    muscle_group: '',
    equipment: '',
    cues: '',
  });
  const [savingExercise, setSavingExercise] = useState(false);

  // Plan Modal State
  const [planModal, setPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    title: '',
    goal_focus: '',
    client_id: '',
  });
  const [savingPlan, setSavingPlan] = useState(false);
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, exercisesRes, clientsRes] = await Promise.allSettled([
        API.get('/workout-plans'),
        API.get('/exercises'),
        API.get('/clients'),
      ]);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data);
      if (exercisesRes.status === 'fulfilled') setExercises(exercisesRes.value.data);
      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.data);
    } catch (err) {
      console.error(err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Exercise CRUD ──

  const handleCreateExercise = async () => {
    if (!exerciseForm.name.trim()) {
      Alert.alert('Error', 'Exercise name is required');
      return;
    }
    setSavingExercise(true);
    try {
      const res = await API.post('/exercises', {
        name: exerciseForm.name.trim(),
        category: exerciseForm.category || null,
        muscle_group: exerciseForm.muscle_group || null,
        equipment: exerciseForm.equipment || null,
        cues: exerciseForm.cues.trim() || null,
      });
      setExercises((prev) => [res.data, ...prev]);
      setExerciseModal(false);
      resetExerciseForm();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create exercise');
    } finally {
      setSavingExercise(false);
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    Alert.alert('Delete Exercise', 'Are you sure you want to delete this exercise?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await API.delete(`/exercises/${exerciseId}`);
            setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const resetExerciseForm = () => {
    setExerciseForm({ name: '', category: '', muscle_group: '', equipment: '', cues: '' });
  };

  // ── Plan CRUD ──

  const handleCreatePlan = async () => {
    if (!planForm.title.trim()) {
      Alert.alert('Error', 'Plan title is required');
      return;
    }
    setSavingPlan(true);
    try {
      const res = await API.post('/workout-plans', {
        title: planForm.title.trim(),
        goal_focus: planForm.goal_focus.trim() || null,
        client_id: planForm.client_id || null,
        visibility: 'draft',
        weeks: [
          {
            week_number: 1,
            days: [
              {
                day_label: 'Day 1',
                day_order: 1,
                exercises: [],
              },
            ],
          },
        ],
      });
      setPlanModal(false);
      resetPlanForm();
      await loadData(); // Refresh plans list
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleArchivePlan = (planId: string) => {
    Alert.alert('Archive Plan', 'Are you sure you want to archive this plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await API.delete(`/workout-plans/${planId}`);
            setPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, status: 'archived' } : p)));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to archive');
          }
        },
      },
    ]);
  };

  const resetPlanForm = () => {
    setPlanForm({ title: '', goal_focus: '', client_id: '' });
  };

  // ── Render Items ──

  const renderPlan = ({ item }: { item: any }) => (
    <TouchableOpacity onLongPress={() => handleArchivePlan(item.id)}>
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.goal_focus && <Text style={styles.cardSub}>{item.goal_focus}</Text>}
            {item.client?.user?.full_name && (
              <Text style={styles.cardClient}>
                <Ionicons name="person-outline" size={12} color={colors.gray400} />{' '}
                {item.client.user.full_name}
              </Text>
            )}
            <Text style={styles.cardMeta}>
              Created {new Date(item.created_at).toLocaleDateString('en-GB')}
            </Text>
          </View>
          <Badge
            label={item.status || 'active'}
            variant={item.status === 'active' ? 'active' : 'inactive'}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderExercise = ({ item }: { item: any }) => (
    <TouchableOpacity onLongPress={() => handleDeleteExercise(item.id)}>
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.tagsRow}>
          {item.muscle_group && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.muscle_group}</Text>
            </View>
          )}
          {item.category && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.category}</Text>
            </View>
          )}
          {item.equipment && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.equipment}</Text>
            </View>
          )}
        </View>
        {item.cues && (
          <Text style={styles.cues} numberOfLines={2}>
            {item.cues}
          </Text>
        )}
      </Card>
    </TouchableOpacity>
  );

  // ── Picker Component ──

  const ChipPicker = ({
    options,
    selected,
    onSelect,
  }: {
    options: string[];
    selected: string;
    onSelect: (val: string) => void;
  }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          style={[styles.chip, selected === option && styles.chipActive]}
          onPress={() => onSelect(selected === option ? '' : option)}
        >
          <Text style={[styles.chipText, selected === option && styles.chipTextActive]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (activeTab === 'exercises') {
              setExerciseModal(true);
            } else {
              setPlanModal(true);
            }
          }}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'plans' && styles.tabActive]}
          onPress={() => setActiveTab('plans')}
        >
          <Text style={[styles.tabText, activeTab === 'plans' && styles.tabTextActive]}>
            Plans ({plans.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'exercises' && styles.tabActive]}
          onPress={() => setActiveTab('exercises')}
        >
          <Text style={[styles.tabText, activeTab === 'exercises' && styles.tabTextActive]}>
            Exercises ({exercises.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'plans' ? (
        <FlatList
          data={plans}
          renderItem={renderPlan}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="barbell-outline" size={48} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No workout plans yet</Text>
              <Text style={styles.emptyText}>
                Tap + to create your first plan.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={exercises}
          renderItem={renderExercise}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="fitness-outline" size={48} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No exercises yet</Text>
              <Text style={styles.emptyText}>
                Tap + to add your first exercise.
              </Text>
            </View>
          }
        />
      )}

      {/* ── Add Exercise Modal ── */}
      <Modal visible={exerciseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Exercise</Text>
              <TouchableOpacity onPress={() => { setExerciseModal(false); resetExerciseForm(); }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Barbell Bench Press"
                placeholderTextColor={colors.gray400}
                value={exerciseForm.name}
                onChangeText={(v) => setExerciseForm((f) => ({ ...f, name: v }))}
              />

              <Text style={styles.fieldLabel}>Muscle Group</Text>
              <ChipPicker
                options={MUSCLE_GROUPS}
                selected={exerciseForm.muscle_group}
                onSelect={(v) => setExerciseForm((f) => ({ ...f, muscle_group: v }))}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <ChipPicker
                options={CATEGORIES}
                selected={exerciseForm.category}
                onSelect={(v) => setExerciseForm((f) => ({ ...f, category: v }))}
              />

              <Text style={styles.fieldLabel}>Equipment</Text>
              <ChipPicker
                options={EQUIPMENT}
                selected={exerciseForm.equipment}
                onSelect={(v) => setExerciseForm((f) => ({ ...f, equipment: v }))}
              />

              <Text style={styles.fieldLabel}>Coaching Cues</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="e.g. Retract shoulder blades, drive feet into floor..."
                placeholderTextColor={colors.gray400}
                value={exerciseForm.cues}
                onChangeText={(v) => setExerciseForm((f) => ({ ...f, cues: v }))}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateExercise}
                disabled={savingExercise}
              >
                {savingExercise ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Create Exercise</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Plan Modal ── */}
      <Modal visible={planModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Workout Plan</Text>
              <TouchableOpacity onPress={() => { setPlanModal(false); resetPlanForm(); }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Plan Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 12 Week Strength Program"
                placeholderTextColor={colors.gray400}
                value={planForm.title}
                onChangeText={(v) => setPlanForm((f) => ({ ...f, title: v }))}
              />

              <Text style={styles.fieldLabel}>Goal / Focus</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Hypertrophy, Fat Loss, Strength"
                placeholderTextColor={colors.gray400}
                value={planForm.goal_focus}
                onChangeText={(v) => setPlanForm((f) => ({ ...f, goal_focus: v }))}
              />

              <Text style={styles.fieldLabel}>Assign to Client (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                <TouchableOpacity
                  style={[styles.chip, !planForm.client_id && styles.chipActive]}
                  onPress={() => setPlanForm((f) => ({ ...f, client_id: '' }))}
                >
                  <Text style={[styles.chipText, !planForm.client_id && styles.chipTextActive]}>
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {clients.map((client: any) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.chip, planForm.client_id === client.id && styles.chipActive]}
                    onPress={() => setPlanForm((f) => ({ ...f, client_id: client.id }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        planForm.client_id === client.id && styles.chipTextActive,
                      ]}
                    >
                      {client.user?.full_name || client.user?.email || 'Client'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color={colors.gray500} />
                <Text style={styles.infoText}>
                  A plan will be created with 1 week and 1 day. You can add more structure after creating it.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreatePlan}
                disabled={savingPlan}
              >
                {savingPlan ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Create Plan</Text>
                )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm - 2,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.black },
  tabText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray500 },
  tabTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  cardSub: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  cardClient: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },
  cardMeta: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.sm },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: { fontSize: fontSize.xs, color: colors.gray600 },
  cues: { fontSize: fontSize.sm, color: colors.gray400, marginTop: spacing.sm },
  empty: { paddingVertical: spacing.xxxl * 2, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText: { fontSize: fontSize.sm, color: colors.gray400 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray700,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.black,
  },
  chipScroll: { marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray200,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipActive: { backgroundColor: colors.black, borderColor: colors.black },
  chipText: { fontSize: fontSize.xs, color: colors.gray600 },
  chipTextActive: { color: colors.white },
  saveButton: {
    backgroundColor: colors.black,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.gray50,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  infoText: { fontSize: fontSize.xs, color: colors.gray500, flex: 1 },
});