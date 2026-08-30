import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import AssignPlanModal from '@/components/AssignPlanModal';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

type Workout = {
  id: string;
  title: string;
  focus: string | null;
  visibility: string;
  status: string;
  created_at: string;
  exercise_count: number;
  assigned_clients: { id: string; name: string }[];
};

type FilterKey = 'active' | 'all' | 'archived';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'active',   label: 'Active'   },
  { key: 'all',      label: 'All'      },
  { key: 'archived', label: 'Archived' },
];

const FOCUS_COLORS: Record<string, string> = {
  arms:      '#E0F2FE',
  legs:      '#D1FAE5',
  push:      '#FEF3C7',
  pull:      '#FCE7F3',
  back:      '#EDE9FE',
  chest:     '#FEE2E2',
  core:      '#ECFDF5',
  full_body: '#F0FDF4',
  cardio:    '#FFF7ED',
};

const FOCUS_TEXT: Record<string, string> = {
  arms:      '#0369A1',
  legs:      '#065F46',
  push:      '#92400E',
  pull:      '#9D174D',
  back:      '#5B21B6',
  chest:     '#991B1B',
  core:      '#065F46',
  full_body: '#14532D',
  cardio:    '#C2410C',
};

const focusLabel = (f: string | null) =>
  f ? f.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null;

