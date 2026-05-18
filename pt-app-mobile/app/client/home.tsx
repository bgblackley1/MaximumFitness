import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';
import Card from '@/components/Card';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function ClientHomeScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const tiles = [
    { icon: 'trending-up-outline' as const, label: 'Progress', route: '/client/progress' },
    { icon: 'barbell-outline' as const, label: 'Workouts', route: '/client/my-workouts' },
    { icon: 'calendar-outline' as const, label: 'Book Session', route: '/client/book' },
    { icon: 'person-outline' as const, label: 'Account', route: '/client/account' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.greeting}>Hello, {user?.name || 'there'}</Text>
        <Text style={styles.subtitle}>Let's keep making progress.</Text>

        <Card style={styles.nextSession}>
          <Text style={styles.nextLabel}>Next Session</Text>
          <Text style={styles.nextPlaceholder}>No upcoming session booked.</Text>
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => router.push('/client/book')}
          >
            <Text style={styles.bookBtnText}>Book a session</Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.tilesGrid}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.label}
              style={styles.tile}
              onPress={() => router.push(tile.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={tile.icon} size={24} color={colors.black} />
              <Text style={styles.tileLabel}>{tile.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  scroll: {
    padding: spacing.xl,
  },
  greeting: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.black,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    marginTop: spacing.xs,
    marginBottom: spacing.xxl,
  },
  nextSession: {
    marginBottom: spacing.xxl,
  },
  nextLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  nextPlaceholder: {
    fontSize: fontSize.md,
    color: colors.gray500,
    marginBottom: spacing.lg,
  },
  bookBtn: {
    backgroundColor: colors.black,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bookBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  tile: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: spacing.sm,
    aspectRatio: 1.3,
  },
  tileLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.gray700,
  },
});