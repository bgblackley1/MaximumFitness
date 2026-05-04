import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

type Tab = 'plans' | 'exercises';

export default function WorkoutsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [plans, setPlans] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, exercisesRes] = await Promise.allSettled([
        API.get('/workout-plans'),
        API.get('/exercises'),
      ]);
      if (plansRes.status === 'fulfilled') setPlans(plansRes.value.data);
      if (exercisesRes.status === 'fulfilled') setExercises(exercisesRes.value.data);
    } catch (err) {
      console.error(err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderPlan = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.goal_focus && (
            <Text style={styles.cardSub}>{item.goal_focus}</Text>
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
  );

  const renderExercise = ({ item }: { item: any }) => (
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
      {item.cues && <Text style={styles.cues} numberOfLines={2}>{item.cues}</Text>}
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
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
              <Text style={styles.emptyText}>No workout plans yet.</Text>
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
              <Text style={styles.emptyText}>No exercises yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.black,
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
  tabActive: {
    backgroundColor: colors.black,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.gray500,
  },
  tabTextActive: {
    color: colors.white,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.black,
  },
  cardSub: {
    fontSize: fontSize.sm,
    color: colors.gray500,
    marginTop: 2,
  },
  cardMeta: {
    fontSize: fontSize.xs,
    color: colors.gray400,
    marginTop: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: colors.gray100,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.gray600,
  },
  cues: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: spacing.sm,
  },
  empty: {
    paddingVertical: spacing.xxxl * 2,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray400,
  },
});