export default function WorkoutsScreen() {
  const router = useRouter();
  const { client_id: presetClientId } = useLocalSearchParams<{ client_id?: string }>();

  const [workouts,     setWorkouts]     = useState<Workout[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [filter,       setFilter]       = useState<FilterKey>('active');
  const [archivePlan,  setArchivePlan]  = useState<Workout | null>(null);
  const [dupPlan,      setDupPlan]      = useState<Workout | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ id: string; title: string } | null>(null);
  const [actionBusy,   setActionBusy]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all')  params.status    = filter;
      if (presetClientId)    params.client_id = presetClientId;
      const res = await API.get('/workout-plans', { params });
      setWorkouts(res.data);
    } catch (e) {
      console.error('workouts loadData:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const doArchive = async () => {
    if (!archivePlan) return;
    setActionBusy(archivePlan.id);
    try {
      await API.delete(`/workout-plans/${archivePlan.id}`);
      setWorkouts((prev) =>
        filter === 'all' || filter === 'archived'
          ? prev.map((w) => w.id === archivePlan.id ? { ...w, status: 'archived' } : w)
          : prev.filter((w) => w.id !== archivePlan.id)
      );
    } catch (e) { console.error(e); }
    finally { setActionBusy(null); setArchivePlan(null); }
  };

  const doDuplicate = async () => {
    if (!dupPlan) return;
    setActionBusy(dupPlan.id + '_d');
    try {
      await API.post(`/workout-plans/${dupPlan.id}/duplicate`);
      await loadData();
    } catch (e) { console.error(e); }
    finally { setActionBusy(null); setDupPlan(null); }
  };

  const renderItem = ({ item: w }: { item: Workout }) => {
    const busy           = !!actionBusy?.startsWith(w.id);
    const assignedNames  = w.assigned_clients?.map((c) => c.name) ?? [];
    const assignedLabel  =
      assignedNames.length === 0    ? 'Not assigned'
      : assignedNames.length <= 2   ? assignedNames.join(', ')
      : `${assignedNames.slice(0, 2).join(', ')} +${assignedNames.length - 2}`;

    const focusBg   = w.focus ? FOCUS_COLORS[w.focus] ?? colors.gray100 : colors.gray100;
    const focusFg   = w.focus ? FOCUS_TEXT[w.focus]   ?? colors.gray700 : colors.gray500;
    const focusTxt  = focusLabel(w.focus);

    return (
      <Card style={styles.card}>
        {/* Tap card to edit */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => router.push(`/pt/workout-detail?id=${w.id}` as any)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle}>{w.title}</Text>
              {focusTxt && (
                <View style={[styles.focusBadge, { backgroundColor: focusBg }]}>
                  <Text style={[styles.focusBadgeTxt, { color: focusFg }]}>{focusTxt}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardMeta}>
              {w.exercise_count} exercise{w.exercise_count !== 1 ? 's' : ''}
            </Text>
            <View style={styles.assignedRow}>
              <Ionicons
                name="people-outline"
                size={12}
                color={assignedNames.length > 0 ? colors.black : colors.gray300}
              />
              <Text style={[
                styles.assignedTxt,
                assignedNames.length === 0 && { color: colors.gray300, fontStyle: 'italic' },
              ]}>
                {assignedLabel}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Badge
              label={w.status}
              variant={w.status === 'active' ? 'active' : w.status === 'archived' ? 'inactive' : 'pending'}
            />
            <Ionicons name="chevron-forward" size={16} color={colors.gray300} style={{ marginTop: spacing.sm }} />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Actions */}
        {busy ? (
          <ActivityIndicator color={colors.black} style={{ padding: spacing.md }} />
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => router.push(`/pt/workout-detail?id=${w.id}` as any)}
            >
              <Ionicons name="create-outline" size={14} color={colors.gray600} />
              <Text style={styles.chipTxt}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, styles.chipAssign]}
              onPress={() => setAssignTarget({ id: w.id, title: w.title })}
            >
              <Ionicons name="people-outline" size={14} color={colors.white} />
              <Text style={[styles.chipTxt, { color: colors.white }]}>Assign</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.chip} onPress={() => setDupPlan(w)}>
              <Ionicons name="copy-outline" size={14} color={colors.gray600} />
              <Text style={styles.chipTxt}>Duplicate</Text>
            </TouchableOpacity>

            {w.status !== 'archived' && (
              <TouchableOpacity style={[styles.chip, styles.chipDanger]} onPress={() => setArchivePlan(w)}>
                <Ionicons name="archive-outline" size={14} color={colors.red700} />
                <Text style={[styles.chipTxt, { color: colors.red700 }]}>Archive</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Workouts</Text>
          <Text style={styles.subtitle}>
            {workouts.length} workout{workouts.length !== 1 ? 's' : ''}
            {presetClientId ? ' for this client' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/pt/workout-detail' as any)}
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipTxt, filter === f.key && styles.filterChipTxtActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={workouts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="barbell-outline" size={56} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No workouts yet</Text>
              <Text style={styles.emptyText}>
                {filter === 'active' ? 'No active workouts. Tap + to create one.' : `No ${filter} workouts.`}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/pt/workout-detail' as any)}
              >
                <Ionicons name="add" size={16} color={colors.white} />
                <Text style={styles.emptyBtnTxt}>Create Workout</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Assign Modal */}
      <AssignPlanModal
        visible={!!assignTarget}
        planId={assignTarget?.id ?? ''}
        planTitle={assignTarget?.title ?? ''}
        onClose={() => setAssignTarget(null)}
        onSuccess={(_, assignedClients) => {
          if (assignTarget) {
            setWorkouts((prev) =>
              prev.map((w) =>
                w.id === assignTarget.id ? { ...w, assigned_clients: assignedClients } : w
              )
            );
          }
          setAssignTarget(null);
        }}
      />

      {/* Archive Modal */}
      <Modal visible={!!archivePlan} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="archive-outline" size={32} color={colors.red500} style={{ marginBottom: spacing.md }} />
            <Text style={styles.confirmTitle}>Archive Workout?</Text>
            <Text style={styles.confirmMsg}>
              "{archivePlan?.title}" will be hidden from clients but not deleted.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setArchivePlan(null)}>
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDo} onPress={doArchive}>
                <Text style={styles.confirmDoTxt}>Archive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Duplicate Modal */}
      <Modal visible={!!dupPlan} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="copy-outline" size={32} color={colors.black} style={{ marginBottom: spacing.md }} />
            <Text style={styles.confirmTitle}>Duplicate Workout?</Text>
            <Text style={styles.confirmMsg}>
              A draft copy of "{dupPlan?.title}" will be created with no clients assigned.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDupPlan(null)}>
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDo, { backgroundColor: colors.black }]} onPress={doDuplicate}>
                <Text style={styles.confirmDoTxt}>Duplicate</Text>
              </TouchableOpacity>
            </View>
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
  title:    { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: borderRadius.full,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: spacing.xl,
    gap: spacing.sm, marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, borderWidth: 1.5,
    borderColor: colors.gray200, backgroundColor: colors.white,
  },
  filterChipActive:    { backgroundColor: colors.black, borderColor: colors.black },
  filterChipTxt:       { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500 },
  filterChipTxtActive: { color: colors.white },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  card:    { marginBottom: spacing.sm, padding: 0, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', padding: spacing.lg },
  cardRight:  { alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  focusBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  focusBadgeTxt: { fontSize: fontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
  cardMeta: { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.xs },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  assignedTxt: { fontSize: fontSize.xs, fontWeight: '500', color: colors.black, flex: 1 },
  divider:     { height: 1, backgroundColor: colors.gray100 },
  actionRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
  },
  chipAssign:  { backgroundColor: colors.black },
  chipDanger:  { backgroundColor: colors.red50 },
  chipTxt:     { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray600 },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.black, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md, borderRadius: borderRadius.sm, marginTop: spacing.md,
  },
  emptyBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  confirmBox: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.xxl, width: '80%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  confirmTitle:     { fontSize: fontSize.lg, fontWeight: '700', color: colors.black, marginBottom: spacing.sm },
  confirmMsg:       { fontSize: fontSize.sm, color: colors.gray600, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  confirmBtns:      { flexDirection: 'row', gap: spacing.md, width: '100%' },
  confirmCancel:    { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm, borderWidth: 1.5, borderColor: colors.gray200, alignItems: 'center' },
  confirmCancelTxt: { fontSize: fontSize.md, fontWeight: '500', color: colors.gray700 },
  confirmDo:        { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm, backgroundColor: colors.red500, alignItems: 'center' },
  confirmDoTxt:     { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});