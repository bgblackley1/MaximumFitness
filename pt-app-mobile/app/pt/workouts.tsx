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
const BLANK_EX   = { name: '', category: '', muscle_group: '', equipment: '', cues: '', image_url: '' };

export default function WorkoutsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [plans, setPlans]         = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [clients, setClients]     = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // ── Create exercise modal ──
  const [exerciseModal, setExerciseModal] = useState(false);
  const [exerciseForm, setExerciseForm]   = useState(BLANK_EX);
  const [savingExercise, setSavingExercise] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localImageUri, setLocalImageUri]   = useState<string | null>(null);

  // ── Edit exercise modal ──
  const [editExModal, setEditExModal] = useState(false);
  const [editingEx, setEditingEx]     = useState<any | null>(null);
  const [editExForm, setEditExForm]   = useState(BLANK_EX);
  const [savingEditEx, setSavingEditEx]   = useState(false);
  const [editUploadingImg, setEditUploadingImg] = useState(false);
  const [editLocalImg, setEditLocalImg]         = useState<string | null>(null);

  // ── Create plan modal ──
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

  // ── Image picker — FIXED: use mimeType, not URI parsing ───────────────────
  const pickImage = async (
    onUri:      (uri: string) => void,
    onUrl:      (url: string) => void,
    setUploading: (v: boolean) => void,
  ) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload images.');
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
    onUri(asset.uri);
    setUploading(true);

    try {
      // ── FIX: derive extension from mimeType, not from the URI string ──────
      // On web, asset.uri is a blob URL like blob:http://localhost:8081/...
      // which has no file extension to parse.
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg':  'jpg',
        'image/png':  'png',
        'image/webp': 'webp',
        'image/gif':  'gif',
        'image/heic': 'jpg', // iOS HEIC — convert to jpg
        'image/heif': 'jpg',
      };
      const ext      = mimeToExt[mimeType] ?? 'jpg';
      const fileName = `exercise_${Date.now()}.${ext}`;  // ← clean filename

      const response = await fetch(asset.uri);
      const blob     = await response.blob();

      const { data, error } = await supabase.storage
        .from('exercises')
        .upload(fileName, blob, {
          contentType: mimeType,   // ← also use mimeType here, not `image/${ext}`
          upsert: true,
        });

      if (error) {
        Alert.alert('Upload failed', error.message);
        onUri('');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('exercises')
        .getPublicUrl(fileName);

      onUrl(publicUrl);
    } catch (err: any) {
      Alert.alert('Upload error', err.message ?? 'Unknown error');
      onUri('');
    } finally {
      setUploading(false);
    }
  };

  // ── Create exercise ───────────────────────────────────────────────────────
  const handleCreateExercise = async () => {
    if (!exerciseForm.name.trim()) {
      Alert.alert('Error', 'Exercise name is required');
      return;
    }
    setSavingExercise(true);
    try {
      const res = await API.post('/exercises', {
        name:         exerciseForm.name.trim(),
        category:     exerciseForm.category     || null,
        muscle_group: exerciseForm.muscle_group || null,
        equipment:    exerciseForm.equipment    || null,
        cues:         exerciseForm.cues.trim()  || null,
        image_url:    exerciseForm.image_url    || null,
      });
      setExercises((prev) => [res.data, ...prev]);
      setExerciseModal(false);
      setExerciseForm(BLANK_EX);
      setLocalImageUri(null);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create exercise');
    } finally {
      setSavingExercise(false);
    }
  };

  // ── Open edit exercise ────────────────────────────────────────────────────
  const openEditExercise = (ex: any) => {
    setEditingEx(ex);
    setEditExForm({
      name:         ex.name ?? '',
      category:     ex.category ?? '',
      muscle_group: ex.muscle_group ?? '',
      equipment:    ex.equipment ?? '',
      cues:         ex.cues ?? '',
      image_url:    ex.image_url ?? '',
    });
    setEditLocalImg(null);
    setEditExModal(true);
  };

  // ── Save exercise edits ───────────────────────────────────────────────────
  const handleSaveExercise = async () => {
    if (!editExForm.name.trim() || !editingEx) {
      Alert.alert('Error', 'Exercise name is required');
      return;
    }
    setSavingEditEx(true);
    try {
      const res = await API.put(`/exercises/${editingEx.id}`, {
        name:         editExForm.name.trim(),
        category:     editExForm.category     || null,
        muscle_group: editExForm.muscle_group || null,
        equipment:    editExForm.equipment    || null,
        cues:         editExForm.cues.trim()  || null,
        image_url:    editExForm.image_url    || null,
      });
      setExercises((prev) => prev.map((e) => e.id === editingEx.id ? res.data : e));
      setEditExModal(false);
      setEditingEx(null);
      setEditLocalImg(null);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update exercise');
    } finally {
      setSavingEditEx(false);
    }
  };

  // ── Delete exercise ───────────────────────────────────────────────────────
  const handleDeleteExercise = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'This will soft-delete it (existing plans are unaffected).', [
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

  // ── Create plan ───────────────────────────────────────────────────────────
  const handleCreatePlan = async () => {
    if (!planForm.title.trim()) {
      Alert.alert('Error', 'Routine name is required');
      return;
    }
    setSavingPlan(true);
    try {
      const res = await API.post('/workout-plans', {
        title:      planForm.title.trim(),
        goal_focus: planForm.goal_focus.trim() || null,
        client_id:  planForm.client_id || null,
        visibility: 'draft',
        weeks: [{
          week_number: 1,
          days: [{ day_label: 'Workout', day_order: 1, exercises: [] }],
        }],
      });
      setPlanModal(false);
      setPlanForm({ title: '', goal_focus: '', client_id: '' });
      await loadData();
      router.push(`/pt/workout-detail?id=${res.data.plan_id}` as any);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to create routine');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleArchivePlan = (planId: string) => {
    Alert.alert('Archive Routine', 'Are you sure?', [
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

  // ── Reusable chip picker ──────────────────────────────────────────────────
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

  // ── Reusable image upload field ───────────────────────────────────────────
  const ImageUploadField = ({
    localUri, imageUrl, uploading, onPick, onRemove,
  }: {
    localUri: string | null; imageUrl: string;
    uploading: boolean; onPick: () => void; onRemove: () => void;
  }) => (
    <>
      <TouchableOpacity
        style={styles.imageUploadBtn}
        onPress={onPick}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={colors.gray600} />
        ) : localUri || imageUrl ? (
          <Image source={{ uri: localUri || imageUrl }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <>
            <Ionicons name="camera-outline" size={28} color={colors.gray400} />
            <Text style={styles.imageUploadTxt}>Tap to upload image</Text>
          </>
        )}
      </TouchableOpacity>
      {(localUri || imageUrl) && !uploading && (
        <TouchableOpacity style={styles.removeImageBtn} onPress={onRemove}>
          <Text style={styles.removeImageTxt}>Remove image</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // ── Render plan card ──────────────────────────────────────────────────────
  const renderPlan = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/pt/workout-detail?id=${item.id}` as any)}
      onLongPress={() => handleArchivePlan(item.id)}
      activeOpacity={0.8}
    >
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.goal_focus && <Text style={styles.cardSub}>{item.goal_focus}</Text>}
            {item.client_id && (
              <Text style={styles.cardClient}>
                👤 {clients.find((c: any) => c.id === item.client_id)?.name ?? 'Assigned to client'}
              </Text>
            )}
            <Text style={styles.cardMeta}>
              {new Date(item.created_at).toLocaleDateString('en-GB')} · Tap to edit · Long press to archive
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

  // ── Render exercise card ──────────────────────────────────────────────────
  const renderExercise = ({ item }: { item: any }) => (
    <TouchableOpacity onPress={() => openEditExercise(item)} activeOpacity={0.8}>
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
            {item.cues ? <Text style={styles.cues} numberOfLines={2}>{item.cues}</Text> : null}
            <Text style={styles.tapToEditHint}>Tap to edit · Long press to delete</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteExercise(item.id, item.name)}
            style={{ padding: spacing.xs }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.gray300} />
          </TouchableOpacity>
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
              {t === 'plans' ? `Routines (${plans.length})` : `Exercises (${exercises.length})`}
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
              <Text style={styles.emptyTitle}>No routines yet</Text>
              <Text style={styles.emptyText}>Tap + to create (e.g. "Chest Day", "Push Day").</Text>
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
              <Text style={styles.emptyText}>Tap + to build your exercise library.</Text>
            </View>
          }
        />
      )}

      {/* ── Create Exercise Modal ── */}
      <Modal visible={exerciseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Exercise</Text>
              <TouchableOpacity onPress={() => {
                setExerciseModal(false);
                setExerciseForm(BLANK_EX);
                setLocalImageUri(null);
              }}>
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

              <Text style={styles.fieldLabel}>Exercise Image (optional)</Text>
              <ImageUploadField
                localUri={localImageUri}
                imageUrl={exerciseForm.image_url}
                uploading={uploadingImage}
                onPick={() => pickImage(
                  (uri) => setLocalImageUri(uri),
                  (url) => setExerciseForm((f) => ({ ...f, image_url: url })),
                  setUploadingImage,
                )}
                onRemove={() => {
                  setLocalImageUri(null);
                  setExerciseForm((f) => ({ ...f, image_url: '' }));
                }}
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

      {/* ── Edit Exercise Modal ── */}
      <Modal visible={editExModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Exercise</Text>
              <TouchableOpacity onPress={() => {
                setEditExModal(false);
                setEditingEx(null);
                setEditLocalImg(null);
              }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Exercise name"
                placeholderTextColor={colors.gray400}
                value={editExForm.name}
                onChangeText={(v) => setEditExForm((f) => ({ ...f, name: v }))}
              />

              <Text style={styles.fieldLabel}>Exercise Image</Text>
              <ImageUploadField
                localUri={editLocalImg}
                imageUrl={editExForm.image_url}
                uploading={editUploadingImg}
                onPick={() => pickImage(
                  (uri) => setEditLocalImg(uri),
                  (url) => setEditExForm((f) => ({ ...f, image_url: url })),
                  setEditUploadingImg,
                )}
                onRemove={() => {
                  setEditLocalImg(null);
                  setEditExForm((f) => ({ ...f, image_url: '' }));
                }}
              />

              <Text style={styles.fieldLabel}>Muscle Group</Text>
              <ChipPicker
                options={MUSCLE_GROUPS}
                selected={editExForm.muscle_group}
                onSelect={(v) => setEditExForm((f) => ({ ...f, muscle_group: v }))}
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <ChipPicker
                options={CATEGORIES}
                selected={editExForm.category}
                onSelect={(v) => setEditExForm((f) => ({ ...f, category: v }))}
              />

              <Text style={styles.fieldLabel}>Equipment</Text>
              <ChipPicker
                options={EQUIPMENT}
                selected={editExForm.equipment}
                onSelect={(v) => setEditExForm((f) => ({ ...f, equipment: v }))}
              />

              <Text style={styles.fieldLabel}>Coaching Cues</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="e.g. Retract shoulder blades..."
                placeholderTextColor={colors.gray400}
                value={editExForm.cues}
                onChangeText={(v) => setEditExForm((f) => ({ ...f, cues: v }))}
                multiline
              />

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  if (!editingEx) return;
                  setEditExModal(false);
                  setTimeout(() => handleDeleteExercise(editingEx.id, editingEx.name), 300);
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.red700} />
                <Text style={styles.deleteBtnTxt}>Delete Exercise</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveExercise}
                disabled={savingEditEx || editUploadingImg}
              >
                {savingEditEx
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveButtonText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Create Routine Modal ── */}
      <Modal visible={planModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Routine</Text>
              <TouchableOpacity onPress={() => {
                setPlanModal(false);
                setPlanForm({ title: '', goal_focus: '', client_id: '' });
              }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Routine Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Chest Day, Push Day, Leg Day"
                placeholderTextColor={colors.gray400}
                value={planForm.title}
                onChangeText={(v) => setPlanForm((f) => ({ ...f, title: v }))}
                autoFocus
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
                  After creating, you'll go straight to the editor to add exercises.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleCreatePlan}
                disabled={savingPlan}
              >
                {savingPlan
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveButtonText}>Create Routine & Edit →</Text>}
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
  cardClient: { fontSize: fontSize.xs, color: colors.gray500, marginTop: spacing.xs },
  cardMeta:   { fontSize: fontSize.xs, color: colors.gray300, marginTop: spacing.sm },
  tapToEditHint: { fontSize: fontSize.xs, color: colors.gray300, marginTop: spacing.xs },
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
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
  imageUploadBtn: {
    height: 120, borderWidth: 1.5, borderColor: colors.gray200, borderStyle: 'dashed',
    borderRadius: borderRadius.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gray50, overflow: 'hidden',
  },
  imagePreview:    { width: '100%', height: '100%' },
  imageUploadTxt:  { fontSize: fontSize.sm, color: colors.gray400, marginTop: spacing.sm },
  removeImageBtn:  { marginTop: spacing.sm, alignSelf: 'flex-end' },
  removeImageTxt:  { fontSize: fontSize.sm, color: colors.red500, fontWeight: '500' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
    backgroundColor: colors.red50, borderRadius: borderRadius.sm, marginTop: spacing.lg,
  },
  deleteBtnTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.red700 },
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
  chipScroll: { marginBottom: spacing.xs },
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