import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { colors, fontSize, spacing } from '@/constants/theme';

export default function AddClientScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    age: '',
    sex: '',
    height_cm: '',
    starting_weight_kg: '',
    notes: '',
  });

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email) {
      setError('Name and email are required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await API.post('/clients', {
        name: form.name,
        email: form.email,
        age: form.age ? Number(form.age) : null,
        sex: form.sex || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        starting_weight_kg: form.starting_weight_kg ? Number(form.starting_weight_kg) : null,
        notes: form.notes || null,
      });
      router.back();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create client');
    } finally {
      setLoading(false);
    }
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

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
            placeholder="Any relevant notes, injuries, goals..."
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.black,
  },
  scroll: {
    padding: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.red50,
    borderWidth: 1,
    borderColor: colors.red500,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.red700,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
});