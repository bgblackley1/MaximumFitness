// pt-app-mobile/app/pt/calendar.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

// ─── Types & constants ────────────────────────────────────────────────────────

type MainTab  = 'schedule' | 'availability';
type AvailTab = 'weekly'   | 'one-off';

/**
 * one-off slot state for a given (date, hour):
 *   recurring  – covered by a weekly recurring slot (not modified)
 *   blocked    – recurring slot blocked for this specific date
 *   extra      – non-recurring one-off slot (added for this date only)
 *   off        – no availability at all
 */
type SlotState = 'recurring' | 'blocked' | 'extra' | 'off';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const HOURS     = Array.from({ length: 12 }, (_, i) => i + 9); // 9 → 20

const DATES_60 = Array.from({ length: 60 }, (_, i) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + i);
  return d;
});

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

const fmtSlot = (h: number) => {
  const f = (x: number) => `${x % 12 || 12}:00 ${x >= 12 ? 'PM' : 'AM'}`;
  return `${f(h)} – ${f(h + 1)}`;
};

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Accepts both "HH:MM" and "HH:MM:SS" from the API */
const matchHour = (t: string, h: number) => t.startsWith(`${pad(h)}:00`);

/**
 * JavaScript getDay(): 0=Sun, 1=Mon … 6=Sat
 * Backend day_of_week: 0=Mon … 6=Sun
 */
