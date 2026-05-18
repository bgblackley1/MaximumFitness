// app/client/book.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

interface AvailableSlot {
  date: string;
  start_time: string;
  end_time: string;
}

export default function BookScreen() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [sessionType, setSessionType] = useState('in-person');
  const [successMessage, setSuccessMessage] = useState('');

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const res = await API.get(`/bookings/available-slots?date=${dateStr}`);
      setSlots(res.data);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotPress = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setConfirmModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      await API.post('/bookings', {
        date: selectedSlot.date,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        type: sessionType,
        notes: notes || null,
      });
      setConfirmModal(false);
      setSelectedSlot(null);
      setNotes('');
      setSuccessMessage('Session booked successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchSlots(); // Refresh to remove booked slot
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to book session';
      setConfirmModal(false);
      setSuccessMessage('');
      Alert.alert('Booking Error', message);
    } finally {
      setBooking(false);
    }
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${minutes} ${ampm}`;
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-GB', { weekday: 'short' });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Book Session</Text>
        <Text style={styles.subtitle}>Select a date and time</Text>
      </View>

      {/* Success Banner */}
      {successMessage ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.green700} />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      {/* Date Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRow}
      >
        {dates.map((date, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dateChip,
              isSameDay(date, selectedDate) && styles.dateChipActive,
            ]}
            onPress={() => setSelectedDate(date)}
          >
            <Text
              style={[
                styles.dateChipDay,
                isSameDay(date, selectedDate) && styles.dateChipTextActive,
              ]}
            >
              {isToday(date) ? 'Today' : getDayName(date)}
            </Text>
            <Text
              style={[
                styles.dateChipNumber,
                isSameDay(date, selectedDate) && styles.dateChipTextActive,
              ]}
            >
              {date.getDate()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Selected Date Label */}
      <View style={styles.selectedDateRow}>
        <Text style={styles.selectedDateText}>
          {selectedDate.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {/* Slots */}
      <ScrollView style={styles.slotsContainer} contentContainerStyle={styles.slotsContent}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.black} style={{ marginTop: spacing.xxxl }} />
        ) : slots.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No available slots</Text>
            <Text style={styles.emptyText}>
              Your trainer hasn't set availability for this date. Try another day.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.slotsLabel}>
              {slots.length} slot{slots.length !== 1 ? 's' : ''} available
            </Text>
            {slots.map((slot, index) => (
              <TouchableOpacity
                key={index}
                style={styles.slotCard}
                onPress={() => handleSlotPress(slot)}
              >
                <View style={styles.slotLeft}>
                  <Ionicons name="time-outline" size={20} color={colors.gray600} />
                  <Text style={styles.slotTime}>
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </Text>
                </View>
                <View style={styles.slotRight}>
                  <Text style={styles.slotBook}>Book</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.black} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={confirmModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Booking</Text>
              <TouchableOpacity onPress={() => setConfirmModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>

            {selectedSlot && (
              <View style={styles.modalBody}>
                <View style={styles.modalDetailRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.gray500} />
                  <Text style={styles.modalDetailText}>
                    {selectedDate.toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Ionicons name="time-outline" size={18} color={colors.gray500} />
                  <Text style={styles.modalDetailText}>
                    {formatTime(selectedSlot.start_time)} – {formatTime(selectedSlot.end_time)}
                  </Text>
                </View>

                {/* Session Type */}
                <Text style={styles.fieldLabel}>Session Type</Text>
                <View style={styles.typeRow}>
                  {['in-person', 'online'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeChip,
                        sessionType === type && styles.typeChipActive,
                      ]}
                      onPress={() => setSessionType(type)}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          sessionType === type && styles.typeChipTextActive,
                        ]}
                      >
                        {type === 'in-person' ? 'In Person' : 'Online'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Notes */}
                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Any injuries, goals, or preferences..."
                  placeholderTextColor={colors.gray400}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />

                {/* Confirm Button */}
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirmBooking}
                  disabled={booking}
                >
                  {booking ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                  )}
                </TouchableOpacity>
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray500, marginTop: spacing.xs },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.green50,
    marginHorizontal: spacing.xl,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  successText: { fontSize: fontSize.sm, color: colors.green700, fontWeight: '500' },
  dateRow: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dateChip: {
    width: 60,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dateChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  dateChipDay: { fontSize: fontSize.xs, color: colors.gray500, fontWeight: '500' },
  dateChipNumber: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  dateChipTextActive: { color: colors.white },
  selectedDateRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  selectedDateText: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  slotsContainer: { flex: 1 },
  slotsContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  slotsLabel: {
    fontSize: fontSize.sm,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
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
  slotLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slotTime: { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  slotRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotBook: { fontSize: fontSize.sm, fontWeight: '600', color: colors.black },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.gray700 },
  emptyText: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody: { padding: spacing.xl },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalDetailText: { fontSize: fontSize.md, color: colors.gray700 },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.gray700,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  typeChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  typeChipText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray600 },
  typeChipTextActive: { color: colors.white },
  textInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.black,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmButton: {
    backgroundColor: colors.black,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  confirmButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});