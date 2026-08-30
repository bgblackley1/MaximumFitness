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

type PlanSummary = {
  id: string;
  title: string;
  goal_focus: string | null;
  start_date: string | null;
  status: string;
  visibility: string;
  created_at: string;
  assigned_clients: { id: string; name: string }[];
};

type FilterKey = 'all' | 'active' | 'draft' | 'archived';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'active',   label: 'Active'   },
  { key: 'draft',    label: 'Draft'    },
  { key: 'archived', label: 'Archived' },
];

export default function WorkoutsScreen() {
  const router = useRouter();
  const { client_id: presetClientId } = useLocalSearchParams<{ client_id?: string }>();

  const [plans,         setPlans]         = useState<PlanSummary[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState<FilterKey>('active');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Assign modal
  const [assignPlan,  setAssignPlan]  = useState<{ id: string; title: string } | null>(null);

  // Inline archive confirmation modal
  const [archiveTarget, setArchiveTarget] = useState<PlanSummary | null>(null);

  // Inline duplicate confirmation modal
  const [dupTarget, setDupTarget] = useState<PlanSummary | null>(null);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status    = filter;
      if (presetClientId)   params.client_id = presetClientId;

      const res = await API.get('/workout-plans', { params });
      setPlans(res.data);
    } catch (err) {
      console.error('workouts loadData:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const statusVariant = (s: string): 'active' | 'inactive' | 'pending' =>
    s === 'active' ? 'active' : s === 'archived' ? 'inactive' : 'pending';

  // ── Archive ──────────────────────────────────────────────────────────────
  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(archiveTarget.id + '_a');
    try {
      await API.delete(`/workout-plans/${archiveTarget.id}`);
      setPlans((prev) =>
        filter === 'all' || filter === 'archived'
          ? prev.map((p) => p.id === archiveTarget.id ? { ...p, status: 'archived' } : p)
          : prev.filter((p) => p.id !== archiveTarget.id)
      );
    } catch (err: any) {
      console.error('archive error:', err);
    } finally {
      setActionLoading(null);
      setArchiveTarget(null);
    }
  };

  // ── Duplicate ────────────────────────────────────────────────────────────
  const confirmDuplicate = async () => {
    if (!dupTarget) return;
    setActionLoading(dupTarget.id + '_d');
    try {
      await API.post(`/workout-plans/${dupTarget.id}/duplicate`);
      await loadData();
    } catch (err: any) {
      console.error('duplicate error:', err);
    } finally {
      setActionLoading(null);
      setDupTarget(null);
    }
  };

  // ── Render plan card ─────────────────────────────────────────────────────
  const renderPlan = ({ item: plan }: { item: PlanSummary }) => {
    const busy = !!actionLoading?.startsWith(plan.id);

    const assignedNames = plan.assigned_clients?.map((c) => c.name) ?? [];
    const assignedLabel =
      assignedNames.length === 0       ? 'No clients assigned'
      : assignedNames.length <= 2      ? assignedNames.join(', ')
      : `${assignedNames.slice(0, 2).join(', ')} +${assignedNames.length - 2} more`;

    return (
      <Card style={styles.planCard}>
        {/* Header — tap to open detail */}
        <TouchableOpacity
          style={styles.planHeader}
          onPress={() => router.push(`/pt/workout-detail?id=${plan.id}` as any)}
          activeOpacity={0.75}
        >
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={styles.planTitle}>{plan.title}</Text>

            {plan.goal_focus ? (
              <Text style={styles.planGoal}>{plan.goal_focus}</Text>
            ) : null}

            <View style={styles.assignedRow}>
              <Ionicons
                name="people-outline"
                size={12}
                color={assignedNames.length > 0 ? colors.black : colors.gray300}
              />
              <Text style={[
                styles.assignedTxt,
                assignedNames.length === 0 && styles.unassignedTxt,
              ]}>
                {assignedLabel}
              </Text>
            </View>

            <Text style={styles.planMeta}>Created {fmtDate(plan.created_at)}</Text>
          </View>

          <View style={styles.planMetaRight}>
            <Badge label={plan.status} variant={statusVariant(plan.status)} />
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.gray300}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Action chips */}
        {busy ? (
          <ActivityIndicator color={colors.black} style={{ padding: spacing.md }} />
        ) : (
          <View style={styles.actionRow}>
            {/* Edit */}
            <TouchableOpacity
              style={styles.actionChip}
              onPress={() => router.push(`/pt/workout-detail?id=${plan.id}` as any)}
            >
              <Ionicons name="create-outline" size={14} color={colors.gray600} />
              <Text style={styles.actionChipTxt}>Edit</Text>
            </TouchableOpacity>

            {/* Assign — white text + icon on black bg */}
            <TouchableOpacity
              style={[styles.actionChip, styles.actionChipAssign]}
              onPress={() => setAssignPlan({ id: plan.id, title: plan.title })}
            >
              <Ionicons name="people-outline" size={14} color={colors.white} />
              <Text style={[styles.actionChipTxt, styles.actionChipAssignTxt]}>Assign</Text>
            </TouchableOpacity>

            {/* Duplicate */}
            <TouchableOpacity
              style={styles.actionChip}
              onPress={() => setDupTarget(plan)}
            >
              <Ionicons name="copy-outline" size={14} color={colors.gray600} />
              <Text style={styles.actionChipTxt}>Duplicate</Text>
            </TouchableOpacity>

            {/* Archive */}
            {plan.status !== 'archived' && (
              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipDanger]}
                onPress={() => setArchiveTarget(plan)}
              >
                <Ionicons name="archive-outline" size={14} color={colors.red700} />
                <Text style={[styles.actionChipTxt, { color: colors.red700 }]}>Archive</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Workout Plans</Text>
          <Text style={styles.subtitle}>
            {plans.length} plan{plans.length !== 1 ? 's' : ''}
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

      {/* Filter row */}
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
          data={plans}
          renderItem={renderPlan}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="barbell-outline" size={56} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No workout plans</Text>
              <Text style={styles.emptyText}>
                {filter !== 'all'
                  ? `No ${filter} plans. Try a different filter.`
                  : 'Tap + to create your first plan.'}
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/pt/workout-detail' as any)}
              >
                <Ionicons name="add" size={16} color={colors.white} />
                <Text style={styles.emptyBtnTxt}>Create Plan</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── Assign Modal ── */}
      <AssignPlanModal
        visible={!!assignPlan}
        planId={assignPlan?.id ?? ''}
        planTitle={assignPlan?.title ?? ''}
        onClose={() => setAssignPlan(null)}
        onSuccess={(count, assignedClients) => {
          setAssignPlan(null);
          // Update local plan card without refetch
          if (assignPlan) {
            setPlans((prev) =>
              prev.map((p) =>
                p.id === assignPlan.id ? { ...p, assigned_clients: assignedClients } : p
              )
            );
          }
        }}
      />

      {/* ── Archive Confirmation Modal ── */}
      <Modal visible={!!archiveTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="archive-outline" size={32} color={colors.red500} style={{ marginBottom: spacing.md }} />
            <Text style={styles.confirmTitle}>Archive Plan?</Text>
            <Text style={styles.confirmMsg}>
              "{archiveTarget?.title}" will be hidden from clients but not deleted.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setArchiveTarget(null)}
              >
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDo} onPress={confirmArchive}>
                <Text style={styles.confirmDoTxt}>Archive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Duplicate Confirmation Modal ── */}
      <Modal visible={!!dupTarget} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="copy-outline" size={32} color={colors.black} style={{ marginBottom: spacing.md }} />
            <Text style={styles.confirmTitle}>Duplicate Plan?</Text>
            <Text style={styles.confirmMsg}>
              A draft copy of "{dupTarget?.title}" will be created with no clients assigned.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setDupTarget(null)}
              >
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDo, { backgroundColor: colors.black }]} onPress={confirmDuplicate}>
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
    gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap',
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

  planCard:    { marginBottom: spacing.sm, padding: 0, overflow: 'hidden' },
  planHeader:  { flexDirection: 'row', padding: spacing.lg },
  planMetaRight: { alignItems: 'flex-end' },

  planTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  planGoal:  { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  assignedRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.xs, marginTop: spacing.sm,
  },
  assignedTxt:   { fontSize: fontSize.xs, color: colors.black, fontWeight: '500', flex: 1 },
  unassignedTxt: { color: colors.gray300, fontStyle: 'italic' },
  planMeta:      { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },

  divider: { height: 1, backgroundColor: colors.gray100 },

  actionRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: spacing.sm, padding: spacing.md,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  // ← Fixed: white text/icon on black background
  actionChipAssign: { backgroundColor: colors.black },
  actionChipAssignTxt: { color: colors.white },
  actionChipDanger: { backgroundColor: colors.red50 },
  actionChipTxt:    { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray600 },

  empty: { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText: {
    fontSize: fontSize.sm, color: colors.gray400,
    textAlign: 'center', paddingHorizontal: spacing.xl,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.black, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md, borderRadius: borderRadius.sm, marginTop: spacing.md,
  },
  emptyBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },

  // Inline confirmation modal (replaces Alert.alert — fixes aria-hidden)
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBox: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.xxl, width: '80%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  confirmTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black, marginBottom: spacing.sm },
  confirmMsg: {
    fontSize: fontSize.sm, color: colors.gray600,
    textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl,
  },
  confirmBtns:      { flexDirection: 'row', gap: spacing.md, width: '100%' },
  confirmCancel: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray200, alignItems: 'center',
  },
  confirmCancelTxt: { fontSize: fontSize.md, fontWeight: '500', color: colors.gray700 },
  confirmDo: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    backgroundColor: colors.red500, alignItems: 'center',
  },
  confirmDoTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});