const jsToBackendDow = (d: Date): number => {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const [mainTab,  setMainTab]  = useState<MainTab>('schedule');
  const [availTab, setAvailTab] = useState<AvailTab>('weekly');

  const [bookings,     setBookings]     = useState<any[]>([]);
  const [clients,      setClients]      = useState<any[]>([]);
  const [availability, setAvailability] = useState<any[]>([]);
  const [refreshing,   setRefreshing]   = useState(false);

  // Only one cell can be mid-save at a time
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [selectedDay,  setSelectedDay]  = useState(0);               // weekly tab
  const [selectedDate, setSelectedDate] = useState<Date>(DATES_60[0]); // one-off tab

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [bR, cR, aR] = await Promise.allSettled([
        API.get('/bookings'),
        API.get('/clients'),
        API.get('/availability'),
      ]);
      if (bR.status === 'fulfilled') setBookings(bR.value.data);
      if (cR.status === 'fulfilled') setClients(cR.value.data);
      if (aR.status === 'fulfilled') setAvailability(aR.value.data);
    } catch (e) { console.error(e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Schedule ──────────────────────────────────────────────────────────────

  const getName = (id: string) => clients.find(c => c.id === id)?.name ?? 'Unknown';
  const todayMs = new Date(new Date().toDateString()).getTime();

  const upcoming = bookings
    .filter(b => new Date(b.date).getTime() >= todayMs)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const past = bookings
    .filter(b => new Date(b.date).getTime() < todayMs)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // ── Availability slices ───────────────────────────────────────────────────

  const recurringSlots = availability.filter(s =>  s.is_recurring);
  const extraSlots     = availability.filter(s => !s.is_recurring && !s.is_blocked);
  const blockedSlots   = availability.filter(s => !s.is_recurring &&  s.is_blocked);

  // ── Weekly helpers ────────────────────────────────────────────────────────

  const isRecActive = (di: number, h: number) =>
    recurringSlots.some(s =>
      s.day_of_week === di && matchHour(s.start_time, h) && matchHour(s.end_time, h + 1)
    );

  const recCountForDay = (di: number) =>
    recurringSlots.filter(s => s.day_of_week === di).length;

  const toggleRec = async (di: number, h: number) => {
    const key = `rec-${di}-${h}`;
    if (savingKey) return;
    setSavingKey(key);
    try {
      if (isRecActive(di, h)) {
        const id = recurringSlots.find(s =>
          s.day_of_week === di && matchHour(s.start_time, h) && matchHour(s.end_time, h + 1)
        )?.id;
        await API.delete(`/availability/${id}`);
        setAvailability(prev => prev.filter(s => s.id !== id));
      } else {
        const { data } = await API.post('/availability', {
          day_of_week:   di,
          start_time:    `${pad(h)}:00:00`,
          end_time:      `${pad(h + 1)}:00:00`,
          is_recurring:  true,
          is_blocked:    false,
          specific_date: null,
        });
        setAvailability(prev => [...prev, data]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update slot');
    } finally {
      setSavingKey(null);
    }
  };

  // ── One-off helpers ───────────────────────────────────────────────────────

  const getSlotState = (d: Date, h: number): SlotState => {
    const ds  = toDateStr(d);
    const dow = jsToBackendDow(d);

    const hasRecurring = recurringSlots.some(s =>
      s.day_of_week === dow && matchHour(s.start_time, h) && matchHour(s.end_time, h + 1)
    );
    const isBlocked = blockedSlots.some(s =>
      s.specific_date === ds && matchHour(s.start_time, h) && matchHour(s.end_time, h + 1)
    );
    const isExtra = extraSlots.some(s =>
      s.specific_date === ds && matchHour(s.start_time, h) && matchHour(s.end_time, h + 1)
    );

    if (hasRecurring && isBlocked) return 'blocked';
    if (hasRecurring)              return 'recurring';
    if (isExtra)                   return 'extra';
    return 'off';
  };

  const findOneOffId = (d: Date, h: number, blocked: boolean) => {
    const ds = toDateStr(d);
    return availability.find(s =>
      !s.is_recurring &&
      !!s.is_blocked === blocked &&
      s.specific_date === ds &&
      matchHour(s.start_time, h) &&
      matchHour(s.end_time, h + 1)
    )?.id;
  };

  const toggleOneOff = async (d: Date, h: number) => {
    const key   = `off-${toDateStr(d)}-${h}`;
    const state = getSlotState(d, h);
    if (savingKey) return;
    setSavingKey(key);
    try {
      if (state === 'recurring') {
        // Block this hour for this specific date only
        const { data } = await API.post('/availability', {
          day_of_week:   null,
          start_time:    `${pad(h)}:00:00`,
          end_time:      `${pad(h + 1)}:00:00`,
          is_recurring:  false,
          is_blocked:    true,
          specific_date: toDateStr(d),
        });
        setAvailability(prev => [...prev, data]);

      } else if (state === 'blocked') {
        // Remove the block → slot becomes available again
        const id = findOneOffId(d, h, true);
        await API.delete(`/availability/${id}`);
        setAvailability(prev => prev.filter(s => s.id !== id));

      } else if (state === 'extra') {
        // Remove the extra one-off slot
        const id = findOneOffId(d, h, false);
        await API.delete(`/availability/${id}`);
        setAvailability(prev => prev.filter(s => s.id !== id));

      } else {
        // 'off' → add as extra one-off slot
        const { data } = await API.post('/availability', {
          day_of_week:   null,
          start_time:    `${pad(h)}:00:00`,
          end_time:      `${pad(h + 1)}:00:00`,
          is_recurring:  false,
          is_blocked:    false,
          specific_date: toDateStr(d),
        });
        setAvailability(prev => [...prev, data]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update slot');
    } finally {
      setSavingKey(null);
    }
  };

  /** dot indicator: any one-off modification exists for this date */
  const hasOneOffActivity = (d: Date) =>
    availability.some(s => !s.is_recurring && s.specific_date === toDateStr(d));

  // ── Slot card renderers ───────────────────────────────────────────────────

  const renderRecSlot = (h: number) => {
    const active = isRecActive(selectedDay, h);
    const busy   = savingKey === `rec-${selectedDay}-${h}`;
    return (
      <TouchableOpacity
        key={h}
        style={[styles.slotCard, active && styles.slotCardBlack]}
        onPress={() => toggleRec(selectedDay, h)}
        disabled={!!savingKey}
        activeOpacity={0.7}
      >
        <View style={styles.slotLeft}>
          <Ionicons
            name={active ? 'checkmark-circle' : 'time-outline'}
            size={20}
            color={active ? colors.white : colors.gray400}
          />
          <Text style={[styles.slotTime, active && styles.textWhite]}>
            {fmtSlot(h)}
          </Text>
        </View>
        <View style={styles.slotRight}>
          {busy ? (
            <ActivityIndicator
              size="small"
              color={active ? colors.white : colors.gray400}
            />
          ) : (
            <>
              <Text style={[styles.slotActionTxt, active && styles.textWhite]}>
                {active ? 'Active' : 'Add'}
              </Text>
              <Ionicons
                name={active ? 'remove-circle-outline' : 'add-circle-outline'}
                size={18}
                color={active ? colors.white : colors.black}
              />
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderOneOffSlot = (h: number) => {
    const state = getSlotState(selectedDate, h);
    const busy  = savingKey === `off-${toDateStr(selectedDate)}-${h}`;

    // Visual config per state
    const cfg = {
      recurring: {
        bg:          styles.slotCardBlack,
        iconName:    'checkmark-circle'    as const,
        iconColor:   colors.white,
        subtitle:    'Recurring weekly — tap to block today',
        subtitleC:   'rgba(255,255,255,0.7)' as any,
        actionLabel: 'Block',
        actionIcon:  'ban-outline'          as const,
        actionColor: colors.white,
      },
      blocked: {
        bg:          styles.slotCardRed,
        iconName:    'close-circle'         as const,
        iconColor:   colors.white,
        subtitle:    'Blocked for this date — tap to unblock',
        subtitleC:   'rgba(255,255,255,0.8)' as any,
        actionLabel: 'Unblock',
        actionIcon:  'refresh-outline'      as const,
        actionColor: colors.white,
      },
      extra: {
        bg:          styles.slotCardBlack,
        iconName:    'add-circle'           as const,
        iconColor:   colors.white,
        subtitle:    'Extra slot for this date — tap to remove',
        subtitleC:   'rgba(255,255,255,0.7)' as any,
        actionLabel: 'Remove',
        actionIcon:  'remove-circle-outline' as const,
        actionColor: colors.white,
      },
      off: {
        bg:          undefined,
        iconName:    'time-outline'         as const,
        iconColor:   colors.gray300,
        subtitle:    'Not available — tap to add as extra',
        subtitleC:   colors.gray400        as any,
        actionLabel: 'Add extra',
        actionIcon:  'add-circle-outline'  as const,
        actionColor: colors.black,
      },
    }[state];

    return (
      <TouchableOpacity
        key={h}
        style={[styles.slotCard, cfg.bg]}
        onPress={() => toggleOneOff(selectedDate, h)}
        disabled={!!savingKey}
        activeOpacity={0.7}
      >
        <View style={styles.slotLeft}>
          <Ionicons name={cfg.iconName} size={20} color={cfg.iconColor} />
          <View>
            <Text style={[
              styles.slotTime,
              state !== 'off' && styles.textWhite,
            ]}>
              {fmtSlot(h)}
            </Text>
            <Text style={[styles.slotSubtitle, { color: cfg.subtitleC }]}>
              {cfg.subtitle}
            </Text>
          </View>
        </View>
        <View style={styles.slotRight}>
          {busy ? (
            <ActivityIndicator size="small" color={cfg.actionColor} />
          ) : (
            <>
              <Text style={[styles.slotActionTxt, { color: cfg.actionColor }]}>
                {cfg.actionLabel}
              </Text>
              <Ionicons name={cfg.actionIcon} size={18} color={cfg.actionColor} />
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.subtitle}>
          {upcoming.length} upcoming session{upcoming.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── Main tabs ── */}
      <View style={styles.tabRow}>
        {(['schedule', 'availability'] as MainTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, mainTab === t && styles.tabActive]}
            onPress={() => setMainTab(t)}
          >
            <Text style={[styles.tabTxt, mainTab === t && styles.tabTxtActive]}>
              {t === 'schedule' ? 'Schedule' : 'Availability'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════════════════════════
          SCHEDULE
      ══════════════════════════════════ */}
      {mainTab === 'schedule' && (
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.sectionLabel}>UPCOMING</Text>
          {upcoming.length === 0 ? (
            <Card><Text style={styles.emptyTxt}>No upcoming bookings.</Text></Card>
          ) : (
            upcoming.map(b => (
              <Card key={b.id} style={styles.bookingCard}>
                <View style={styles.bookingRow}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateDayTxt}>
                      {new Date(b.date).toLocaleDateString('en-GB', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.dateNumTxt}>{new Date(b.date).getDate()}</Text>
                    <Text style={styles.dateMonTxt}>
                      {new Date(b.date).toLocaleDateString('en-GB', { month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.clientName}>{getName(b.client_id)}</Text>
                    <Text style={styles.bookingTime}>
                      {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                      {b.type ? ` · ${b.type}` : ''}
                    </Text>
                    {b.location
                      ? <Text style={styles.locationTxt}>{b.location}</Text>
                      : null}
                  </View>
                  <Badge
                    label={b.status}
                    variant={
                      b.status === 'confirmed' ? 'active'
                      : b.status === 'pending'  ? 'pending'
                      : 'inactive'
                    }
                  />
                </View>
              </Card>
            ))
          )}

          {past.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>PAST</Text>
              {past.map(b => (
                <Card key={b.id} style={[styles.bookingCard, { opacity: 0.5 }]}>
                  <View style={styles.bookingRow}>
                    <View style={styles.dateCol}>
                      <Text style={styles.dateNumTxt}>{new Date(b.date).getDate()}</Text>
                      <Text style={styles.dateMonTxt}>
                        {new Date(b.date).toLocaleDateString('en-GB', { month: 'short' })}
                      </Text>
                    </View>
                    <View style={styles.bookingInfo}>
                      <Text style={styles.clientName}>{getName(b.client_id)}</Text>
                      <Text style={styles.bookingTime}>
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
      )}

      {/* ══════════════════════════════════
          AVAILABILITY
      ══════════════════════════════════ */}
      {mainTab === 'availability' && (
        <View style={styles.flex1}>

          {/* Sub-tabs */}
          <View style={styles.subTabRow}>
            {(['weekly', 'one-off'] as AvailTab[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.subTab, availTab === t && styles.subTabActive]}
                onPress={() => setAvailTab(t)}
              >
                <Ionicons
                  name={t === 'weekly' ? 'repeat-outline' : 'calendar-number-outline'}
                  size={13}
                  color={availTab === t ? colors.white : colors.gray500}
                />
                <Text style={[styles.subTabTxt, availTab === t && styles.subTabTxtActive]}>
                  {t === 'weekly'
                    ? `Weekly (${recurringSlots.length})`
                    : `One-Off (${extraSlots.length + blockedSlots.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── WEEKLY ── */}
          {availTab === 'weekly' && (
            <>
              {/* Day-of-week strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {DAY_SHORT.map((day, di) => {
                  const sel   = di === selectedDay;
                  const count = recCountForDay(di);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, sel && styles.chipSel]}
                      onPress={() => setSelectedDay(di)}
                    >
                      <Text style={[styles.chipLabel, sel && styles.chipSelTxt]}>{day}</Text>
                      {count > 0 && (
                        <View style={[styles.dot, sel ? styles.dotWhite : styles.dotBlack]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Selected label */}
              <View style={styles.selectedRow}>
                <Text style={styles.selectedLabel}>{DAY_FULL[selectedDay]}</Text>
                <Text style={styles.selectedCount}>
                  {recCountForDay(selectedDay)} slot{recCountForDay(selectedDay) !== 1 ? 's' : ''} active
                </Text>
              </View>

              {/* Slot list */}
              <ScrollView
                style={styles.flex1}
                contentContainerStyle={styles.slotsList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              >
                {HOURS.map(h => renderRecSlot(h))}
                <View style={styles.infoBanner}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.gray400} />
                  <Text style={styles.infoTxt}>
                    Active slots repeat every {DAY_FULL[selectedDay]}.
                    Tap a slot to toggle it on or off.
                  </Text>
                </View>
              </ScrollView>
            </>
          )}

          {/* ── ONE-OFF ── */}
          {availTab === 'one-off' && (
            <>
              {/* Date strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {DATES_60.map((d, i) => {
                  const sel     = d.toDateString() === selectedDate.toDateString();
                  const hasMod  = hasOneOffActivity(d);
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.dateChip, sel && styles.chipSel]}
                      onPress={() => setSelectedDate(d)}
                    >
                      <Text style={[styles.chipDateDay, sel && styles.chipSelTxt]}>
                        {isToday
                          ? 'Today'
                          : d.toLocaleDateString('en-GB', { weekday: 'short' })}
                      </Text>
                      <Text style={[styles.chipDateNum, sel && styles.chipSelTxt]}>
                        {d.getDate()}
                      </Text>
                      {hasMod && (
                        <View style={[styles.dot, sel ? styles.dotWhite : styles.dotBlack]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Selected date label */}
              <View style={styles.selectedRow}>
                <Text style={styles.selectedLabel}>
                  {selectedDate.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
              </View>

              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.black }]} />
                  <Text style={styles.legendTxt}>Recurring / Extra</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.red500 }]} />
                  <Text style={styles.legendTxt}>Blocked</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.gray300 }]} />
                  <Text style={styles.legendTxt}>Off</Text>
                </View>
              </View>

              {/* Slot list */}
              <ScrollView
                style={styles.flex1}
                contentContainerStyle={styles.slotsList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              >
                {HOURS.map(h => renderOneOffSlot(h))}
                <View style={styles.infoBanner}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.gray400} />
                  <Text style={styles.infoTxt}>
                    <Text style={{ fontWeight: '700' }}>Recurring</Text> — tap to block just this date.{' '}
                    <Text style={{ fontWeight: '700' }}>Blocked</Text> — tap to restore.{' '}
                    <Text style={{ fontWeight: '700' }}>Off</Text> — tap to add a one-off extra slot.
                  </Text>
                </View>
              </ScrollView>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  flex1:     { flex: 1 },

  // Header
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title:    { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm,  color: colors.gray500, marginTop: spacing.xs },

  // Main tabs
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
  tabActive:    { backgroundColor: colors.black },
  tabTxt:       { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray500 },
  tabTxtActive: { color: colors.white },

  // Availability sub-tabs
  subTabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  subTabActive:    { backgroundColor: colors.black, borderColor: colors.black },
  subTabTxt:       { fontSize: fontSize.xs + 1, fontWeight: '500', color: colors.gray500 },
  subTabTxtActive: { color: colors.white },

  // Schedule scroll
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.gray400,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  emptyTxt: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },

  // Booking cards
  bookingCard:  { marginBottom: spacing.sm },
  bookingRow:   { flexDirection: 'row', alignItems: 'center' },
  dateCol:      { alignItems: 'center', marginRight: spacing.lg, minWidth: 40 },
  dateDayTxt:   { fontSize: fontSize.xs, color: colors.gray400, textTransform: 'uppercase' },
  dateNumTxt:   { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  dateMonTxt:   { fontSize: fontSize.xs, color: colors.gray400 },
  bookingInfo:  { flex: 1 },
  clientName:   { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  bookingTime:  { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  locationTxt:  { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },

  // Day / date strip
  strip: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dayChip: {
    width: 56,
    height: 68,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dateChip: {
    width: 58,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  chipSel:     { backgroundColor: colors.black, borderColor: colors.black },
  chipLabel:   { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700 },
  chipSelTxt:  { color: colors.white },
  chipDateDay: { fontSize: fontSize.xs, color: colors.gray500, fontWeight: '500' },
  chipDateNum: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },

  // Dot indicators
  dot:      { width: 5, height: 5, borderRadius: 3, marginTop: 1 },
  dotBlack: { backgroundColor: colors.black },
  dotWhite: { backgroundColor: colors.white },

  // Selected row
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  selectedLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  selectedCount: { fontSize: fontSize.sm, color: colors.gray400 },

  // Legend (one-off tab)
  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    gap: spacing.lg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot:  { width: 10, height: 10, borderRadius: 5 },
  legendTxt:  { fontSize: fontSize.xs, color: colors.gray500 },

  // Slot list
  slotsList: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  // Slot cards
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    marginBottom: spacing.sm,
  },
  slotCardBlack: { backgroundColor: colors.black,  borderColor: colors.black  },
  slotCardRed:   { backgroundColor: colors.red500,  borderColor: colors.red500  },

  slotLeft:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  slotTime:      { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  slotSubtitle:  { fontSize: fontSize.xs, marginTop: 2, flexShrink: 1 },
  slotRight:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 },
  slotActionTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.black },

  textWhite: { color: colors.white },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  infoTxt: {
    fontSize: fontSize.xs,
    color: colors.gray500,
    flex: 1,
    lineHeight: 17,
  },
});