import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, TextInput, ScrollView,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import API from '@/services/api';
import { supabase } from '@/services/supabase';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

type Tab = 'plans' | 'exercises';

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body',
];
const CATEGORIES = ['Compound', 'Isolation', 'Cardio', 'Plyometric', 'Stretch'];
const EQUIPMENT  = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'Other'];

export default function WorkoutsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [plans, setPlans]         = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [clients, setClients]     = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Exercise modal
  const [exerciseModal, setExerciseModal] = useState(false);
  const [exerciseForm, setExerciseForm] = useState({
    name: '', category: '', muscle_group: '',
    equipment: '', cues: '', image_url: '',
  });
  const [savingExercise, setSavingExercise] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localImageUri, setLocalImageUri]   = useState<string | null>(null);

  // Plan modal
  const [planModal, setPlanModal] = useState(false);
  const [planForm, setPlanForm]   = useState({ title: '', goal_focus: '', client_id: '' });
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pR, eR, cR] = await Promise.allSettled([
        API.get('/workout-plans'),
        API.get('/exercises'),
        API.get('/clients'),
      ]);
      if (pR.status === 'fulfilled') setPlans(pR.value.data);
      if (eR.status === 'fulfilled') setExercises(eR.value.data);
      if (cR.status === 'fulfilled') setClients(cR.value.data);
    } catch (err) { console.error(err); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Image picker ──────────────────────────────────────────────────────────
  const pickExerciseImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow access to your photo library to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setLocalImageUri(asset.uri);
    setUploadingImage(true);

    try {
      // Convert URI to blob
      const response = await fetch(asset.uri);
      const blob     = await response.blob();
      const ext      = asset.uri.split('.').pop() ?? 'jpg';
      const fileName = `exercise_${Date.now()}.${ext}`;

      // Upload to Supabase Storage (bucket: 'exercises' — must be public)
      const { data, error } = await supabase.storage
        .from('exercises')
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });

      if (error) {
        Alert.alert('Upload failed', error.message);
        setLocalImageUri(null);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('exercises')
        .getPublicUrl(fileName);

      setExerciseForm((f) => ({ ...f, image_url: publicUrl }));
    } catch (err: any) {
      Alert.alert('Upload error', err.message ?? 'Unknown error');
      setLocalImageUri(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Exercise CRUD ─────────────────────────────────────────────────────────
  const handleCreateExercise = async () => {
    if (!exerciseForm.name.trim()) {
      Alert.alert('Error', 'Exercise name is required');
      return;
    }
    setSavingExercise(true);
    try {
      const res = await API.post('/exercises', {
        name:         exerciseForm.name.trim(),
        category:     exerciseForm.category   || null,
        muscle_group: exerciseForm.muscle_group || null,
        equipment:    exerciseForm.equipment   || null,
        cues:         exerciseForm.cues.trim() || null,
        image_url:    exerciseForm.image_url   || null,
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

  const handleDeleteExercise = (id: string) => {
    Alert.alert('Delete Exercise', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await API.delete(`/exercises/${id}`);
            setExercises((prev) => prev.filter((e) => e.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed');
          }
        },
      },
    ]);
  };

  const resetExerciseForm = () => {
    setExerciseForm({ name: '', category: '', muscle_group: '', equipment: '', cues: '', image_url: '' });
    setLocalImageUri(null);
  };

  // ── Plan CRUD ─────────────────────────────────────────────────────────────
  const handleCreatePlan = async () => {
    if (!planForm.title.trim()) {
      Alert.alert('Error', 'Plan title is required');
      return;
    }
    setSavingPlan(true);
    try {
      const res = await API.post('/workout-plans', {
        title:      planForm.title.trim(),
        goal_focus: planForm.goal_focus.trim() || null,
        client_id:  planForm.client_id || null,
        visibility: 'draft',
        weeks: [{ week_number: 1, days: [{ day_label: 'Day 1', day_order: 1, exercises: [] }] }],
      });
      setPlanModal(false);
      setPlanForm({ title: '', goal_focus: '', client_id: '' });
      await loadData();
      // Navigate to the detail screen to start adding exercises
      router.push(`/pt/workout-detail?id=${res.data.plan_id}` as any);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleArchivePlan = (planId: string) => {
    Alert.alert('Archive Plan', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', style: 'destructive',
        onPress: async () => {
          try {
            await API.delete(`/workout-plans/${planId}`);
            setPlans((prev) => prev.map((p) => p.id === planId ? { ...p, status: 'archived' } : p));
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed');
          }
        },
      },
    ]);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const ChipPicker = ({
    options, selected, onSelect,
  }: { options: string[]; selected: string; onSelect: (v: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          style={[styles.chip, selected === o && styles.chipActive]}
          onPress={() => onSelect(selected === o ? '' : o)}
        >
          <Text style={[styles.chipText, selected === o && styles.chipTextActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderPlan = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/pt/workout-detail?id=${item.id}` as any)}
      onLongPress={() => handleArchivePlan(item.id)}
    >
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.goal_focus && <Text style={styles.cardSub}>{item.goal_focus}</Text>}
            {item.client_id && (
              <Text style={styles.cardClient}>
                {clients.find((c: any) => c.id === item.client_id)?.name ?? 'Assigned to client'}
              </Text>
            )}
            <Text style={styles.cardMeta}>
              {new Date(item.created_at).toLocaleDateString('en-GB')} · Tap to edit
            </Text>
          </View>
          <Badge label={item.status || 'active'} variant={item.status === 'active' ? 'active' : 'inactive'} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderExercise = ({ item }: { item: any }) => (
    <TouchableOpacity onLongPress={() => handleDeleteExercise(item.id)}>
      <Card style={styles.card}>
        <View style={styles.exerciseRow}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.exerciseThumb} />
          ) : (
            <View style={styles.exerciseThumbPlaceholder}>
              <Ionicons name="image-outline" size={24} color={colors.gray300} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <View style={styles.tagsRow}>
              {item.muscle_group && <View style={styles.tag}><Text style={styles.tagText}>{item.muscle_group}</Text></View>}
              {item.category     && <View style={styles.tag}><Text style={styles.tagText}>{item.category}</Text></View>}
              {item.equipment    && <View style={styles.tag}><Text style={styles.tagText}>{item.equipment}</Text></View>}
            </View>
            {item.cues && <Text style={styles.cues} numberOfLines={2}>{item.cues}</Text>}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => activeTab === 'exercises' ? setExerciseModal(true) : setPlanModal(true)}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['plans', 'exercises'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'plans' ? `Plans (${plans.length})` : `Exercises (${exercises.length})`}
            </Text>
          </TouchableOpacity>
        ))}
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
              <Text style={styles.emptyText}>Tap + to create your first plan.</Text>
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
              <Text style={styles.emptyText}>Tap + to add your first exercise.</Text>
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

              {/* Image upload */}
              <Text style={styles.fieldLabel}>Exercise Image (optional)</Text>
              <TouchableOpacity style={styles.imageUploadBtn} onPress={pickExerciseImage} disabled={uploadingImage}>
                {uploadingImage ? (
                  <ActivityIndicator color={colors.gray600} />
                ) : localImageUri || exerciseForm.image_url ? (
                  <Image
                    source={{ uri: localImageUri || exerciseForm.image_url }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={28} color={colors.gray400} />
                    <Text style={styles.imageUploadTxt}>Tap to upload image</Text>
                  </>
                )}
              </TouchableOpacity>
              {(localImageUri || exerciseForm.image_url) && !uploadingImage && (
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => { setLocalImageUri(null); setExerciseForm((f) => ({ ...f, image_url: '' })); }}
                >
                  <Text style={styles.removeImageTxt}>Remove image</Text>
                </TouchableOpacity>
              )}

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
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreateExercise}
                disabled={savingExercise || uploadingImage}
              >
                {savingExercise
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveButtonText}>Create Exercise</Text>}
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
              <TouchableOpacity onPress={() => { setPlanModal(false); setPlanForm({ title: '', goal_focus: '', client_id: '' }); }}>
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
                {clients.map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, planForm.client_id === c.id && styles.chipActive]}
                    onPress={() => setPlanForm((f) => ({ ...f, client_id: c.id }))}
                  >
                    <Text style={[styles.chipText, planForm.client_id === c.id && styles.chipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={16} color={colors.gray500} />
                <Text style={styles.infoText}>
                  A plan is created with Week 1, Day 1. You'll be taken straight to the editor to add exercises.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreatePlan}
                disabled={savingPlan}
              >
                {savingPlan
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveButtonText}>Create Plan & Edit →</Text>}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md,
  },
  title:     { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  addButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    backgroundColor: colors.white, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray200, padding: 4, marginBottom: spacing.md,
  },
  tab:          { flex: 1, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm - 2, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.black },
  tabText:      { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray500 },
  tabTextActive:{ color: colors.white },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle:  { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  cardSub:    { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  cardClient: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },
  cardMeta:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.sm },
  exerciseRow:{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  exerciseThumb: { width: 64, height: 64, borderRadius: borderRadius.sm },
  exerciseThumbPlaceholder: {
    width: 64, height: 64, borderRadius: borderRadius.sm,
    backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center',
  },
  tagsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    backgroundColor: colors.gray100, paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs, borderRadius: borderRadius.full,
  },
  tagText: { fontSize: fontSize.xs, color: colors.gray600 },
  cues:    { fontSize: fontSize.sm, color: colors.gray400, marginTop: spacing.sm },
  empty:      { paddingVertical: spacing.xxxl * 2, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400 },

  // Image upload
  imageUploadBtn: {
    height: 120, borderWidth: 1.5, borderColor: colors.gray200, borderStyle: 'dashed',
    borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gray50, overflow: 'hidden',
  },
  imagePreview:    { width: '100%', height: '100%' },
  imageUploadTxt:  { fontSize: fontSize.sm, color: colors.gray400, marginTop: spacing.sm },
  removeImageBtn:  { marginTop: spacing.sm, alignSelf: 'flex-end' },
  removeImageTxt:  { fontSize: fontSize.sm, color: colors.red500, fontWeight: '500' },

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
  modalTitle:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:   { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  fieldLabel:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700, marginTop: spacing.lg, marginBottom: spacing.sm },
  textInput: {
    borderWidth: 1, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.sm, color: colors.black,
  },
  chipScroll:    { marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200, marginRight: spacing.sm, marginBottom: spacing.sm,
  },
  chipActive:    { backgroundColor: colors.black, borderColor: colors.black },
  chipText:      { fontSize: fontSize.xs, color: colors.gray600 },
  chipTextActive:{ color: colors.white },
  saveButton: {
    backgroundColor: colors.black, paddingVertical: spacing.lg,
    borderRadius: borderRadius.sm, alignItems: 'center', marginTop: spacing.xl,
  },
  saveButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.gray50,
    padding: spacing.md, borderRadius: borderRadius.sm, gap: spacing.sm, marginTop: spacing.lg,
  },
  infoText: { fontSize: fontSize.xs, color: colors.gray500, flex: 1 },
});