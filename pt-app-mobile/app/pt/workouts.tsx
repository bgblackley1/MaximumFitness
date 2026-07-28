import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, ActivityIndicator,
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
  client_id: string | null;
  goal_focus: string | null;
  start_date: string | null;
  status: string;
  created_at: string;
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
  const [clients,       setClients]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [filter,        setFilter]        = useState<FilterKey>('active');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assignPlan,    setAssignPlan]    = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [filter]);

  /* ── Data ── */
  const loadData = async () => {
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all')  params.status    = filter;
      if (presetClientId)    params.client_id = presetClientId;

      const [plansRes, clientsRes] = await Promise.allSettled([
        API.get('/workout-plans', { params }),
        API.get('/clients'),
      ]);
      if (plansRes.status   === 'fulfilled') setPlans(plansRes.value.data);
      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.data);
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

  /* ── Helpers ── */
  const clientName = (id: string | null) =>
    id ? (clients.find((c) => c.id === id)?.name ?? null) : null;

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  const statusVariant = (s: string): 'active' | 'inactive' | 'pending' =>
    s === 'active' ? 'active' : s === 'archived' ? 'inactive' : 'pending';

  /* ── Actions ── */
  const handleDuplicate = (plan: PlanSummary) => {
    Alert.alert('Duplicate Plan', `Create a copy of "${plan.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate',
        onPress: async () => {
          setActionLoading(plan.id + '_d');
          try {
            await API.post(`/workout-plans/${plan.id}/duplicate`);
            await loadData();
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail ?? 'Failed to duplicate');
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleArchive = (plan: PlanSummary) => {
    Alert.alert(
      'Archive Plan',
      `Archive "${plan.title}"? It will be hidden from clients.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(plan.id + '_a');
            try {
              await API.delete(`/workout-plans/${plan.id}`);
              setPlans((prev) =>
                filter === 'all' || filter === 'archived'
                  ? prev.map((p) => (p.id === plan.id ? { ...p, status: 'archived' } : p))
                  : prev.filter((p) => p.id !== plan.id)
              );
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.detail ?? 'Failed to archive');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  /* ── Render Plan Card ── */
  const renderPlan = ({ item: plan }: { item: PlanSummary }) => {
    const busy       = !!actionLoading?.startsWith(plan.id);
    const assigned   = clientName(plan.client_id);

    return (
      <Card style={styles.planCard}>
        {/* Header — tap to edit */}
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

            {assigned ? (
              <View style={styles.assignedRow}>
                <Ionicons name="person-outline" size={12} color={colors.gray500} />
                <Text style={styles.assignedTxt}>{assigned}</Text>
              </View>
            ) : (
              <Text style={styles.unassignedTxt}>No client assigned</Text>
            )}

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

        {/* Actions */}
        {busy ? (
          <ActivityIndicator color={colors.black} style={{ padding: spacing.md }} />
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionChip}
              onPress={() => router.push(`/pt/workout-detail?id=${plan.id}` as any)}
            >
              <Ionicons name="create-outline" size={14} color={colors.gray600} />
              <Text style={styles.actionChipTxt}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionChip, styles.actionChipHighlight]}
              onPress={() => setAssignPlan({ id: plan.id, title: plan.title })}
            >
              <Ionicons name="people-outline" size={14} color={colors.black} />
              <Text style={[styles.actionChipTxt, { color: colors.black }]}>Assign</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionChip}
              onPress={() => handleDuplicate(plan)}
            >
              <Ionicons name="copy-outline" size={14} color={colors.gray600} />
              <Text style={styles.actionChipTxt}>Duplicate</Text>
            </TouchableOpacity>

            {plan.status !== 'archived' && (
              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipDanger]}
                onPress={() => handleArchive(plan)}
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

  /* ── Screen ── */
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
            <Text
              style={[
                styles.filterChipTxt,
                filter === f.key && styles.filterChipTxtActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={plans}
          renderItem={renderPlan}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="barbell-outline" size={56} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No workout plans</Text>
              <Text style={styles.emptyText}>
                {filter !== 'all'
                  ? `No ${filter} plans found. Try a different filter.`
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

      {/* Assign to multiple clients */}
      <AssignPlanModal
        visible={!!assignPlan}
        planId={assignPlan?.id ?? ''}
        planTitle={assignPlan?.title ?? ''}
        onClose={() => setAssignPlan(null)}
        onSuccess={(count) => {
          const title = assignPlan?.title ?? 'Plan';
          setAssignPlan(null);
          Alert.alert(
            'Assigned!',
            `"${title}" has been assigned to ${count} client${count !== 1 ? 's' : ''}.`
          );
          loadData();
        }}
      />
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
  title:    { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: borderRadius.full,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  filterChipActive:    { backgroundColor: colors.black, borderColor: colors.black },
  filterChipTxt:       { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500 },
  filterChipTxtActive: { color: colors.white },

  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  planCard:   { marginBottom: spacing.sm, padding: 0, overflow: 'hidden' },
  planHeader: { flexDirection: 'row', padding: spacing.lg },
  planMetaRight: { alignItems: 'flex-end' },

  planTitle:    { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  planGoal:     { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  assignedRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  assignedTxt:  { fontSize: fontSize.xs, color: colors.gray500, fontWeight: '500' },
  unassignedTxt:{ fontSize: fontSize.xs, color: colors.gray300, marginTop: spacing.xs, fontStyle: 'italic' },
  planMeta:     { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs },

  divider: { height: 1, backgroundColor: colors.gray100 },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  actionChipHighlight: {
    backgroundColor: colors.black,
  },
  actionChipDanger:  { backgroundColor: colors.red50 },
  actionChipTxt:     { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray600 },

  empty: {
    alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm,
  },
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
});