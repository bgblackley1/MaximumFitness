import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function CalendarScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bookingsRes, clientsRes] = await Promise.allSettled([
        API.get('/bookings'),
        API.get('/clients'),
      ]);
      if (bookingsRes.status === 'fulfilled') setBookings(bookingsRes.value.data);
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

  const getClientName = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const upcoming = bookings
    .filter((b) => new Date(b.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const past = bookings
    .filter((b) => new Date(b.date) < new Date(new Date().toDateString()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.subtitle}>
          {upcoming.length} upcoming session{upcoming.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.sectionLabel}>UPCOMING</Text>
        {upcoming.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>No upcoming bookings.</Text>
          </Card>
        ) : (
          upcoming.map((b) => (
            <Card key={b.id} style={styles.bookingCard}>
              <View style={styles.bookingRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateDay}>
                    {new Date(b.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                  </Text>
                  <Text style={styles.dateNum}>{new Date(b.date).getDate()}</Text>
                  <Text style={styles.dateMonth}>
                    {new Date(b.date).toLocaleDateString('en-GB', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.bookingInfo}>
                  <Text style={styles.clientName}>{getClientName(b.client_id)}</Text>
                  <Text style={styles.timeText}>
                    {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                    {b.type ? ` · ${b.type}` : ''}
                  </Text>
                  {b.location && <Text style={styles.locationText}>{b.location}</Text>}
                </View>
                <Badge
                  label={b.status}
                  variant={b.status === 'confirmed' ? 'active' : b.status === 'pending' ? 'pending' : 'inactive'}
                />
              </View>
            </Card>
          ))
        )}

        {past.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>PAST</Text>
            {past.map((b) => (
              <Card key={b.id} style={[styles.bookingCard, { opacity: 0.5 }]}>
                <View style={styles.bookingRow}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateNum}>{new Date(b.date).getDate()}</Text>
                    <Text style={styles.dateMonth}>
                      {new Date(b.date).toLocaleDateString('en-GB', { month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.clientName}>{getClientName(b.client_id)}</Text>
                    <Text style={styles.timeText}>
                      {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                    </Text>
                  </View>
                  <Badge label={b.status} variant="inactive" />
                </View>
              </Card>
            ))}
          </>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.black,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray400,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  bookingCard: {
    marginBottom: spacing.sm,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCol: {
    alignItems: 'center',
    marginRight: spacing.lg,
    minWidth: 40,
  },
  dateDay: {
    fontSize: fontSize.xs,
    color: colors.gray400,
    textTransform: 'uppercase',
  },
  dateNum: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.black,
  },
  dateMonth: {
    fontSize: fontSize.xs,
    color: colors.gray400,
  },
  bookingInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.black,
  },
  timeText: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: 2,
  },
  locationText: {
    fontSize: fontSize.xs,
    color: colors.gray400,
    marginTop: 2,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    textAlign: 'center',
  },
});