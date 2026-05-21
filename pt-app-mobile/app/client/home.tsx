import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import API from '@/services/api';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function ClientHomeScreen() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [nextBooking, setNextBooking] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await API.get(`/bookings?from_date=${today}`);
      const upcoming = (res.data as any[])
        .filter((b) => b.status === 'booked' || b.status === 'confirmed')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setNextBooking(upcoming[0] ?? null);
    } catch (err) {
      console.error('home loadData:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const fmt12 = (t: string) => {
    const [h] = t.split(':').map(Number);
    return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const tiles = [
    { icon: 'trending-up-outline' as const, label: 'Progress',     route: '/client/progress'    },
    { icon: 'barbell-outline'      as const, label: 'My Workouts', route: '/client/my-workouts' },
    { icon: 'calendar-outline'     as const, label: 'Book',        route: '/client/book'         },
    { icon: 'person-outline'       as const, label: 'Account',     route: '/client/account'      },
  ];

  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'there';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting */}
        <Text style={styles.greeting}>Hello, {displayName} 👋</Text>
        <Text style={styles.subtitle}>Keep making progress.</Text>

        {/* Next session */}
        <Card style={styles.sessionCard}>
          <Text style={styles.sectionMeta}>NEXT SESSION</Text>
          {nextBooking ? (
            <>
              <Text style={styles.sessionDate}>
                {new Date(nextBooking.date).toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              </Text>
              <Text style={styles.sessionTime}>
                {fmt12(nextBooking.start_time)} – {fmt12(nextBooking.end_time)}
                {nextBooking.type ? `  ·  ${nextBooking.type}` : ''}
              </Text>
              {nextBooking.location ? (
                <View style={styles.row}>
                  <Ionicons name="location-outline" size={13} color={colors.gray500} />
                  <Text style={styles.locationTxt}>{nextBooking.location}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.noSession}>No upcoming sessions booked.</Text>
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => router.push('/client/book')}
              >
                <Text style={styles.bookBtnTxt}>Book a session →</Text>
              </TouchableOpacity>
            </>
          )}
        </Card>

        {/* Quick action tiles */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {tiles.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={styles.tile}
              onPress={() => router.push(t.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={t.icon} size={26} color={colors.black} />
              <Text style={styles.tileLabel}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  greeting: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: spacing.xs, marginBottom: spacing.xxl },
  sessionCard: { marginBottom: spacing.xxl },
  sectionMeta: {
    fontSize: fontSize.xs, fontWeight: '600', color: colors.gray400,
    letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  sessionDate: { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  sessionTime: { fontSize: fontSize.md, color: colors.gray600, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  locationTxt: { fontSize: fontSize.sm, color: colors.gray500 },
  noSession: { fontSize: fontSize.md, color: colors.gray500, marginBottom: spacing.lg },
  bookBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  bookBtnTxt: { color: colors.white, fontWeight: '600', fontSize: fontSize.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.black, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47%', backgroundColor: colors.white, borderRadius: borderRadius.md,
    padding: spacing.xl, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.gray200, gap: spacing.sm, aspectRatio: 1.3,
  },
  tileLabel: { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray700 },
});