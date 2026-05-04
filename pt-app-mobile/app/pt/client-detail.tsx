import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import LoadingScreen from '@/components/LoadingScreen';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [clientRes, measurementsRes, goalsRes] = await Promise.allSettled([
        API.get(`/clients/${id}`),
        API.get(`/clients/${id}/measurements`),
        API.get(`/clients/${id}/goals`),
      ]);

      if (clientRes.status === 'fulfilled') setClient(clientRes.value.data);
      if (measurementsRes.status === 'fulfilled') setMeasurements(measurementsRes.value.data);
      if (goalsRes.status === 'fulfilled') setGoals(goalsRes.value.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Client Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {client.name?.charAt(0)?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientEmail}>{client.email}</Text>
            </View>
            <Badge
              label={client.status || 'active'}
              variant={client.status === 'active' ? 'active' : 'inactive'}
            />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Age</Text>
              <Text style={styles.statValue}>{client.age || '—'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Sex</Text>
              <Text style={styles.statValue}>{client.sex || '—'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Height</Text>
              <Text style={styles.statValue}>
                {client.height_cm ? `${client.height_cm}cm` : '—'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Weight</Text>
              <Text style={styles.statValue}>
                {client.starting_weight_kg ? `${client.starting_weight_kg}kg` : '—'}
              </Text>
            </View>
          </View>

          {client.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{client.notes}</Text>
            </View>
          )}
        </Card>

        {/* Goals */}
        <Text style={styles.sectionTitle}>Goals</Text>
        {goals.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No goals set yet.</Text>
          </Card>
        ) : (
          goals.map((goal) => (
            <Card key={goal.id} style={styles.goalCard}>
              <View style={styles.goalRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalDesc}>{goal.description}</Text>
                  <Text style={styles.goalMeta}>
                    Target: {goal.target_value} {goal.target_unit}
                    {goal.current_value != null && ` · Current: ${goal.current_value} ${goal.target_unit}`}
                  </Text>
                </View>
                <Badge
                  label={goal.status}
                  variant={goal.status === 'achieved' ? 'active' : 'pending'}
                />
              </View>
            </Card>
          ))
        )}

        {/* Recent Measurements */}
        <Text style={styles.sectionTitle}>Recent Measurements</Text>
        {measurements.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No measurements recorded yet.</Text>
          </Card>
        ) : (
          measurements.slice(0, 5).map((m) => (
            <Card key={m.id} style={styles.measurementCard}>
              <Text style={styles.measurementDate}>
                {new Date(m.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <View style={styles.measurementRow}>
                {m.weight_kg && (
                  <Text style={styles.measurementItem}>Weight: {m.weight_kg}kg</Text>
                )}
                {m.chest_cm && (
                  <Text style={styles.measurementItem}>Chest: {m.chest_cm}cm</Text>
                )}
                {m.waist_cm && (
                  <Text style={styles.measurementItem}>Waist: {m.waist_cm}cm</Text>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl * 2,
  },
  profileCard: {
    marginBottom: spacing.xxl,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.black,
  },
  clientEmail: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.black,
    marginTop: 2,
  },
  notesSection: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
  },
  notesLabel: {
    fontSize: fontSize.xs,
    color: colors.gray400,
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: fontSize.sm,
    color: colors.gray600,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.black,
    marginBottom: spacing.md,
  },
  goalCard: {
    marginBottom: spacing.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalDesc: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.black,
  },
  goalMeta: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: 4,
  },
  measurementCard: {
    marginBottom: spacing.sm,
  },
  measurementDate: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.black,
    marginBottom: spacing.sm,
  },
  measurementRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  measurementItem: {
    fontSize: fontSize.sm,
    color: colors.gray500,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    textAlign: 'center',
  },
});