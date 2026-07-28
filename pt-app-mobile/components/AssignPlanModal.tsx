import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

interface Props {
  visible: boolean;
  planId: string;
  planTitle: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function AssignPlanModal({
  visible, planId, planTitle, onClose, onSuccess,
}: Props) {
  const [clients,  setClients]  = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected([]);
      loadClients();
    }
  }, [visible]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await API.get('/clients?status=active');
      setClients(res.data);
    } catch (e) {
      console.error('AssignPlanModal:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleAssign = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      const res = await API.post(`/workout-plans/${planId}/assign`, {
        client_ids: selected,
      });
      onSuccess(res.data.plan_ids.length);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail ?? 'Failed to assign plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Assign Plan</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{planTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              color={colors.black}
              style={{ padding: spacing.xxxl }}
            />
          ) : clients.length === 0 ? (
            <Text style={styles.empty}>No active clients found.</Text>
          ) : (
            <>
              <Text style={styles.hint}>
                Each selected client will receive their own copy of this plan:
              </Text>

              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
              >
                {clients.map((c) => {
                  const isSelected = selected.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.clientRow,
                        isSelected && styles.clientRowSelected,
                      ]}
                      onPress={() => toggle(c.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.avatar,
                          isSelected && styles.avatarSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.avatarTxt,
                            isSelected && styles.avatarTxtSelected,
                          ]}
                        >
                          {c.name?.charAt(0)?.toUpperCase()}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.clientName}>{c.name}</Text>
                        <Text style={styles.clientEmail}>{c.email}</Text>
                      </View>

                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={13} color={colors.white} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.footer}>
                {selected.length > 0 && (
                  <Text style={styles.selectedCount}>
                    {selected.length} client{selected.length !== 1 ? 's' : ''} selected
                  </Text>
                )}
                <TouchableOpacity
                  style={[
                    styles.assignBtn,
                    (selected.length === 0 || saving) && styles.assignBtnDisabled,
                  ]}
                  onPress={handleAssign}
                  disabled={selected.length === 0 || saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.assignBtnTxt}>
                      Assign to {selected.length || ''} Client
                      {selected.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '82%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    gap: spacing.md,
  },
  title:    { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  hint: {
    fontSize: fontSize.sm,
    color: colors.gray500,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  empty: {
    fontSize: fontSize.sm,
    color: colors.gray400,
    textAlign: 'center',
    padding: spacing.xxxl,
  },
  list:        { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
  },
  clientRowSelected: {
    backgroundColor: colors.gray50,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected:    { backgroundColor: colors.black },
  avatarTxt:         { fontSize: fontSize.md, fontWeight: '700', color: colors.gray700 },
  avatarTxtSelected: { color: colors.white },
  clientName:  { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  clientEmail: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    gap: spacing.sm,
  },
  selectedCount: {
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
  },
  assignBtn: {
    backgroundColor: colors.black,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  assignBtnDisabled: { opacity: 0.4 },
  assignBtnTxt: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});