import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import AssignPlanModal from '@/components/AssignPlanModal';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface ExerciseLib { id: string; name: string; muscle_group: string | null; }
interface EditEx {
  _key:       string; // local temp key
  exercise_id: string;
  name:        string;
  sets:        number;
  reps:        string;
  rest_seconds: number;
  notes:       string;
  order:       number;
}
interface EditDay {
  _key:      string;
  day_label: string;
  day_order: number;
  exercises: EditEx[];
}
interface EditWeek {
  _key:        string;
  week_number: number;
  days:        EditDay[];
}

const newKey = () => Math.random().toString(36).slice(2);

function planToEditable(weeks: any[]): EditWeek[] {
  return weeks.map((w: any) => ({
    _key:        w.id ?? newKey(),
    week_number: w.week_number,
    days: w.days.map((d: any) => ({
      _key:      d.id ?? newKey(),
      day_label: d.day_label,
      day_order: d.day_order,
      exercises: d.exercises.map((e: any) => ({
        _key:         e.id ?? newKey(),
        exercise_id:  e.exercise_id,
        name:         e.exercise?.name ?? 'Unknown',
        sets:         e.sets,
        reps:         e.reps,
        rest_seconds: e.rest_seconds,
        notes:        e.notes ?? '',
        order:        e.order,
      })),
    })),
  }));
}

