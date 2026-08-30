import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

interface Props {
  visible:          boolean;
  planId:           string;
  planTitle:        string;
  onClose:          () => void;
  onSuccess:        (count: number, assignedClients: { id: string; name: string }[]) => void;
}

export default function AssignPlanModal({
  visible, planId, planTitle, onClose, onSuccess,
}: Props) {
  const [clients,          setClients]          = useState<any[]>([]);
  const [selected,         setSelected]         = useState<string[]>([]);
  const [loadingClients,   setLoadingClients]   = useState(true);
  const [loadingCurrent,   setLoadingCurrent]   = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [errorMsg,         setErrorMsg]         = useState('');

  useEffect(() => {
    if (visible && planId) {
      setSelected([]);
      setErrorMsg('');
      loadData();
    }
  }, [visible, planId]);

  const loadData = async () => {
    setLoadingClients(true);
    setLoadingCurrent(true);
    try {
      // Load all active clients AND current assignments in parallel
      const [clientsRes, planRes] = await Promise.allSettled([
        API.get('/clients?status=active'),
        API.get(`/workout-plans/${planId}`),
      ]);

      if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.data);

      if (planRes.status === 'fulfilled') {
        const assigned: { id: string }[] = planRes.value.data.assigned_clients ?? [];
        setSelected(assigned.map((c) => c.id));
      }
    } catch (e) {
      console.error('AssignPlanModal loadData:', e);
    } finally {
      setLoadingClients(false);
      setLoadingCurrent(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleAssign = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      await API.post(`/workout-plans/${planId}/assign`, { client_ids: selected });
      const assignedClients = clients
        .filter((c) => selected.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name }));
      onSuccess(selected.length, assignedClients);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.response?.data?.detail ?? 'Failed to assign plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isLoading = loadingClients || loadingCurrent;

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

          {isLoading ? (
            <ActivityIndicator color={colors.black} style={{ padding: spacing.xxxl }} />
          ) : clients.length === 0 ? (
            <Text style={styles.empty}>No active clients found.</Text>
          ) : (
            <>
              <Text style={styles.hint}>
                Tick the clients who should have access to this plan. Unticking removes their access.
              </Text>

              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.red700} />
                  <Text style={styles.errorTxt}>{errorMsg}</Text>
                </View>
              ) : null}

              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
              >
                {clients.map((c) => {
                  const isSelected = selected.includes(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.clientRow, isSelected && styles.clientRowSelected]}
                      onPress={() => toggle(c.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                        <Text style={[styles.avatarTxt, isSelected && styles.avatarTxtSelected]}>
                          {c.name?.charAt(0)?.toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clientName}>{c.name}</Text>
                        <Text style={styles.clientEmail}>{c.email}</Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && (
                          <Ionicons name="checkmark" size={13} color={colors.white} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.footer}>
                <Text style={styles.selectedCount}>
                  {selected.length === 0
                    ? 'No clients selected — saving will unassign everyone'
                    : `${selected.length} client${selected.length !== 1 ? 's' : ''} selected`}
                </Text>
                <View style={styles.footerBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                    <Text style={styles.cancelBtnTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.assignBtn, saving && { opacity: 0.6 }]}
                    onPress={handleAssign}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.assignBtnTxt}>Save Assignment</Text>
                    )}
                  </TouchableOpacity>
                </View>
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
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100, gap: spacing.md,
  },
  title:    { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  subtitle: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  hint: {
    fontSize: fontSize.sm, color: colors.gray500,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.red50, marginHorizontal: spacing.xl,
    padding: spacing.md, borderRadius: borderRadius.sm, marginBottom: spacing.sm,
  },
  errorTxt:  { flex: 1, fontSize: fontSize.sm, color: colors.red700 },
  empty: {
    fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center', padding: spacing.xxxl,
  },
  list:        { flex: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100,
    paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm,
  },
  clientRowSelected: { backgroundColor: colors.gray50 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray200,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSelected:    { backgroundColor: colors.black },
  avatarTxt:         { fontSize: fontSize.md, fontWeight: '700', color: colors.gray700 },
  avatarTxtSelected: { color: colors.white },
  clientName:  { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  clientEmail: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: colors.gray300, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.black, borderColor: colors.black },

  footer: {
    padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.gray100, gap: spacing.md,
  },
  selectedCount: { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center' },
  footerBtns:    { flexDirection: 'row', gap: spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray300, alignItems: 'center',
  },
  cancelBtnTxt: { fontSize: fontSize.md, fontWeight: '500', color: colors.gray700 },
  assignBtn: {
    flex: 2, backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  assignBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
});