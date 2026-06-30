import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Modal, Clipboard, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

export default function AddClientScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // ── Success state ──
  const [successModal, setSuccessModal]   = useState(false);
  const [createdClient, setCreatedClient] = useState<{
    name: string; email: string; temp_password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', age: '', sex: '',
    height_cm: '', starting_weight_kg: '', notes: '',
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.name || !form.email) {
      setError('Name and email are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await API.post('/clients', {
        name:                form.name,
        email:               form.email,
        age:                 form.age                 ? Number(form.age)                 : null,
        sex:                 form.sex                 || null,
        height_cm:           form.height_cm           ? Number(form.height_cm)           : null,
        starting_weight_kg:  form.starting_weight_kg  ? Number(form.starting_weight_kg)  : null,
        notes:               form.notes               || null,
      });
      // Show success modal with temp password
      setCreatedClient({
        name:          form.name,
        email:         form.email,
        temp_password: res.data.temp_password,
      });
      setSuccessModal(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdClient) return;
    const text = `Login details for Maximum Fitness:\nEmail: ${createdClient.email}\nPassword: ${createdClient.temp_password}`;
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDone = () => {
    setSuccessModal(false);
    setCreatedClient(null);
    setCopied(false);
    // Reset form
    setForm({ name: '', email: '', age: '', sex: '', height_cm: '', starting_weight_kg: '', notes: '' });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Add Client</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label="Name *"
            value={form.name}
            onChangeText={(v) => update('name', v)}
            placeholder="Full name"
          />
          <Input
            label="Email *"
            value={form.email}
            onChangeText={(v) => update('email', v)}
            placeholder="client@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label="Age"
                value={form.age}
                onChangeText={(v) => update('age', v)}
                placeholder="e.g. 32"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label="Sex"
                value={form.sex}
                onChangeText={(v) => update('sex', v)}
                placeholder="M / F / Other"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label="Height (cm)"
                value={form.height_cm}
                onChangeText={(v) => update('height_cm', v)}
                placeholder="e.g. 175"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label="Weight (kg)"
                value={form.starting_weight_kg}
                onChangeText={(v) => update('starting_weight_kg', v)}
                placeholder="e.g. 80"
                keyboardType="numeric"
              />
            </View>
          </View>
          <Input
            label="Notes"
            value={form.notes}
            onChangeText={(v) => update('notes', v)}
            placeholder="Injuries, goals, preferences..."
            multiline
            numberOfLines={4}
            style={{ height: 100, textAlignVertical: 'top' }}
          />

          <Button
            title="Add Client"
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Success Modal ── */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* Tick icon */}
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={32} color={colors.white} />
            </View>

            <Text style={styles.successTitle}>Client Created!</Text>
            <Text style={styles.successSubtitle}>
              Share these login details with{' '}
              <Text style={{ fontWeight: '700' }}>{createdClient?.name}</Text>
            </Text>

            {/* Login details card */}
            <View style={styles.credentialsCard}>
              <View style={styles.credRow}>
                <Ionicons name="mail-outline" size={16} color={colors.gray500} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.credLabel}>Email</Text>
                  <Text style={styles.credValue}>{createdClient?.email}</Text>
                </View>
              </View>
              <View style={styles.credDivider} />
              <View style={styles.credRow}>
                <Ionicons name="key-outline" size={16} color={colors.gray500} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.credLabel}>Temporary Password</Text>
                  <Text style={styles.credPassword}>{createdClient?.temp_password}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.noteText}>
              ⚠️ The client should change their password after first login.
            </Text>

            {/* Copy button */}
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnSuccess]}
              onPress={handleCopy}
            >
              <Ionicons
                name={copied ? 'checkmark-circle-outline' : 'copy-outline'}
                size={18}
                color={copied ? colors.green700 : colors.black}
              />
              <Text style={[styles.copyBtnTxt, copied && { color: colors.green700 }]}>
                {copied ? 'Copied to clipboard!' : 'Copy login details'}
              </Text>
            </TouchableOpacity>

            {/* Done */}
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
              <Text style={styles.doneBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  backBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  scroll:    { padding: spacing.xl },
  errorBox:  {
    backgroundColor: colors.red50, borderWidth: 1, borderColor: colors.red500,
    borderRadius: 8, padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { fontSize: fontSize.sm, color: colors.red700 },
  row:       { flexDirection: 'row', gap: spacing.md },
  halfInput: { flex: 1 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },
  modalBox: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.xl, width: '100%', maxWidth: 400,
    alignItems: 'center',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: fontSize.xxl, fontWeight: '700', color: colors.black,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center',
    marginBottom: spacing.xl, lineHeight: 20,
  },
  credentialsCard: {
    width: '100%', borderWidth: 1.5, borderColor: colors.gray200,
    borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.md,
  },
  credRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    padding: spacing.lg,
  },
  credDivider:  { height: 1, backgroundColor: colors.gray100 },
  credLabel:    { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.xs },
  credValue:    { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  credPassword: {
    fontSize: fontSize.lg, fontWeight: '700', color: colors.black,
    letterSpacing: 1,
  },
  noteText: {
    fontSize: fontSize.xs, color: colors.gray500, textAlign: 'center',
    marginBottom: spacing.xl, lineHeight: 18,
  },
  copyBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray200, marginBottom: spacing.sm,
  },
  copyBtnSuccess: { borderColor: colors.green700, backgroundColor: colors.green50 },
  copyBtnTxt:    { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  doneBtn: {
    width: '100%', backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  doneBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});