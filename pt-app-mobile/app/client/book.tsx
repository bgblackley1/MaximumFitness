import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

interface AvailableSlot   { date: string; start_time: string; end_time: string; }
interface ExistingBooking { id: string; date: string; start_time: string; end_time: string; status: string; type: string; }

export default function BookScreen() {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots,        setSlots]        = useState<AvailableSlot[]>([]);
  const [myBookings,   setMyBookings]   = useState<ExistingBooking[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [booking,      setBooking]      = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [cancelModal,  setCancelModal]  = useState(false);
  const [selectedSlot,    setSelectedSlot]    = useState<AvailableSlot | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ExistingBooking | null>(null);
  const [notes,          setNotes]          = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage,   setErrorMessage]   = useState('');

  // ── Session pack ──────────────────────────────────────────────────────────
  // null  = still loading or failed to load (don't block)
  // 0     = confirmed zero sessions — block booking
  // n > 0 = sessions available
  const [sessionsRemaining, setSessionsRemaining] = useState<number | null>(null);
  const [packName,          setPackName]          = useState<string | null>(null);
  const [loadingPack,       setLoadingPack]       = useState(true);

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  // Load session pack once on mount
  useEffect(() => {
    loadSessionPack();
  }, []);

  // Load available slots + existing bookings whenever the selected date changes
  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  // ── Session pack loader ───────────────────────────────────────────────────
  const loadSessionPack = async () => {
    try {
      const res    = await API.get('/payments/session-packs');
      const packs: any[] = res.data;
      // Prefer an active pack, fall back to most recent
      const active = packs.find(p => p.status === 'active') ?? packs[0] ?? null;
      if (active) {
        setSessionsRemaining(active.sessions_remaining);
        setPackName(active.pack_name);
      } else {
        // No pack at all — treat as 0
        setSessionsRemaining(0);
        setPackName(null);
      }
    } catch {
      // Can't reach API — fail open so booking isn't blocked by a network error
      setSessionsRemaining(null);
    } finally {
      setLoadingPack(false);
    }
  };

  // ── Slot / booking data ───────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const [slotsRes, bookingsRes] = await Promise.allSettled([
        API.get(`/bookings/available-slots?date=${dateStr}`),
        API.get(`/bookings?from_date=${dateStr}&to_date=${dateStr}`),
      ]);
      setSlots(slotsRes.status === 'fulfilled' ? slotsRes.value.data : []);
      setMyBookings(
        bookingsRes.status === 'fulfilled'
          ? bookingsRes.value.data.filter((b: ExistingBooking) => b.status !== 'cancelled')
          : []
      );
    } catch (err) {
      console.error('fetchData:', err);
    } finally {
      setLoading(false);
    }
  };

  // True only when we have confirmed 0 sessions remaining
  const bookingBlocked = sessionsRemaining !== null && sessionsRemaining === 0;

  // ── Book a slot ───────────────────────────────────────────────────────────
  const handleBookSlot = (slot: AvailableSlot) => {
    if (bookingBlocked) return; // belt-and-braces; button is also disabled
    setSelectedSlot(slot);
    setNotes('');
    setConfirmModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      await API.post('/bookings', {
        date:       selectedSlot.date,
        start_time: selectedSlot.start_time,
        end_time:   selectedSlot.end_time,
        type:       'in-person',
        notes:      notes || null,
      });
      setConfirmModal(false);
      setSelectedSlot(null);
      setNotes('');
      // Optimistically decrement the local sessions count
      if (sessionsRemaining !== null && sessionsRemaining > 0) {
        setSessionsRemaining(prev => (prev !== null ? Math.max(prev - 1, 0) : null));
      }
      setSuccessMessage('Session booked!');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchData();
    } catch (err: any) {
      setConfirmModal(false);
      setErrorMessage(err.response?.data?.detail || 'Failed to book session');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setBooking(false);
    }
  };

  // ── Cancel a booking ──────────────────────────────────────────────────────
  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    setBooking(true);
    try {
      await API.delete(`/bookings/${selectedBooking.id}`);
      setCancelModal(false);
      setSelectedBooking(null);
      setSuccessMessage('Booking cancelled.');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchData();
    } catch (err: any) {
      setCancelModal(false);
      setErrorMessage(err.response?.data?.detail || 'Failed to cancel booking');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setBooking(false);
    }
  };

  const fmt12 = (t: string) => {
    const [h] = t.split(':').map(Number);
    return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const isToday   = (d: Date) => d.toDateString() === new Date().toDateString();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const bookedStartTimes = new Set(myBookings.map(b => b.start_time));

  // How many available slots are actually unbooked
  const unbookedSlots = slots.filter(s => !bookedStartTimes.has(s.start_time));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Book a Session</Text>
        <Text style={styles.subtitle}>Choose an available slot</Text>
      </View>

      {/* ── Session pack status banner ── */}
      {!loadingPack && sessionsRemaining !== null && (
        <View style={[
          styles.packBanner,
          sessionsRemaining === 0 ? styles.packBannerDanger
          : sessionsRemaining <= 2 ? styles.packBannerWarning
          : styles.packBannerOk,
        ]}>
          <Ionicons
            name={
              sessionsRemaining === 0   ? 'close-circle-outline'
              : sessionsRemaining <= 2  ? 'warning-outline'
              : 'checkmark-circle-outline'
            }
            size={16}
            color={
              sessionsRemaining === 0   ? colors.red700
              : sessionsRemaining <= 2  ? '#92400E'
              : colors.green700
            }
          />
          <Text style={[
            styles.packBannerTxt,
            sessionsRemaining === 0  ? { color: colors.red700 }
            : sessionsRemaining <= 2 ? { color: '#92400E' }
            : { color: colors.green700 },
          ]}>
            {sessionsRemaining === 0
              ? 'No sessions remaining — purchase a pack to book.'
              : `${sessionsRemaining} session${sessionsRemaining !== 1 ? 's' : ''} remaining${packName ? ` · ${packName}` : ''}`}
          </Text>
          {sessionsRemaining === 0 && (
            <TouchableOpacity onPress={() => router.push('/client/account' as any)}>
              <Text style={styles.buyNowLink}>Buy now →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Success / error banners ── */}
      {successMessage ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.green700} />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.red700} />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* ── Date strip ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRow}
      >
        {dates.map((date, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.dateChip, isSameDay(date, selectedDate) && styles.dateChipActive]}
            onPress={() => setSelectedDate(date)}
          >
            <Text style={[styles.dateChipDay, isSameDay(date, selectedDate) && styles.dateChipTxtActive]}>
              {isToday(date) ? 'Today' : date.toLocaleDateString('en-GB', { weekday: 'short' })}
            </Text>
            <Text style={[styles.dateChipNum, isSameDay(date, selectedDate) && styles.dateChipTxtActive]}>
              {date.getDate()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.dateLabel}>
        <Text style={styles.dateLabelTxt}>
          {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* ── Slot list ── */}
      <ScrollView style={styles.slotList} contentContainerStyle={styles.slotListContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.black} style={{ marginTop: spacing.xxxl }} />
        ) : slots.length === 0 && myBookings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No slots available</Text>
            <Text style={styles.emptyText}>
              Your trainer hasn't set availability for this day. Try another date.
            </Text>
          </View>
        ) : (
          <>
            {/* Existing booked sessions */}
            {myBookings.map(b => (
              <View key={b.id} style={styles.bookedCard}>
                <View style={styles.bookedLeft}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                  <View>
                    <Text style={styles.bookedTime}>
                      {fmt12(b.start_time)} – {fmt12(b.end_time)}
                    </Text>
                    <Text style={styles.bookedLabel}>Booked · In Person</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.cancelChip}
                  onPress={() => { setSelectedBooking(b); setCancelModal(true); }}
                >
                  <Text style={styles.cancelChipTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ))}

            {/* Available slots */}
            {unbookedSlots.length > 0 && (
              <>
                {myBookings.length > 0 && (
                  <Text style={styles.availableLabel}>
                    {unbookedSlots.length} more slot{unbookedSlots.length !== 1 ? 's' : ''} available
                  </Text>
                )}

                {/* Blocked banner above slots when 0 sessions */}
                {bookingBlocked && (
                  <View style={styles.blockedBanner}>
                    <Ionicons name="lock-closed-outline" size={15} color={colors.red700} />
                    <Text style={styles.blockedBannerTxt}>
                      Slots are locked — you have no sessions remaining.{' '}
                      <Text
                        style={styles.blockedBannerLink}
                        onPress={() => router.push('/client/account' as any)}
                      >
                        Purchase a pack →
                      </Text>
                    </Text>
                  </View>
                )}

                {unbookedSlots.map((slot, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.slotCard, bookingBlocked && styles.slotCardDisabled]}
                    onPress={() => handleBookSlot(slot)}
                    disabled={bookingBlocked}
                    activeOpacity={bookingBlocked ? 1 : 0.7}
                  >
                    <View style={styles.slotLeft}>
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={bookingBlocked ? colors.gray300 : colors.gray600}
                      />
                      <Text style={[styles.slotTime, bookingBlocked && styles.slotTimeDisabled]}>
                        {fmt12(slot.start_time)} – {fmt12(slot.end_time)}
                      </Text>
                    </View>
                    <View style={styles.slotRight}>
                      {bookingBlocked ? (
                        <View style={styles.lockedChip}>
                          <Ionicons name="lock-closed" size={12} color={colors.gray400} />
                          <Text style={styles.lockedChipTxt}>No sessions</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.slotBook}>Book</Text>
                          <Ionicons name="chevron-forward" size={16} color={colors.black} />
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* All slots already booked for this day */}
            {unbookedSlots.length === 0 && myBookings.length > 0 && (
              <View style={styles.allBookedNote}>
                <Ionicons name="information-circle-outline" size={16} color={colors.gray400} />
                <Text style={styles.allBookedTxt}>
                  All available slots for this day are booked.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Confirm Booking Modal ── */}
      <Modal visible={confirmModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Booking</Text>
              <TouchableOpacity onPress={() => setConfirmModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            {selectedSlot && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.gray500} />
                  <Text style={styles.detailTxt}>
                    {selectedDate.toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={18} color={colors.gray500} />
                  <Text style={styles.detailTxt}>
                    {fmt12(selectedSlot.start_time)} – {fmt12(selectedSlot.end_time)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={18} color={colors.gray500} />
                  <Text style={styles.detailTxt}>In Person</Text>
                </View>

                {/* Low-session warning inside confirm modal */}
                {sessionsRemaining !== null && sessionsRemaining <= 2 && sessionsRemaining > 0 && (
                  <View style={styles.lowSessionWarning}>
                    <Ionicons name="warning-outline" size={14} color="#92400E" />
                    <Text style={styles.lowSessionWarningTxt}>
                      This will use 1 of your {sessionsRemaining} remaining session
                      {sessionsRemaining !== 1 ? 's' : ''}.
                    </Text>
                  </View>
                )}

                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Any injuries, requests or preferences..."
                  placeholderTextColor={colors.gray400}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity
                  style={[styles.confirmBtn, booking && { opacity: 0.6 }]}
                  onPress={handleConfirmBooking}
                  disabled={booking}
                >
                  {booking
                    ? <ActivityIndicator color={colors.white} />
                    : <Text style={styles.confirmBtnTxt}>Confirm Booking</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Cancel Booking Modal ── */}
      <Modal visible={cancelModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cancel Booking</Text>
              <TouchableOpacity onPress={() => { setCancelModal(false); setSelectedBooking(null); }}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            {selectedBooking && (
              <View style={styles.modalBody}>
                <View style={styles.cancelInfo}>
                  <Ionicons name="warning-outline" size={28} color={colors.red500} />
                  <Text style={styles.cancelInfoTxt}>
                    Are you sure you want to cancel your{' '}
                    <Text style={{ fontWeight: '700' }}>
                      {fmt12(selectedBooking.start_time)} – {fmt12(selectedBooking.end_time)}
                    </Text>{' '}
                    session on{' '}
                    <Text style={{ fontWeight: '700' }}>
                      {selectedDate.toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </Text>?
                  </Text>
                </View>
                <Text style={styles.cancelNote}>
                  Please give your trainer as much notice as possible.
                </Text>
                <View style={styles.cancelBtns}>
                  <TouchableOpacity
                    style={styles.keepBtn}
                    onPress={() => { setCancelModal(false); setSelectedBooking(null); }}
                  >
                    <Text style={styles.keepBtnTxt}>Keep Booking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.doCancelBtn, booking && { opacity: 0.6 }]}
                    onPress={handleCancelBooking}
                    disabled={booking}
                  >
                    {booking
                      ? <ActivityIndicator color={colors.white} size="small" />
                      : <Text style={styles.doCancelBtnTxt}>Cancel Booking</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header:    { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title:     { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle:  { fontSize: fontSize.sm, color: colors.gray500, marginTop: spacing.xs },

  // ── Pack status banner ──
  packBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: borderRadius.sm,
  },
  packBannerDanger:  { backgroundColor: colors.red50 },
  packBannerWarning: { backgroundColor: '#FFFBEB' },
  packBannerOk:      { backgroundColor: colors.green50 },
  packBannerTxt:     { flex: 1, fontSize: fontSize.xs, fontWeight: '500', lineHeight: 16 },
  buyNowLink:        { fontSize: fontSize.xs, fontWeight: '700', color: colors.red700 },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.green50, marginHorizontal: spacing.xl,
    padding: spacing.md, borderRadius: borderRadius.sm, marginBottom: spacing.sm,
  },
  successText: { fontSize: fontSize.sm, color: colors.green700, fontWeight: '500' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.red50, marginHorizontal: spacing.xl,
    padding: spacing.md, borderRadius: borderRadius.sm, marginBottom: spacing.sm,
  },
  errorText: { fontSize: fontSize.sm, color: colors.red700, fontWeight: '500' },

  // ── Date strip ──
  dateRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  dateChip: {
    width: 60, height: 72, borderRadius: borderRadius.md,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
  },
  dateChipActive:    { backgroundColor: colors.black, borderColor: colors.black },
  dateChipDay:       { fontSize: fontSize.xs, color: colors.gray500, fontWeight: '500' },
  dateChipNum:       { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  dateChipTxtActive: { color: colors.white },

  dateLabel:    { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  dateLabelTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },

  slotList:        { flex: 1 },
  slotListContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  empty:      { alignItems: 'center', paddingTop: spacing.xxxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText:  { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center', paddingHorizontal: spacing.xl },

  // Booked slot (filled black)
  bookedCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.black, borderRadius: borderRadius.md,
    padding: spacing.lg, marginBottom: spacing.sm,
  },
  bookedLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bookedTime:  { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
  bookedLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  cancelChip: {
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelChipTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },

  availableLabel: {
    fontSize: fontSize.sm, color: colors.gray500, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  // Blocked (no sessions) banner above slots
  blockedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.red50, padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  blockedBannerTxt:  { flex: 1, fontSize: fontSize.xs, color: colors.red700, lineHeight: 18 },
  blockedBannerLink: { fontWeight: '700', textDecorationLine: 'underline' },

  // Available slot card
  slotCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white, padding: spacing.lg, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray200, marginBottom: spacing.sm,
  },
  slotCardDisabled: {
    backgroundColor: colors.gray50, borderColor: colors.gray100, opacity: 0.7,
  },
  slotLeft:         { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slotTime:         { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  slotTimeDisabled: { color: colors.gray300 },
  slotRight:        { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotBook:         { fontSize: fontSize.sm, fontWeight: '600', color: colors.black },
  lockedChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100, paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs, borderRadius: borderRadius.full,
  },
  lockedChipTxt: { fontSize: fontSize.xs, color: colors.gray400, fontWeight: '500' },

  allBookedNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.gray100, padding: spacing.md,
    borderRadius: borderRadius.sm, marginTop: spacing.sm,
  },
  allBookedTxt: { fontSize: fontSize.sm, color: colors.gray500, flex: 1 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl, paddingBottom: spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:  { padding: spacing.xl },
  detailRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  detailTxt:  { fontSize: fontSize.md, color: colors.gray700 },

  lowSessionWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: '#FFFBEB', padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  lowSessionWarningTxt: { flex: 1, fontSize: fontSize.xs, color: '#92400E', lineHeight: 18 },

  fieldLabel: {
    fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  textInput: {
    borderWidth: 1, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.sm, color: colors.black,
    minHeight: 80, textAlignVertical: 'top',
  },
  confirmBtn: {
    backgroundColor: colors.black, paddingVertical: spacing.lg,
    borderRadius: borderRadius.sm, alignItems: 'center', marginTop: spacing.xl,
  },
  confirmBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },

  cancelInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.red50, padding: spacing.lg,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  cancelInfoTxt: { flex: 1, fontSize: fontSize.md, color: colors.gray800, lineHeight: 22 },
  cancelNote:    { fontSize: fontSize.sm, color: colors.gray500, marginBottom: spacing.xl },
  cancelBtns:    { flexDirection: 'row', gap: spacing.md },
  keepBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray300, alignItems: 'center',
  },
  keepBtnTxt:    { fontSize: fontSize.md, fontWeight: '500', color: colors.gray700 },
  doCancelBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    backgroundColor: colors.red500, alignItems: 'center',
  },
  doCancelBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});