function editableToPayload(weeks: EditWeek[], meta: { title: string; goal_focus: string; visibility: string; start_date: string }) {
  return {
    title:      meta.title,
    goal_focus: meta.goal_focus || null,
    visibility: meta.visibility,
    start_date: meta.start_date || null,
    weeks: weeks.map((w, wi) => ({
      week_number: wi + 1,
      days: w.days.map((d, di) => ({
        day_label: d.day_label,
        day_order: di + 1,
        exercises: d.exercises.map((e, ei) => ({
          exercise_id:  e.exercise_id,
          sets:         e.sets,
          reps:         e.reps,
          rest_seconds: e.rest_seconds,
          notes:        e.notes || null,
          order:        ei + 1,
          progression_rule: null,
        })),
      })),
    })),
  };
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router  = useRouter();
  const isNew   = !id;

  // ── Plan data ──
  const [plan,            setPlan]            = useState<any>(null);
  const [assignedClients, setAssignedClients] = useState<{ id: string; name: string }[]>([]);
  const [loading,         setLoading]         = useState(!isNew);
  const [refreshing,      setRefreshing]      = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState('');

  // ── Editable structure ──
  const [editableWeeks, setEditableWeeks] = useState<EditWeek[]>([
    { _key: newKey(), week_number: 1, days: [] },
  ]);
  const [meta, setMeta] = useState({
    title: '', goal_focus: '', visibility: 'draft', start_date: '',
  });

  // ── UI state ──
  const [expandedWeeks,  setExpandedWeeks]  = useState<Set<string>>(new Set());
  const [showMetaModal,  setShowMetaModal]  = useState(false);
  const [showAssign,     setShowAssign]     = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  // ── Exercise picker ──
  const [exLibrary,    setExLibrary]    = useState<ExerciseLib[]>([]);
  const [exSearch,     setExSearch]     = useState('');
  const [pickerTarget, setPickerTarget] = useState<{ weekKey: string; dayKey: string } | null>(null);
  const [showPicker,   setShowPicker]   = useState(false);

  // ── Edit exercise inline ──
  const [editExTarget, setEditExTarget] = useState<{
    weekKey: string; dayKey: string; exKey: string;
  } | null>(null);
  const [editExForm, setEditExForm] = useState<Partial<EditEx>>({});
  const [showEditEx,  setShowEditEx] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadExerciseLibrary();
    if (!isNew && id) loadPlan();
  }, [id]);

  const loadPlan = async () => {
    try {
      const res = await API.get(`/workout-plans/${id}`);
      const data = res.data;
      setPlan(data);
      setAssignedClients(data.assigned_clients ?? []);
      setMeta({
        title:      data.title ?? '',
        goal_focus: data.goal_focus ?? '',
        visibility: data.visibility ?? 'draft',
        start_date: data.start_date ?? '',
      });
      setEditableWeeks(planToEditable(data.weeks ?? []));
      // Auto-expand first week
      if ((data.weeks ?? []).length > 0) {
        setExpandedWeeks(new Set([data.weeks[0].id ?? '']));
      }
    } catch (e) {
      console.error('loadPlan:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    if (isNew) return;
    setRefreshing(true);
    await loadPlan();
    setRefreshing(false);
  };

  const loadExerciseLibrary = async () => {
    try {
      const res = await API.get('/exercises');
      setExLibrary(res.data);
    } catch (e) {
      console.error('loadExerciseLibrary:', e);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!meta.title.trim()) {
      setSaveError('Plan title is required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const payload = editableToPayload(editableWeeks, meta);
      if (isNew) {
        const res = await API.post('/workout-plans', payload);
        router.replace(`/pt/workout-detail?id=${res.data.plan_id}` as any);
      } else {
        await API.put(`/workout-plans/${id}`, payload);
        await loadPlan();
      }
    } catch (e: any) {
      setSaveError(e.response?.data?.detail ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Archive ───────────────────────────────────────────────────────────────
  const handleArchive = async () => {
    try {
      await API.delete(`/workout-plans/${id}`);
      router.back();
    } catch (e) {
      console.error('archive:', e);
    } finally {
      setArchiveConfirm(false);
    }
  };

  // ── Week helpers ──────────────────────────────────────────────────────────
  const addWeek = () => {
    const newWeek: EditWeek = {
      _key: newKey(),
      week_number: editableWeeks.length + 1,
      days: [],
    };
    setEditableWeeks((prev) => [...prev, newWeek]);
    setExpandedWeeks((prev) => new Set([...prev, newWeek._key]));
  };

  const removeWeek = (wKey: string) => {
    setEditableWeeks((prev) => prev.filter((w) => w._key !== wKey));
  };

  const addDay = (wKey: string) => {
    setEditableWeeks((prev) =>
      prev.map((w) => {
        if (w._key !== wKey) return w;
        const newDay: EditDay = {
          _key:      newKey(),
          day_label: `Day ${w.days.length + 1}`,
          day_order: w.days.length + 1,
          exercises: [],
        };
        return { ...w, days: [...w.days, newDay] };
      })
    );
  };

  const removeDay = (wKey: string, dKey: string) => {
    setEditableWeeks((prev) =>
      prev.map((w) =>
        w._key !== wKey ? w : { ...w, days: w.days.filter((d) => d._key !== dKey) }
      )
    );
  };

  const updateDayLabel = (wKey: string, dKey: string, label: string) => {
    setEditableWeeks((prev) =>
      prev.map((w) =>
        w._key !== wKey ? w : {
          ...w,
          days: w.days.map((d) =>
            d._key !== dKey ? d : { ...d, day_label: label }
          ),
        }
      )
    );
  };

  // ── Exercise helpers ──────────────────────────────────────────────────────
  const openPicker = (wKey: string, dKey: string) => {
    setPickerTarget({ weekKey: wKey, dayKey: dKey });
    setExSearch('');
    setShowPicker(true);
  };

  const addExercise = (ex: ExerciseLib) => {
    if (!pickerTarget) return;
    const { weekKey, dayKey } = pickerTarget;
    setEditableWeeks((prev) =>
      prev.map((w) =>
        w._key !== weekKey ? w : {
          ...w,
          days: w.days.map((d) => {
            if (d._key !== dayKey) return d;
            const newEx: EditEx = {
              _key:         newKey(),
              exercise_id:  ex.id,
              name:         ex.name,
              sets:         3,
              reps:         '8-12',
              rest_seconds: 60,
              notes:        '',
              order:        d.exercises.length + 1,
            };
            return { ...d, exercises: [...d.exercises, newEx] };
          }),
        }
      )
    );
    setShowPicker(false);
    setPickerTarget(null);
  };

  const removeExercise = (wKey: string, dKey: string, eKey: string) => {
    setEditableWeeks((prev) =>
      prev.map((w) =>
        w._key !== wKey ? w : {
          ...w,
          days: w.days.map((d) =>
            d._key !== dKey ? d : {
              ...d,
              exercises: d.exercises.filter((e) => e._key !== eKey),
            }
          ),
        }
      )
    );
  };

  const openEditEx = (wKey: string, dKey: string, ex: EditEx) => {
    setEditExTarget({ weekKey: wKey, dayKey: dKey, exKey: ex._key });
    setEditExForm({
      sets:         ex.sets,
      reps:         ex.reps,
      rest_seconds: ex.rest_seconds,
      notes:        ex.notes,
    });
    setShowEditEx(true);
  };

  const saveEditEx = () => {
    if (!editExTarget) return;
    const { weekKey, dayKey, exKey } = editExTarget;
    setEditableWeeks((prev) =>
      prev.map((w) =>
        w._key !== weekKey ? w : {
          ...w,
          days: w.days.map((d) =>
            d._key !== dayKey ? d : {
              ...d,
              exercises: d.exercises.map((e) =>
                e._key !== exKey ? e : {
                  ...e,
                  sets:         Number(editExForm.sets) || e.sets,
                  reps:         editExForm.reps ?? e.reps,
                  rest_seconds: Number(editExForm.rest_seconds) || e.rest_seconds,
                  notes:        editExForm.notes ?? e.notes,
                }
              ),
            }
          ),
        }
      )
    );
    setShowEditEx(false);
    setEditExTarget(null);
  };

  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filteredExercises = exLibrary.filter((e) =>
    e.name.toLowerCase().includes(exSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.black} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const visibilityLabel = meta.visibility === 'client_visible' ? 'Visible to clients' : 'Draft';
  const visibilityColor = meta.visibility === 'client_visible' ? colors.green700 : colors.gray400;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {meta.title || 'New Plan'}
        </Text>
        <View style={styles.topBarRight}>
          {!isNew && (
            <TouchableOpacity
              style={styles.topBtn}
              onPress={() => setArchiveConfirm(true)}
            >
              <Ionicons name="archive-outline" size={20} color={colors.red500} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setShowMetaModal(true)}
          >
            <Ionicons name="settings-outline" size={20} color={colors.black} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Plan info summary ── */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>{meta.title || '(No title)'}</Text>
              {meta.goal_focus ? (
                <Text style={styles.infoGoal}>{meta.goal_focus}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.editMetaBtn}
              onPress={() => setShowMetaModal(true)}
            >
              <Ionicons name="pencil-outline" size={15} color={colors.gray600} />
              <Text style={styles.editMetaBtnTxt}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoTagRow}>
            <View style={[styles.infoTag, { borderColor: visibilityColor }]}>
              <Text style={[styles.infoTagTxt, { color: visibilityColor }]}>
                {visibilityLabel}
              </Text>
            </View>
            {meta.start_date ? (
              <View style={styles.infoTag}>
                <Text style={styles.infoTagTxt}>Starts {meta.start_date}</Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* ── Assigned clients ── */}
        <Card style={styles.clientsCard}>
          <View style={styles.clientsHeader}>
            <View>
              <Text style={styles.clientsTitle}>Assigned Clients</Text>
              <Text style={styles.clientsCount}>
                {assignedClients.length === 0
                  ? 'No clients assigned yet'
                  : `${assignedClients.length} client${assignedClients.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
            {!isNew && (
              <TouchableOpacity
                style={styles.manageClientsBtn}
                onPress={() => setShowAssign(true)}
              >
                <Ionicons name="people-outline" size={15} color={colors.white} />
                <Text style={styles.manageClientsBtnTxt}>Manage Clients</Text>
              </TouchableOpacity>
            )}
          </View>
          {assignedClients.length > 0 && (
            <View style={styles.clientPills}>
              {assignedClients.map((c) => (
                <View key={c.id} style={styles.clientPill}>
                  <View style={styles.clientPillAvatar}>
                    <Text style={styles.clientPillAvatarTxt}>
                      {c.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.clientPillName}>{c.name}</Text>
                </View>
              ))}
            </View>
          )}
          {isNew && (
            <Text style={styles.newPlanHint}>
              Save the plan first, then you can assign it to clients.
            </Text>
          )}
        </Card>

        {/* ── Workout structure ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Plan Structure</Text>
          <TouchableOpacity style={styles.addWeekBtn} onPress={addWeek}>
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.addWeekBtnTxt}>Add Week</Text>
          </TouchableOpacity>
        </View>

        {editableWeeks.length === 0 ? (
          <View style={styles.emptyPlan}>
            <Ionicons name="barbell-outline" size={40} color={colors.gray300} />
            <Text style={styles.emptyPlanTxt}>Tap "Add Week" to start building your plan.</Text>
          </View>
        ) : (
          editableWeeks.map((week, wIdx) => {
            const isExpanded = expandedWeeks.has(week._key);
            return (
              <View key={week._key} style={styles.weekBlock}>
                {/* Week header */}
                <View style={styles.weekHeader}>
                  <TouchableOpacity
                    style={styles.weekToggle}
                    onPress={() => toggleWeek(week._key)}
                  >
                    <Ionicons
                      name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                      size={16}
                      color={colors.white}
                    />
                    <Text style={styles.weekLabel}>Week {wIdx + 1}</Text>
                    <Text style={styles.weekMeta}>
                      {week.days.length} day{week.days.length !== 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.weekActions}>
                    <TouchableOpacity
                      style={styles.weekActionBtn}
                      onPress={() => addDay(week._key)}
                    >
                      <Ionicons name="add" size={16} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.weekActionBtn, { backgroundColor: colors.red700 }]}
                      onPress={() => removeWeek(week._key)}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Days */}
                {isExpanded && (
                  <View style={styles.daysContainer}>
                    {week.days.length === 0 ? (
                      <TouchableOpacity
                        style={styles.emptyDay}
                        onPress={() => addDay(week._key)}
                      >
                        <Ionicons name="add-circle-outline" size={20} color={colors.gray400} />
                        <Text style={styles.emptyDayTxt}>Tap to add a day</Text>
                      </TouchableOpacity>
                    ) : (
                      week.days.map((day, dIdx) => (
                        <Card key={day._key} style={styles.dayCard}>
                          {/* Day header row */}
                          <View style={styles.dayHeader}>
                            <TextInput
                              style={styles.dayLabelInput}
                              value={day.day_label}
                              onChangeText={(v) =>
                                updateDayLabel(week._key, day._key, v)
                              }
                              placeholder="Day name (e.g. Push Day)"
                              placeholderTextColor={colors.gray400}
                            />
                            <TouchableOpacity
                              onPress={() => removeDay(week._key, day._key)}
                              style={styles.removeDayBtn}
                            >
                              <Ionicons name="close-circle" size={18} color={colors.red500} />
                            </TouchableOpacity>
                          </View>

                          {/* Exercise rows */}
                          {day.exercises.map((ex, eIdx) => (
                            <View key={ex._key} style={styles.exerciseRow}>
                              <View style={styles.exerciseNumBadge}>
                                <Text style={styles.exerciseNumTxt}>{eIdx + 1}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.exerciseName}>{ex.name}</Text>
                                <Text style={styles.exerciseMeta}>
                                  {ex.sets} × {ex.reps} · {ex.rest_seconds}s rest
                                </Text>
                                {ex.notes ? (
                                  <Text style={styles.exerciseNotes}>{ex.notes}</Text>
                                ) : null}
                              </View>
                              <View style={styles.exActions}>
                                <TouchableOpacity
                                  onPress={() => openEditEx(week._key, day._key, ex)}
                                >
                                  <Ionicons name="pencil-outline" size={16} color={colors.gray500} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => removeExercise(week._key, day._key, ex._key)}
                                >
                                  <Ionicons name="close" size={16} color={colors.red500} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}

                          {/* Add exercise */}
                          <TouchableOpacity
                            style={styles.addExBtn}
                            onPress={() => openPicker(week._key, day._key)}
                          >
                            <Ionicons name="add-circle-outline" size={15} color={colors.gray500} />
                            <Text style={styles.addExBtnTxt}>Add Exercise</Text>
                          </TouchableOpacity>
                        </Card>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* ── Save error ── */}
        {saveError ? (
          <View style={styles.saveError}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.red700} />
            <Text style={styles.saveErrorTxt}>{saveError}</Text>
          </View>
        ) : null}

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.saveBtnTxt}>
                {isNew ? 'Create Plan' : 'Save Changes'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Plan metadata modal ── */}
      <Modal visible={showMetaModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Plan Settings</Text>
              <TouchableOpacity onPress={() => setShowMetaModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={meta.title}
                onChangeText={(v) => setMeta((m) => ({ ...m, title: v }))}
                placeholder="e.g. 10-Week Hypertrophy Programme"
                placeholderTextColor={colors.gray400}
                autoFocus
              />
              <Text style={styles.fieldLabel}>Goal Focus</Text>
              <TextInput
                style={styles.input}
                value={meta.goal_focus}
                onChangeText={(v) => setMeta((m) => ({ ...m, goal_focus: v }))}
                placeholder="e.g. Build muscle, Lose fat"
                placeholderTextColor={colors.gray400}
              />
              <Text style={styles.fieldLabel}>Start Date</Text>
              <TextInput
                style={styles.input}
                value={meta.start_date}
                onChangeText={(v) => setMeta((m) => ({ ...m, start_date: v }))}
                placeholder="YYYY-MM-DD (optional)"
                placeholderTextColor={colors.gray400}
              />
              <Text style={styles.fieldLabel}>Visibility</Text>
              <View style={styles.visRow}>
                {[
                  { value: 'draft',          label: 'Draft',    icon: 'eye-off-outline' as const,   desc: 'Only you can see this' },
                  { value: 'client_visible', label: 'Visible',  icon: 'eye-outline' as const,       desc: 'Clients can see this' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.visOption, meta.visibility === opt.value && styles.visOptionActive]}
                    onPress={() => setMeta((m) => ({ ...m, visibility: opt.value }))}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={meta.visibility === opt.value ? colors.white : colors.gray500}
                    />
                    <Text style={[styles.visLabel, meta.visibility === opt.value && styles.visLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.visDesc, meta.visibility === opt.value && { color: 'rgba(255,255,255,0.7)' }]}>
                      {opt.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => setShowMetaModal(false)}
              >
                <Text style={styles.modalSaveBtnTxt}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Exercise picker modal ── */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pick Exercise</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={colors.gray400} />
              <TextInput
                style={styles.searchInput}
                value={exSearch}
                onChangeText={setExSearch}
                placeholder="Search exercises..."
                placeholderTextColor={colors.gray400}
                autoFocus
              />
            </View>
            <ScrollView style={styles.modalBody}>
              {filteredExercises.length === 0 ? (
                <Text style={styles.emptyPickerTxt}>
                  {exSearch ? 'No exercises match your search.' : 'No exercises in your library yet.'}
                </Text>
              ) : (
                filteredExercises.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={styles.exPickerRow}
                    onPress={() => addExercise(ex)}
                  >
                    <View style={styles.exPickerIcon}>
                      <Ionicons name="barbell-outline" size={18} color={colors.gray500} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exPickerName}>{ex.name}</Text>
                      {ex.muscle_group ? (
                        <Text style={styles.exPickerMuscle}>{ex.muscle_group}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={colors.black} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Edit exercise modal ── */}
      <Modal visible={showEditEx} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Exercise</Text>
              <TouchableOpacity onPress={() => setShowEditEx(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.fieldLabel}>Sets</Text>
              <TextInput
                style={styles.input}
                value={String(editExForm.sets ?? '')}
                onChangeText={(v) => setEditExForm((f) => ({ ...f, sets: parseInt(v) || 0 }))}
                keyboardType="number-pad"
                placeholderTextColor={colors.gray400}
              />
              <Text style={styles.fieldLabel}>Reps</Text>
              <TextInput
                style={styles.input}
                value={editExForm.reps ?? ''}
                onChangeText={(v) => setEditExForm((f) => ({ ...f, reps: v }))}
                placeholder="e.g. 8-12 or 10"
                placeholderTextColor={colors.gray400}
              />
              <Text style={styles.fieldLabel}>Rest (seconds)</Text>
              <TextInput
                style={styles.input}
                value={String(editExForm.rest_seconds ?? '')}
                onChangeText={(v) => setEditExForm((f) => ({ ...f, rest_seconds: parseInt(v) || 0 }))}
                keyboardType="number-pad"
                placeholderTextColor={colors.gray400}
              />
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={editExForm.notes ?? ''}
                onChangeText={(v) => setEditExForm((f) => ({ ...f, notes: v }))}
                placeholder="Coaching cues, tempo, etc."
                placeholderTextColor={colors.gray400}
                multiline
              />
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveEditEx}>
                <Text style={styles.modalSaveBtnTxt}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Archive confirmation modal (no Alert.alert) ── */}
      <Modal visible={archiveConfirm} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Ionicons name="archive-outline" size={32} color={colors.red500} style={{ marginBottom: spacing.md }} />
            <Text style={styles.confirmTitle}>Archive Plan?</Text>
            <Text style={styles.confirmMsg}>
              "{meta.title}" will be hidden from clients but can be restored by your developer.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setArchiveConfirm(false)}
              >
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDo} onPress={handleArchive}>
                <Text style={styles.confirmDoTxt}>Archive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Assign modal ── */}
      {!isNew && (
        <AssignPlanModal
          visible={showAssign}
          planId={id ?? ''}
          planTitle={meta.title}
          onClose={() => setShowAssign(false)}
          onSuccess={(count, assignedClients) => {
            setAssignedClients(assignedClients);
            setShowAssign(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll:    { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
    gap: spacing.md,
  },
  backBtn:     { width: 36, alignItems: 'center' },
  topBarTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  topBarRight: { flexDirection: 'row', gap: spacing.sm },
  topBtn:      { padding: spacing.sm },

  // Info card
  infoCard: { marginBottom: spacing.lg },
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  infoTitle:{ fontSize: fontSize.xl, fontWeight: '700', color: colors.black, flex: 1 },
  infoGoal: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 4 },
  editMetaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.gray100, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
  },
  editMetaBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray600 },
  infoTagRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoTag: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.gray200,
  },
  infoTagTxt: { fontSize: fontSize.xs, fontWeight: '500', color: colors.gray500 },

  // Clients card
  clientsCard:   { marginBottom: spacing.lg },
  clientsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md },
  clientsTitle:  { fontSize: fontSize.md, fontWeight: '700', color: colors.black },
  clientsCount:  { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  manageClientsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.black, paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm,
  },
  manageClientsBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },
  clientPills:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  clientPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.gray50, paddingRight: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.gray200,
  },
  clientPillAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
  },
  clientPillAvatarTxt: { fontSize: fontSize.xs, fontWeight: '700', color: colors.white },
  clientPillName:      { fontSize: fontSize.xs, fontWeight: '500', color: colors.gray700 },
  newPlanHint: {
    fontSize: fontSize.xs, color: colors.gray400,
    fontStyle: 'italic', textAlign: 'center',
  },

  // Plan structure
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  addWeekBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.black, paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2, borderRadius: borderRadius.sm,
  },
  addWeekBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },
  emptyPlan: {
    alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray200, marginBottom: spacing.lg,
  },
  emptyPlanTxt: { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },

  // Week
  weekBlock:  { marginBottom: spacing.md },
  weekHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.black, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  weekToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekLabel:  { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
  weekMeta:   { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.5)', marginLeft: spacing.sm },
  weekActions:  { flexDirection: 'row', gap: spacing.sm },
  weekActionBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  daysContainer: {
    borderLeftWidth: 2, borderLeftColor: colors.gray200,
    marginLeft: spacing.lg, paddingLeft: spacing.md,
    paddingTop: spacing.sm,
  },
  emptyDay: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.lg, justifyContent: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gray300,
    marginBottom: spacing.sm,
  },
  emptyDayTxt: { fontSize: fontSize.sm, color: colors.gray400 },

  // Day card
  dayCard:   { marginBottom: spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  dayLabelInput: {
    flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.black,
    borderBottomWidth: 1, borderBottomColor: colors.gray200, paddingBottom: spacing.xs,
    marginRight: spacing.sm,
  },
  removeDayBtn: { padding: spacing.xs },

  // Exercise row
  exerciseRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: spacing.sm, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  exerciseNumBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  exerciseNumTxt:  { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray600 },
  exerciseName:    { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  exerciseMeta:    { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  exerciseNotes:   { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2, fontStyle: 'italic' },
  exActions:       { flexDirection: 'row', gap: spacing.md, padding: spacing.xs },

  addExBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.gray100,
  },
  addExBtnTxt: { fontSize: fontSize.sm, color: colors.gray500, fontWeight: '500' },

  // Save
  saveError: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.red50, padding: spacing.md,
    borderRadius: borderRadius.sm, marginBottom: spacing.md,
  },
  saveErrorTxt: { flex: 1, fontSize: fontSize.sm, color: colors.red700 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.black,
    borderRadius: borderRadius.md, paddingVertical: spacing.lg + 2,
    marginTop: spacing.lg,
  },
  saveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalBody:  { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  fieldLabel: {
    fontSize: fontSize.sm, fontWeight: '600', color: colors.gray700,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    padding: spacing.md, fontSize: fontSize.md, color: colors.black,
  },
  modalSaveBtn: {
    backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl,
  },
  modalSaveBtnTxt: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },

  // Visibility selector
  visRow:       { flexDirection: 'row', gap: spacing.md },
  visOption: {
    flex: 1, padding: spacing.lg, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.gray200, alignItems: 'center', gap: spacing.xs,
  },
  visOptionActive: { backgroundColor: colors.black, borderColor: colors.black },
  visLabel:        { fontSize: fontSize.sm, fontWeight: '700', color: colors.gray700 },
  visLabelActive:  { color: colors.white },
  visDesc:         { fontSize: fontSize.xs, color: colors.gray400, textAlign: 'center' },

  // Exercise picker
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginVertical: spacing.md,
    backgroundColor: colors.gray50, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: colors.gray200, paddingHorizontal: spacing.md, height: 40,
  },
  searchInput:      { flex: 1, fontSize: fontSize.md, color: colors.black },
  emptyPickerTxt: {
    textAlign: 'center', color: colors.gray400,
    fontSize: fontSize.sm, padding: spacing.xxxl,
  },
  exPickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  exPickerIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  exPickerName:   { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  exPickerMuscle: { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2, textTransform: 'capitalize' },

  // Archive / confirm
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBox: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.xxl, width: '82%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  confirmTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.black, marginBottom: spacing.sm },
  confirmMsg: {
    fontSize: fontSize.sm, color: colors.gray600,
    textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl,
  },
  confirmBtns:      { flexDirection: 'row', gap: spacing.md, width: '100%' },
  confirmCancel: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    borderWidth: 1.5, borderColor: colors.gray200, alignItems: 'center',
  },
  confirmCancelTxt: { fontSize: fontSize.md, fontWeight: '500', color: colors.gray700 },
  confirmDo: {
    flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.sm,
    backgroundColor: colors.red500, alignItems: 'center',
  },
  confirmDoTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});