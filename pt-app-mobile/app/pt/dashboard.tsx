import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function DashboardScreen() {
  const { user, profile } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState({ clients: 0, upcomingBookings: 0, activePackages: 0 });
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  // ← Store clients so we can look up names in the booking cards
  const [clients, setClients] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [clientsRes, bookingsRes, packsRes] = await Promise.allSettled([
        API.get('/clients'),
        API.get('/bookings'),
        API.get('/payments/session-packs'),
      ]);

      const clientsList = clientsRes.status === 'fulfilled' ? clientsRes.value.data : [];
      const bookings    = bookingsRes.status === 'fulfilled' ? bookingsRes.value.data : [];
      const packs       = packsRes.status === 'fulfilled'   ? packsRes.value.data   : [];

      // ← Store clients list in state
      setClients(clientsList);

      setStats({
        clients:         clientsList.filter((c: any) => c.status === 'active').length,
        upcomingBookings: bookings.filter((b: any) =>
          new Date(b.date) >= new Date(new Date().toDateString()) &&
          (b.status === 'booked' || b.status === 'confirmed')
        ).length,
        activePackages: packs.filter((p: any) => p.status === 'active').length,
      });

      setUpcomingBookings(
        bookings
          .filter((b: any) => new Date(b.date) >= new Date(new Date().toDateString()))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 5)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Look up client name from the stored clients list using client_id
  const getClientName = (clientId: string): string => {
    const found = clients.find((c: any) => c.id === clientId);
    return found?.name ?? 'Unknown Client';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Welcome back
              {profile?.full_name
                ? `, ${profile.full_name}`
                : user?.email
                ? `, ${user.email.split('@')[0]}`
                : ''}
            </Text>
            <Text style={styles.subtitle}>Here's what's happening today.</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={20} color={colors.gray500} />
            <Text style={styles.statValue}>{stats.clients}</Text>
            <Text style={styles.statLabel}>Active{'\n'}Clients</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={20} color={colors.gray500} />
            <Text style={styles.statValue}>{stats.upcomingBookings}</Text>
            <Text style={styles.statLabel}>Upcoming{'\n'}Sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={20} color={colors.gray500} />
            <Text style={styles.statValue}>{stats.activePackages}</Text>
            <Text style={styles.statLabel}>Active{'\n'}Packages</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/pt/add-client')}
          >
            <Ionicons name="person-add-outline" size={20} color={colors.black} />
            <Text style={styles.actionText}>Add Client</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/pt/calendar')}
          >
            <Ionicons name="time-outline" size={20} color={colors.black} />
            <Text style={styles.actionText}>Set Slots</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/pt/workouts')}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.black} />
            <Text style={styles.actionText}>New Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Sessions */}
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
        {upcomingBookings.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No upcoming sessions.</Text>
          </Card>
        ) : (
          upcomingBookings.map((booking) => (
            <Card key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingRow}>
                {/* Date block */}
                <View style={styles.bookingDate}>
                  <Text style={styles.bookingDay}>
                    {new Date(booking.date).getDate()}
                  </Text>
                  <Text style={styles.bookingMonth}>
                    {new Date(booking.date).toLocaleDateString('en-GB', { month: 'short' })}
                  </Text>
                </View>

                {/* Client name + time */}
                <View style={styles.bookingInfo}>
                  {/* ← Client full name instead of session type */}
                  <Text style={styles.bookingClientName}>
                    {getClientName(booking.client_id)}
                  </Text>
                  <Text style={styles.bookingTime}>
                    {booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}
                  </Text>
                </View>

                <Badge
                  label={booking.status}
                  variant={booking.status === 'booked' ? 'active' : 'pending'}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.gray50 },
  scroll:      { padding: spacing.xl },
  header:      { marginBottom: spacing.xxl },
  greeting:    { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle:    { fontSize: fontSize.sm, color: colors.gray400, marginTop: spacing.xs },
  statsRow:    { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
  statCard:    {
    flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.md,
    padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.gray200,
  },
  statValue:   { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black, marginTop: spacing.sm },
  statLabel:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs, textAlign: 'center' },
  sectionTitle:{ fontSize: fontSize.lg, fontWeight: '600', color: colors.black, marginBottom: spacing.md },
  actionsRow:  { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
  actionBtn:   {
    flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.sm,
    padding: spacing.lg, alignItems: 'center', borderWidth: 1,
    borderColor: colors.gray200, gap: spacing.sm,
  },
  actionText:  { fontSize: fontSize.xs, fontWeight: '500', color: colors.gray700 },
  bookingCard: { marginBottom: spacing.sm },
  bookingRow:  { flexDirection: 'row', alignItems: 'center' },
  bookingDate: { alignItems: 'center', marginRight: spacing.lg, minWidth: 40 },
  bookingDay:  { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  bookingMonth:{ fontSize: fontSize.xs, color: colors.gray400, textTransform: 'uppercase' },
  bookingInfo: { flex: 1 },
  // ← Was bookingType — now shows client name prominently
  bookingClientName: { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  bookingTime: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  emptyText:   { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
});