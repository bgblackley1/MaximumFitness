import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import LoadingScreen from '@/components/LoadingScreen';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

// ── Constants: exact copy from add-client.tsx ─────────────────────────────────

const HEALTH_GROUPS: { label: string; conditions: string[] }[] = [
  { label: 'CV / Blood',       conditions: ['Hyper/Hypotension','Angina','Heart Attacks','Anaemia','Blood Clots','Varicose Veins'] },
  { label: 'Respiratory',      conditions: ['Asthma','Respiratory Infections'] },
  { label: 'Musculo-Skeletal', conditions: ['Joint Problems','Recent Fractures','Ligament Sprains','Muscle Strains'] },
  { label: 'Nervous System',   conditions: ['Stroke','Sciatica','Sleep Disorders','Stress Issues'] },
  { label: 'Endocrine',        conditions: ['Hypothyroidism','Hyperthyroidism','Diabetes Type 1','Diabetes Type 2'] },
  { label: 'Digestive',        conditions: ["IBS","Digestive Intolerances","Crohn's Disease","Toileting Issues"] },
  { label: 'Urinary',          conditions: ['Cystitis','Urinary Infections','Kidney Stones','Urination Issues'] },
];

const PLAN_TYPES = ['Monthly', 'Quarterly', '6 Month', 'Annual', 'Pay As You Go', 'Custom'];

const FOCUS_LABELS: Record<string, string> = {
  arms: 'Arms', legs: 'Legs', push: 'Push', pull: 'Pull',
  back: 'Back', chest: 'Chest', core: 'Core', full_body: 'Full Body', cardio: 'Cardio',
};

// ── Notes parser: extracts individual fields back out of the compiled notes ───

const getField = (notes: string, prefix: string): string => {
  const m = notes.match(new RegExp(`^${prefix.replace(/[/]/g, '\\/')}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim() : '';
};

const parseClientNotes = (notes: string) => {
  if (!notes) {
    return {
      dob: '', phone: '', address: '',
      drugHistory: '', smokingHistory: '', physicalAppearance: '',
      selectedConditions: [] as string[],
      employmentStatus: '', gymMembership: '', gymFrequency: '',
      eatsOut: '', sportingBg: '', religiousBeliefs: '',
      hasChildren: '', hasPets: '',
      isVegetarian: '', dietRegimes: '', dietaryReligious: '',
      allergies: '', dietaryIntolerances: '',
    };
  }

  // Health conditions: single comma-separated line after section header
  const condMatch = notes.match(/── HEALTH CONDITIONS ──\n([^\n─]+)/);
  const selectedConditions: string[] = condMatch
    ? condMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // Gym membership (may have frequency in parens)
  const gymMatch = notes.match(/Gym Membership:\s*(Yes|No)(?:\s*\((\d+)x per week\))?/);

  return {
    dob:                getField(notes, 'DOB'),
    phone:              getField(notes, 'Phone'),
    address:            getField(notes, 'Address'),
    drugHistory:        getField(notes, 'Drug\\/Prescribed Meds'),
    smokingHistory:     getField(notes, 'Smoking History'),
    physicalAppearance: getField(notes, 'Physical Appearance'),
    selectedConditions,
    employmentStatus:   getField(notes, 'Employment'),
    gymMembership:      gymMatch ? gymMatch[1] : '',
    gymFrequency:       gymMatch && gymMatch[2] ? gymMatch[2] : '',
    eatsOut:            getField(notes, 'Eats Out'),
    sportingBg:         getField(notes, 'Sporting Background'),
    religiousBeliefs:   getField(notes, 'Religious Beliefs'),
    hasChildren:        getField(notes, 'Children'),
    hasPets:            getField(notes, 'Pets'),
    isVegetarian:       getField(notes, 'Vegetarian'),
    dietRegimes:        getField(notes, 'Diet Regimes'),
    dietaryReligious:   getField(notes, 'Dietary Religious Impact'),
    allergies:          getField(notes, 'Allergies'),
    dietaryIntolerances: getField(notes, 'Intolerances'),
  };
};

// goals stored as ["Short term: ...", "Long term: ..."]
const parseGoals = (goals: string[]) => ({
  shortTerm: goals.find((g) => g.startsWith('Short term: '))?.replace('Short term: ', '') ?? '',
  longTerm:  goals.find((g) => g.startsWith('Long term: '))?.replace('Long term: ', '') ?? '',
});

// ── ChipGroup: exact copy from add-client.tsx ─────────────────────────────────

function ChipGroup<T extends string>({
  options, value, onChange, multi = false,
}: {
  options: string[];
  value: T | T[];
  onChange: (v: any) => void;
  multi?: boolean;
}) {
  const isSelected = (o: string) =>
    multi ? (value as string[]).includes(o) : value === o;

  const handlePress = (o: string) => {
    if (multi) {
      const arr = value as string[];
      onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    } else {
      onChange(value === o ? '' : o);
    }
  };

  return (
    <View style={cg.row}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          style={[cg.chip, isSelected(o) && cg.chipActive]}
          onPress={() => handlePress(o)}
          activeOpacity={0.7}
        >
          <Text style={[cg.chipTxt, isSelected(o) && cg.chipTxtActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const cg = StyleSheet.create({
  row:          { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip:         { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.gray200, backgroundColor: colors.white },
  chipActive:   { backgroundColor: colors.black, borderColor: colors.black },
  chipTxt:      { fontSize: fontSize.sm, color: colors.gray600, fontWeight: '500' },
  chipTxtActive:{ color: colors.white },
});

// ── Section header: exact style from add-client.tsx ───────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
    </View>
  );
}
const sec = StyleSheet.create({
  wrap:  { marginTop: spacing.xxl, marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray200, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.sm, fontWeight: '700', color: colors.black, letterSpacing: 0.6, textTransform: 'uppercase' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [client,           setClient]           = useState<any>(null);
  const [measurements,     setMeasurements]     = useState<any[]>([]);
  const [goals,            setGoals]            = useState<any[]>([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState<any[]>([]);
  const [allWorkouts,      setAllWorkouts]      = useState<any[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);

  // ── Edit modal state ── mirrors add-client.tsx form exactly ──────────────
  const [editModal,    setEditModal]    = useState(false);
  const [savingClient, setSavingClient] = useState(false);

  // Section 1: Basic Info
  const [efName,    setEFName]    = useState('');
  const [efSex,     setEFSex]     = useState('');
  const [efDob,     setEFDob]     = useState('');
  const [efAge,     setEFAge]     = useState('');
  const [efPhone,   setEFPhone]   = useState('');
  const [efAddress, setEFAddress] = useState('');
  // Section 2: Historical
  const [efDrugHistory,        setEFDrugHistory]        = useState('');
  const [efSmokingHistory,     setEFSmokingHistory]     = useState('');
  const [efPhysicalAppearance, setEFPhysicalAppearance] = useState('');
  // Section 3: Health conditions (maps to injuries[])
  const [efConditions, setEFConditions] = useState<string[]>([]);
  // Section 4: Anthropometric
  const [efHeightCm, setEFHeightCm] = useState('');
  const [efWeightKg, setEFWeightKg] = useState('');
  // Section 5: Socio-Economic
  const [efEmployment,    setEFEmployment]    = useState('');
  const [efGymMembership, setEFGymMembership] = useState('');
  const [efGymFrequency,  setEFGymFrequency]  = useState('');
  const [efEatsOut,       setEFEatsOut]       = useState('');
  const [efSportingBg,    setEFSportingBg]    = useState('');
  const [efReligious,     setEFReligious]     = useState('');
  const [efChildren,      setEFChildren]      = useState('');
  const [efPets,          setEFPets]          = useState('');
  // Section 6: Goals (maps to goals[])
  const [efShortGoals, setEFShortGoals] = useState('');
  const [efLongGoals,  setEFLongGoals]  = useState('');
  // Section 7: Dietary
  const [efVegetarian,    setEFVegetarian]    = useState('');
  const [efDietRegimes,   setEFDietRegimes]   = useState('');
  const [efDietReligious, setEFDietReligious] = useState('');
  const [efAllergies,     setEFAllergies]     = useState('');
  const [efIntolerances,  setEFIntolerances]  = useState('');
  // Additional (not in add-client but in DB)
  const [efStatus,   setEFStatus]   = useState('active');
  const [efPlanType, setEFPlanType] = useState('');

  // ── Goal status update ────────────────────────────────────────────────────
  const [updatingGoal, setUpdatingGoal] = useState<string | null>(null);

  // ── Measurement modal ─────────────────────────────────────────────────────
  const [mModal,  setMModal]  = useState(false);
  const [mSaving, setMSaving] = useState(false);
  const [mForm, setMForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weight_kg: '', chest_cm: '', waist_cm: '',
    left_arm_cm: '', right_arm_cm: '', thigh_cm: '', hips_cm: '', notes: '',
  });

  // ── Goal add modal ────────────────────────────────────────────────────────
  const [gModal,  setGModal]  = useState(false);
  const [gSaving, setGSaving] = useState(false);
  const [gForm, setGForm] = useState({
    description: '', type: 'weight', target_value: '',
    target_unit: 'kg', target_date: '', current_value: '',
  });

  // ── Workout assignment modal ──────────────────────────────────────────────
  const [workoutModal,       setWorkoutModal]       = useState(false);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<string[]>([]);
  const [savingWorkouts,     setSavingWorkouts]     = useState(false);

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [cR, mR, gR, awR, wR] = await Promise.allSettled([
        API.get(`/clients/${id}`),
        API.get(`/clients/${id}/measurements`),
        API.get(`/clients/${id}/goals`),
        API.get('/workout-plans', { params: { client_id: id } }),
        API.get('/workout-plans', { params: { status: 'active' } }),
      ]);
      if (cR.status === 'fulfilled') setClient(cR.value.data);
      if (mR.status === 'fulfilled') setMeasurements(mR.value.data);
      if (gR.status === 'fulfilled') setGoals(gR.value.data);
      if (awR.status === 'fulfilled') {
        const aw = awR.value.data;
        setAssignedWorkouts(aw);
        setSelectedWorkoutIds(aw.map((w: any) => w.id));
      }
      if (wR.status === 'fulfilled') setAllWorkouts(wR.value.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleBack = () => router.navigate('/pt/clients' as any);

  // ── Pre-populate edit form from existing client data ──────────────────────
  const openEditClient = () => {
    if (!client) return;

    const parsed = parseClientNotes(client.notes ?? '');
    const { shortTerm, longTerm } = parseGoals(client.goals ?? []);

    setEFName(client.name ?? '');
    setEFSex(client.sex ?? '');
    setEFDob(parsed.dob);
    setEFAge(client.age != null ? String(client.age) : '');
    // phone: prefer DB User.phone, fall back to parsed notes Phone field
    setEFPhone(client.phone ?? parsed.phone ?? '');
    setEFAddress(parsed.address);
    setEFDrugHistory(parsed.drugHistory);
    setEFSmokingHistory(parsed.smokingHistory);
    setEFPhysicalAppearance(parsed.physicalAppearance);
    // injuries[] stores the raw conditions from the health history checkboxes
    setEFConditions(
      Array.isArray(client.injuries) && client.injuries.length > 0
        ? [...client.injuries]
        : parsed.selectedConditions
    );
    setEFHeightCm(client.height_cm != null ? String(client.height_cm) : '');
    setEFWeightKg(client.starting_weight_kg != null ? String(client.starting_weight_kg) : '');
    setEFEmployment(parsed.employmentStatus);
    setEFGymMembership(parsed.gymMembership);
    setEFGymFrequency(parsed.gymFrequency);
    setEFEatsOut(parsed.eatsOut);
    setEFSportingBg(parsed.sportingBg);
    setEFReligious(parsed.religiousBeliefs);
    setEFChildren(parsed.hasChildren);
    setEFPets(parsed.hasPets);
    setEFShortGoals(shortTerm);
    setEFLongGoals(longTerm);
    setEFVegetarian(parsed.isVegetarian);
    setEFDietRegimes(parsed.dietRegimes);
    setEFDietReligious(parsed.dietaryReligious);
    setEFAllergies(parsed.allergies);
    setEFIntolerances(parsed.dietaryIntolerances);
    setEFStatus(client.status ?? 'active');
    setEFPlanType(client.plan_type ?? '');

    setEditModal(true);
  };

  // ── Build notes string — exact same logic as add-client.tsx buildNotes() ──
  const buildNotes = (): string => {
    const lines: string[] = [];

    if (efDob)     lines.push(`DOB: ${efDob}`);
    if (efPhone)   lines.push(`Phone: ${efPhone}`);
    if (efAddress) lines.push(`Address: ${efAddress}`);

    const hasHistory = efDrugHistory || efSmokingHistory || efPhysicalAppearance;
    if (hasHistory) {
      lines.push('', '── HISTORICAL INFORMATION ──');
      if (efDrugHistory)        lines.push(`Drug/Prescribed Meds: ${efDrugHistory}`);
      if (efSmokingHistory)     lines.push(`Smoking History: ${efSmokingHistory}`);
      if (efPhysicalAppearance) lines.push(`Physical Appearance: ${efPhysicalAppearance}`);
    }

    if (efConditions.length > 0) {
      lines.push('', '── HEALTH CONDITIONS ──');
      lines.push(efConditions.join(', '));
    }

    const hasSocio = efEmployment || efGymMembership || efEatsOut ||
                     efSportingBg || efReligious || efChildren || efPets;
    if (hasSocio) {
      lines.push('', '── SOCIO-ECONOMIC ──');
      if (efEmployment) lines.push(`Employment: ${efEmployment}`);
      if (efGymMembership) {
        const freq = efGymMembership === 'Yes' && efGymFrequency
          ? ` (${efGymFrequency}x per week)` : '';
        lines.push(`Gym Membership: ${efGymMembership}${freq}`);
      }
      if (efEatsOut)   lines.push(`Eats Out: ${efEatsOut}`);
      if (efSportingBg) lines.push(`Sporting Background: ${efSportingBg}`);
      if (efReligious)  lines.push(`Religious Beliefs: ${efReligious}`);
      if (efChildren)   lines.push(`Children: ${efChildren}`);
      if (efPets)       lines.push(`Pets: ${efPets}`);
    }

    const hasDietary = efVegetarian || efDietRegimes || efDietReligious ||
                       efAllergies || efIntolerances;
    if (hasDietary) {
      lines.push('', '── DIETARY ──');
      if (efVegetarian)    lines.push(`Vegetarian: ${efVegetarian}`);
      if (efDietRegimes)   lines.push(`Diet Regimes: ${efDietRegimes}`);
      if (efDietReligious) lines.push(`Dietary Religious Impact: ${efDietReligious}`);
      if (efAllergies)     lines.push(`Allergies: ${efAllergies}`);
      if (efIntolerances)  lines.push(`Intolerances: ${efIntolerances}`);
    }

    return lines.join('\n').trim();
  };

  // ── Save edit ─────────────────────────────────────────────────────────────
  const handleSaveClient = async () => {
    if (!efName.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSavingClient(true);
    try {
      // Goals array — same format as add-client.tsx
      const goalsArr: string[] = [];
      if (efShortGoals) goalsArr.push(`Short term: ${efShortGoals}`);
      if (efLongGoals)  goalsArr.push(`Long term: ${efLongGoals}`);

      const payload: Record<string, any> = {
        name:     efName.trim(),
        goals:    goalsArr,
        injuries: efConditions,        // health conditions → injuries[]
        notes:    buildNotes() || null,
        status:   efStatus,
      };

      if (efPhone.trim())   payload.phone              = efPhone.trim();
      if (efAge)            payload.age                = parseInt(efAge);
      if (efSex)            payload.sex                = efSex;
      if (efHeightCm)       payload.height_cm          = parseFloat(efHeightCm);
      if (efWeightKg)       payload.starting_weight_kg = parseFloat(efWeightKg);
      if (efPlanType.trim()) payload.plan_type         = efPlanType.trim();

      const res = await API.put(`/clients/${id}`, payload);
      setClient((prev: any) => ({ ...prev, ...res.data }));
      setEditModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update client');
    } finally {
      setSavingClient(false);
    }
  };

  // ── Goal status update ────────────────────────────────────────────────────
  const updateGoalStatus = async (
    goalId: string,
    newStatus: 'achieved' | 'abandoned' | 'in_progress',
  ) => {
    setUpdatingGoal(goalId);
    try {
      const res = await API.put(`/clients/${id}/goals/${goalId}`, { status: newStatus });
      setGoals((prev) => prev.map((g) => (g.id === goalId ? res.data : g)));
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to update goal');
    } finally {
      setUpdatingGoal(null);
    }
  };

  // ── Measurement save ──────────────────────────────────────────────────────
  const saveMeasurement = async () => {
    if (!mForm.date) { Alert.alert('Error', 'Date is required'); return; }
    setMSaving(true);
    try {
      const payload: any = { date: mForm.date };
      ['weight_kg','chest_cm','waist_cm','left_arm_cm','right_arm_cm','thigh_cm','hips_cm']
        .forEach((k) => {
          const v = (mForm as any)[k];
          if (v !== '') payload[k] = parseFloat(v);
        });
      if (mForm.notes) payload.notes = mForm.notes;
      const res = await API.post(`/clients/${id}/measurements`, payload);
      setMeasurements((prev) => [res.data, ...prev]);
      setMModal(false);
      setMForm({ date: new Date().toISOString().split('T')[0], weight_kg: '',
        chest_cm: '', waist_cm: '', left_arm_cm: '', right_arm_cm: '',
        thigh_cm: '', hips_cm: '', notes: '' });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally { setMSaving(false); }
  };

  // ── Goal save ─────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    if (!gForm.description || !gForm.target_value) {
      Alert.alert('Error', 'Description and target value are required'); return;
    }
    setGSaving(true);
    try {
      const payload: any = {
        description: gForm.description, type: gForm.type,
        target_value: parseFloat(gForm.target_value), target_unit: gForm.target_unit,
      };
      if (gForm.target_date)   payload.target_date   = gForm.target_date;
      if (gForm.current_value) payload.current_value = parseFloat(gForm.current_value);
      const res = await API.post(`/clients/${id}/goals`, payload);
      setGoals((prev) => [res.data, ...prev]);
      setGModal(false);
      setGForm({ description: '', type: 'weight', target_value: '',
        target_unit: 'kg', target_date: '', current_value: '' });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally { setGSaving(false); }
  };

  // ── Workout assignment ────────────────────────────────────────────────────
  const saveWorkoutAssignments = async () => {
    setSavingWorkouts(true);
    try {
      await API.put(`/workout-plans/assignments/by-client/${id}`,
        { workout_ids: selectedWorkoutIds });
      const res = await API.get('/workout-plans', { params: { client_id: id } });
      setAssignedWorkouts(res.data);
      setWorkoutModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save');
    } finally { setSavingWorkouts(false); }
  };

  const openWorkoutModal = () => {
    setSelectedWorkoutIds(assignedWorkouts.map((w) => w.id));
    setWorkoutModal(true);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <LoadingScreen />;
  if (!client) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>Client not found.</Text>
      </SafeAreaView>
    );
  }

  // Display goals that are the short/long-term strings
  const { shortTerm: displayShort, longTerm: displayLong } = parseGoals(client.goals ?? []);

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Client Profile</Text>
        <TouchableOpacity onPress={openEditClient} style={styles.editHeaderBtn}>
          <Ionicons name="create-outline" size={20} color={colors.black} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Profile card ── */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{client.name?.charAt(0)?.toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientEmail}>{client.email}</Text>
              {client.phone ? <Text style={styles.clientPhone}>{client.phone}</Text> : null}
            </View>
            <Badge
              label={client.status || 'active'}
              variant={client.status === 'active' ? 'active' : 'inactive'}
            />
          </View>

          {/* Quick stats row */}
          <View style={styles.statsRow}>
            {[
              { label: 'Age',    value: client.age        ? `${client.age}`           : '—' },
              { label: 'Sex',    value: client.sex        ?? '—'                           },
              { label: 'Height', value: client.height_cm  ? `${client.height_cm}cm`   : '—' },
              { label: 'Weight', value: client.starting_weight_kg ? `${client.starting_weight_kg}kg` : '—' },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={styles.statValue}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Plan type */}
          {client.plan_type ? (
            <View style={styles.planRow}>
              <Ionicons name="card-outline" size={14} color={colors.gray500} />
              <Text style={styles.planTxt}>{client.plan_type}</Text>
            </View>
          ) : null}

          {/* Goals summary */}
          {(displayShort || displayLong) && (
            <View style={styles.goalsSummary}>
              <Text style={styles.goalsSummaryLabel}>GOALS</Text>
              {displayShort ? <Text style={styles.goalsSummaryItem}>• Short term: {displayShort}</Text> : null}
              {displayLong  ? <Text style={styles.goalsSummaryItem}>• Long term: {displayLong}</Text>  : null}
            </View>
          )}

          {/* Injuries / Health conditions */}
          {client.injuries?.length > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsLabel}>HEALTH CONDITIONS</Text>
              <View style={styles.tagsWrap}>
                {client.injuries.map((inj: string) => (
                  <View key={inj} style={styles.injuryTag}>
                    <Text style={styles.injuryTagTxt}>{inj}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Edit button */}
          <TouchableOpacity style={styles.editDetailsBtn} onPress={openEditClient}>
            <Ionicons name="create-outline" size={15} color={colors.gray600} />
            <Text style={styles.editDetailsBtnTxt}>Edit All Client Details</Text>
          </TouchableOpacity>
        </Card>

        {/* ── Assigned Workouts ── */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Assigned Workouts</Text>
            <Text style={styles.sectionSub}>
              {assignedWorkouts.length} workout{assignedWorkouts.length !== 1 ? 's' : ''} assigned
            </Text>
          </View>
          <TouchableOpacity style={styles.manageBtn} onPress={openWorkoutModal}>
            <Ionicons name="settings-outline" size={14} color={colors.white} />
            <Text style={styles.manageBtnTxt}>Manage</Text>
          </TouchableOpacity>
        </View>

        {assignedWorkouts.length === 0 ? (
          <Card style={styles.emptyWorkoutsCard}>
            <Ionicons name="barbell-outline" size={32} color={colors.gray300} />
            <Text style={styles.emptyWorkoutsTxt}>No workouts assigned yet</Text>
            <TouchableOpacity style={styles.assignNowBtn} onPress={openWorkoutModal}>
              <Text style={styles.assignNowBtnTxt}>Assign Workouts →</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <View style={styles.workoutGrid}>
            {assignedWorkouts.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.workoutCard}
                onPress={() => router.navigate(`/pt/workout-detail?id=${w.id}` as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.workoutCardTitle}>{w.title}</Text>
                {w.focus ? (
                  <View style={styles.workoutFocusBadge}>
                    <Text style={styles.workoutFocusTxt}>{FOCUS_LABELS[w.focus] ?? w.focus}</Text>
                  </View>
                ) : null}
                <Text style={styles.workoutExCount}>
                  {w.exercise_count ?? 0} exercise{(w.exercise_count ?? 0) !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Progress Goals ── */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Progress Goals</Text>
          <TouchableOpacity style={styles.addIcon} onPress={() => setGModal(true)}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {goals.length === 0 ? (
          <Card><Text style={styles.emptyText}>No goals set yet. Tap + to add one.</Text></Card>
        ) : (
          goals.map((goal) => {
            const isUpdating = updatingGoal === goal.id;
            const canAct     = goal.status === 'in_progress';
            const progress   =
              goal.current_value != null && goal.target_value > 0
                ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                : null;

            return (
              <Card key={goal.id} style={styles.goalCard}>
                <View style={styles.goalRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.goalDesc}>{goal.description}</Text>
                    <Text style={styles.goalMeta}>
                      Target: {goal.target_value} {goal.target_unit}
                      {goal.current_value != null ? ` · Current: ${goal.current_value} ${goal.target_unit}` : ''}
                      {goal.target_date ? ` · Due: ${fmtDate(goal.target_date)}` : ''}
                    </Text>
                  </View>
                  <Badge
                    label={goal.status.replace('_', ' ')}
                    variant={goal.status === 'achieved' ? 'active' : goal.status === 'abandoned' ? 'danger' : 'pending'}
                  />
                </View>
                {progress !== null && canAct && (
                  <View style={styles.goalProgressBar}>
                    <View style={[styles.goalProgressFill, { width: `${progress}%` as any }]} />
                  </View>
                )}
                {isUpdating ? (
                  <ActivityIndicator color={colors.black} style={{ marginTop: spacing.md }} />
                ) : canAct ? (
                  <View style={styles.goalActions}>
                    <TouchableOpacity
                      style={styles.goalCompleteBtn}
                      onPress={() => updateGoalStatus(goal.id, 'achieved')}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={colors.green700} />
                      <Text style={styles.goalCompleteBtnTxt}>Mark Complete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.goalAbandonBtn}
                      onPress={() => updateGoalStatus(goal.id, 'abandoned')}
                    >
                      <Ionicons name="close-circle-outline" size={14} color={colors.gray500} />
                      <Text style={styles.goalAbandonBtnTxt}>Abandon</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.goalReopenBtn}
                    onPress={() => updateGoalStatus(goal.id, 'in_progress')}
                  >
                    <Ionicons name="refresh-outline" size={14} color={colors.gray500} />
                    <Text style={styles.goalReopenBtnTxt}>Re-open Goal</Text>
                  </TouchableOpacity>
                )}
              </Card>
            );
          })
        )}

        {/* ── Measurements ── */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Measurements</Text>
          <TouchableOpacity style={styles.addIcon} onPress={() => setMModal(true)}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {measurements.length === 0 ? (
          <Card><Text style={styles.emptyText}>No measurements recorded yet.</Text></Card>
        ) : (
          measurements.slice(0, 6).map((m) => (
            <Card key={m.id} style={styles.measureCard}>
              <Text style={styles.measureDate}>{fmtDate(m.date)}</Text>
              <View style={styles.metricsRow}>
                {[
                  { label: 'Weight', value: m.weight_kg,    unit: 'kg' },
                  { label: 'Chest',  value: m.chest_cm,     unit: 'cm' },
                  { label: 'Waist',  value: m.waist_cm,     unit: 'cm' },
                  { label: 'L. Arm', value: m.left_arm_cm,  unit: 'cm' },
                  { label: 'R. Arm', value: m.right_arm_cm, unit: 'cm' },
                  { label: 'Thigh',  value: m.thigh_cm,     unit: 'cm' },
                  { label: 'Hips',   value: m.hips_cm,      unit: 'cm' },
                ].filter((r) => r.value != null).map((r) => (
                  <View key={r.label} style={styles.metricItem}>
                    <Text style={styles.metricLabel}>{r.label}</Text>
                    <Text style={styles.metricValue}>{r.value} {r.unit}</Text>
                  </View>
                ))}
              </View>
              {m.notes ? <Text style={styles.measureNotes}>{m.notes}</Text> : null}
            </Card>
          ))
        )}
      </ScrollView>

      {/* ═══════════════════════════════════════════════════════════════════════
          EDIT CLIENT MODAL — exact same sections as add-client.tsx
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKAV}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalBox}>
              {/* Header */}
              <View style={styles.modalHead}>
                <Text style={styles.modalTitle}>Edit Client Details</Text>
                <TouchableOpacity onPress={() => setEditModal(false)}>
                  <Ionicons name="close" size={24} color={colors.gray600} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: 60 }}
                keyboardShouldPersistTaps="handled"
              >

                {/* ══ 1. BASIC INFORMATION ════════════════════════════════ */}
                <SectionHeader title="Client's Basic Information" />

                <Text style={styles.fieldLabel}>Full Name <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={efName}
                  onChangeText={setEFName}
                  placeholder="First and last name"
                  placeholderTextColor={colors.gray400}
                />

                <Text style={styles.fieldLabel}>Sex</Text>
                <ChipGroup
                  options={['Male', 'Female', 'Other', 'Prefer not to say']}
                  value={efSex}
                  onChange={setEFSex}
                />

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Date of Birth</Text>
                    <TextInput
                      style={styles.input}
                      value={efDob}
                      onChangeText={setEFDob}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={colors.gray400}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Age</Text>
                    <TextInput
                      style={styles.input}
                      value={efAge}
                      onChangeText={setEFAge}
                      placeholder="e.g. 32"
                      placeholderTextColor={colors.gray400}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Contact Email</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyTxt}>{client.email}</Text>
                </View>
                <Text style={styles.hintTxt}>Email cannot be changed after account creation.</Text>

                <Text style={styles.fieldLabel}>Contact Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={efPhone}
                  onChangeText={setEFPhone}
                  placeholder="07xxx xxxxxx"
                  placeholderTextColor={colors.gray400}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>Home Address</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={efAddress}
                  onChangeText={setEFAddress}
                  placeholder="Street, City, Postcode"
                  placeholderTextColor={colors.gray400}
                  multiline
                  numberOfLines={2}
                />

                {/* ══ 2. HISTORICAL INFORMATION ════════════════════════════ */}
                <SectionHeader title="Historical Information" />

                <Text style={styles.fieldLabel}>Drug History / Prescribed Medications</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={efDrugHistory}
                  onChangeText={setEFDrugHistory}
                  placeholder="List any medications (or N/A)"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={3}
                />

                <Text style={styles.fieldLabel}>Smoking History</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={efSmokingHistory}
                  onChangeText={setEFSmokingHistory}
                  placeholder="Current smoker / Ex-smoker / Non-smoker (or N/A)"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={2}
                />

                <Text style={styles.fieldLabel}>Physical Appearance</Text>
                <ChipGroup
                  options={['Healthy', 'Malnourished', 'Under-Nourished', 'Over-Nourished']}
                  value={efPhysicalAppearance}
                  onChange={setEFPhysicalAppearance}
                />

                {/* ══ 3. HEALTH HISTORY ════════════════════════════════════ */}
                <SectionHeader title="Health History" />
                <Text style={styles.hintTxt}>Tap to select all that apply</Text>

                {HEALTH_GROUPS.map((group) => (
                  <View key={group.label}>
                    <Text style={styles.condGroupLabel}>{group.label}</Text>
                    <ChipGroup
                      options={group.conditions}
                      value={efConditions}
                      onChange={setEFConditions}
                      multi
                    />
                  </View>
                ))}

                {/* ══ 4. ANTHROPOMETRIC TESTS ══════════════════════════════ */}
                <SectionHeader title="Anthropometric Tests" />

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Height (cm)</Text>
                    <TextInput
                      style={styles.input}
                      value={efHeightCm}
                      onChangeText={setEFHeightCm}
                      placeholder="e.g. 175"
                      placeholderTextColor={colors.gray400}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Weight (kg)</Text>
                    <TextInput
                      style={styles.input}
                      value={efWeightKg}
                      onChangeText={setEFWeightKg}
                      placeholder="e.g. 80"
                      placeholderTextColor={colors.gray400}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                {/* ══ 5. SOCIO-ECONOMIC HISTORY ════════════════════════════ */}
                <SectionHeader title="Socio-Economic History" />

                <Text style={styles.fieldLabel}>Employment Status</Text>
                <ChipGroup
                  options={['Employed', 'Part Time', 'Self Employed', 'Unemployed', 'Student', 'Retired']}
                  value={efEmployment}
                  onChange={setEFEmployment}
                />

                <Text style={styles.fieldLabel}>Do you have a gym membership?</Text>
                <ChipGroup
                  options={['Yes', 'No']}
                  value={efGymMembership}
                  onChange={setEFGymMembership}
                />

                {efGymMembership === 'Yes' && (
                  <>
                    <Text style={styles.fieldLabel}>How many times per week?</Text>
                    <ChipGroup
                      options={['1', '2', '3', '4', '5', '6', '7']}
                      value={efGymFrequency}
                      onChange={setEFGymFrequency}
                    />
                  </>
                )}

                <Text style={styles.fieldLabel}>Do you eat out often?</Text>
                <ChipGroup
                  options={['Once a week', 'Multiple times a week', 'Every day', 'Rarely']}
                  value={efEatsOut}
                  onChange={setEFEatsOut}
                />

                <Text style={styles.fieldLabel}>Sporting Background</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={efSportingBg}
                  onChangeText={setEFSportingBg}
                  placeholder="Sport(s) played (or N/A)"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={2}
                />

                <Text style={styles.fieldLabel}>Religious Beliefs</Text>
                <TextInput
                  style={styles.input}
                  value={efReligious}
                  onChangeText={setEFReligious}
                  placeholder="If not applicable, state N/A"
                  placeholderTextColor={colors.gray400}
                />

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Any Children?</Text>
                    <ChipGroup
                      options={['Yes', 'No']}
                      value={efChildren}
                      onChange={setEFChildren}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Any Pets?</Text>
                    <ChipGroup
                      options={['Yes', 'No']}
                      value={efPets}
                      onChange={setEFPets}
                    />
                  </View>
                </View>

                {/* ══ 6. CLIENT GOALS ══════════════════════════════════════ */}
                <SectionHeader title="Client Goals" />

                <Text style={styles.fieldLabel}>Short Term Goals</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={efShortGoals}
                  onChangeText={setEFShortGoals}
                  placeholder="What do you want to achieve in the next 4–12 weeks?"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={3}
                />

                <Text style={styles.fieldLabel}>Long Term Goals</Text>
                <TextInput
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  value={efLongGoals}
                  onChangeText={setEFLongGoals}
                  placeholder="What do you want to achieve in the next 6–12 months?"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={3}
                />

                {/* ══ 7. DIETARY HISTORY ═══════════════════════════════════ */}
                <SectionHeader title="Dietary History" />

                <Text style={styles.fieldLabel}>Are you vegetarian?</Text>
                <ChipGroup
                  options={['Yes', 'No']}
                  value={efVegetarian}
                  onChange={setEFVegetarian}
                />

                <Text style={styles.fieldLabel}>Do you follow any diet regimes?</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={efDietRegimes}
                  onChangeText={setEFDietRegimes}
                  placeholder="e.g. Keto, Intermittent Fasting (or N/A)"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={2}
                />

                <Text style={styles.fieldLabel}>Do your religious beliefs impact your diet?</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={efDietReligious}
                  onChangeText={setEFDietReligious}
                  placeholder="If applicable, please clarify (or N/A)"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={2}
                />

                <Text style={styles.fieldLabel}>Allergies</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={efAllergies}
                  onChangeText={setEFAllergies}
                  placeholder="List allergies (or N/A)"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={2}
                />

                <Text style={styles.fieldLabel}>Intolerances</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  value={efIntolerances}
                  onChangeText={setEFIntolerances}
                  placeholder="e.g. Lactose, Gluten (or N/A)"
                  placeholderTextColor={colors.gray400}
                  multiline numberOfLines={2}
                />

                {/* ══ MEMBERSHIP / STATUS ══════════════════════════════════ */}
                <SectionHeader title="Membership" />

                <Text style={styles.fieldLabel}>Client Status</Text>
                <ChipGroup
                  options={['active', 'inactive', 'archived']}
                  value={efStatus}
                  onChange={setEFStatus}
                />

                <Text style={styles.fieldLabel}>Plan / Membership Type</Text>
                <View style={cg.row}>
                  {PLAN_TYPES.map((pt) => (
                    <TouchableOpacity
                      key={pt}
                      style={[cg.chip, efPlanType === pt && cg.chipActive]}
                      onPress={() => setEFPlanType((prev) => prev === pt ? '' : pt)}
                      activeOpacity={0.7}
                    >
                      <Text style={[cg.chipTxt, efPlanType === pt && cg.chipTxtActive]}>{pt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { marginTop: spacing.sm }]}
                  value={efPlanType}
                  onChangeText={setEFPlanType}
                  placeholder="Or type a custom plan type..."
                  placeholderTextColor={colors.gray400}
                />

                {/* ══ SAVE ═════════════════════════════════════════════════ */}
                <TouchableOpacity
                  style={[styles.saveBtn, savingClient && { opacity: 0.6 }]}
                  onPress={handleSaveClient}
                  disabled={savingClient}
                >
                  {savingClient
                    ? <ActivityIndicator color={colors.white} />
                    : <Text style={styles.saveBtnTxt}>Save Client Details</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Workout Assignment Modal ── */}
      <Modal visible={workoutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Assign Workouts</Text>
              <TouchableOpacity onPress={() => setWorkoutModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Select which workouts {client.name} should have access to.
            </Text>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              {allWorkouts.length === 0 ? (
                <View style={styles.noWorkoutsWrap}>
                  <Text style={styles.noWorkoutsTxt}>No active workouts in your library yet.</Text>
                  <TouchableOpacity
                    style={styles.createWorkoutBtn}
                    onPress={() => { setWorkoutModal(false); router.navigate('/pt/workouts' as any); }}
                  >
                    <Text style={styles.createWorkoutBtnTxt}>Go to Workouts →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                allWorkouts.map((w) => {
                  const isSelected = selectedWorkoutIds.includes(w.id);
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.workoutRow, isSelected && styles.workoutRowSelected]}
                      onPress={() =>
                        setSelectedWorkoutIds((prev) =>
                          prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]
                        )
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[styles.workoutRowAvatar, isSelected && { backgroundColor: colors.black }]}>
                        <Ionicons name="barbell-outline" size={16} color={isSelected ? colors.white : colors.gray500} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.workoutRowTitle}>{w.title}</Text>
                        <Text style={styles.workoutRowMeta}>
                          {w.focus ? `${FOCUS_LABELS[w.focus] ?? w.focus}  ·  ` : ''}
                          {w.exercise_count ?? 0} exercise{(w.exercise_count ?? 0) !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={13} color={colors.white} />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
              {allWorkouts.length > 0 && (
                <>
                  <Text style={styles.selectedCount}>
                    {selectedWorkoutIds.length === 0
                      ? 'No workouts selected'
                      : `${selectedWorkoutIds.length} workout${selectedWorkoutIds.length !== 1 ? 's' : ''} selected`}
                  </Text>
                  <TouchableOpacity
                    style={[styles.saveBtn, savingWorkouts && { opacity: 0.6 }]}
                    onPress={saveWorkoutAssignments}
                    disabled={savingWorkouts}
                  >
                    {savingWorkouts
                      ? <ActivityIndicator color={colors.white} />
                      : <Text style={styles.saveBtnTxt}>Save Assignments</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Measurement Modal ── */}
      <Modal visible={mModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add Measurement</Text>
              <TouchableOpacity onPress={() => setMModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput style={styles.input} value={mForm.date}
                onChangeText={(v) => setMForm((f) => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.gray400} />
              {[['Weight (kg)','weight_kg'],['Chest (cm)','chest_cm'],['Waist (cm)','waist_cm'],
                ['L. Arm (cm)','left_arm_cm'],['R. Arm (cm)','right_arm_cm'],
                ['Thigh (cm)','thigh_cm'],['Hips (cm)','hips_cm']].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput style={styles.input} value={(mForm as any)[key]}
                    onChangeText={(v) => setMForm((f) => ({ ...f, [key]: v }))}
                    placeholder="Optional" placeholderTextColor={colors.gray400}
                    keyboardType="decimal-pad" />
                </View>
              ))}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={mForm.notes} onChangeText={(v) => setMForm((f) => ({ ...f, notes: v }))}
                placeholder="Optional" placeholderTextColor={colors.gray400} multiline />
              <TouchableOpacity style={[styles.saveBtn, mSaving && { opacity: 0.6 }]}
                onPress={saveMeasurement} disabled={mSaving}>
                {mSaving ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Measurement</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Progress Goal Modal ── */}
      <Modal visible={gModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add Progress Goal</Text>
              <TouchableOpacity onPress={() => setGModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.fieldLabel}>Description <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={gForm.description}
                onChangeText={(v) => setGForm((f) => ({ ...f, description: v }))}
                placeholder="e.g. Reach 80kg bodyweight" placeholderTextColor={colors.gray400} />
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={cg.row}>
                {['weight', 'strength', 'movement', 'custom'].map((t) => (
                  <TouchableOpacity key={t}
                    style={[cg.chip, gForm.type === t && cg.chipActive]}
                    onPress={() => setGForm((f) => ({ ...f, type: t }))}>
                    <Text style={[cg.chipTxt, gForm.type === t && cg.chipTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Target Value <Text style={styles.req}>*</Text></Text>
              <TextInput style={styles.input} value={gForm.target_value}
                onChangeText={(v) => setGForm((f) => ({ ...f, target_value: v }))}
                placeholder="e.g. 80" placeholderTextColor={colors.gray400} keyboardType="decimal-pad" />
              <Text style={styles.fieldLabel}>Unit</Text>
              <View style={cg.row}>
                {['kg', 'lbs', 'reps', 'mins', '%', 'other'].map((u) => (
                  <TouchableOpacity key={u}
                    style={[cg.chip, gForm.target_unit === u && cg.chipActive]}
                    onPress={() => setGForm((f) => ({ ...f, target_unit: u }))}>
                    <Text style={[cg.chipTxt, gForm.target_unit === u && cg.chipTxtActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Current Value (optional)</Text>
              <TextInput style={styles.input} value={gForm.current_value}
                onChangeText={(v) => setGForm((f) => ({ ...f, current_value: v }))}
                placeholder="e.g. 90" placeholderTextColor={colors.gray400} keyboardType="decimal-pad" />
              <Text style={styles.fieldLabel}>Target Date (optional)</Text>
              <TextInput style={styles.input} value={gForm.target_date}
                onChangeText={(v) => setGForm((f) => ({ ...f, target_date: v }))}
                placeholder="YYYY-MM-DD" placeholderTextColor={colors.gray400} />
              <TouchableOpacity style={[styles.saveBtn, gSaving && { opacity: 0.6 }]}
                onPress={saveGoal} disabled={gSaving}>
                {gSaving ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.saveBtnTxt}>Save Goal</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.gray50 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  editHeaderBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll:     { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },

  // Profile card
  profileCard: { marginBottom: spacing.lg },
  profileTop:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl },
  avatar:      { width: 52, height: 52, borderRadius: borderRadius.full, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0 },
  avatarText:  { color: colors.white, fontSize: fontSize.xl, fontWeight: '700' },
  profileInfo: { flex: 1 },
  clientName:  { fontSize: fontSize.xl, fontWeight: '700', color: colors.black },
  clientEmail: { fontSize: fontSize.sm, color: colors.gray400, marginTop: 2 },
  clientPhone: { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },
  statsRow:    { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.lg },
  statItem:    { flex: 1, alignItems: 'center' },
  statLabel:   { fontSize: fontSize.xs, color: colors.gray400 },
  statValue:   { fontSize: fontSize.md, fontWeight: '600', color: colors.black, marginTop: 2 },
  planRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray100 },
  planTxt:     { fontSize: fontSize.sm, color: colors.gray500 },
  goalsSummary: { borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.md, marginTop: spacing.md },
  goalsSummaryLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray400, letterSpacing: 0.6, marginBottom: spacing.xs },
  goalsSummaryItem:  { fontSize: fontSize.sm, color: colors.gray600, lineHeight: 20 },
  tagsSection: { borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.md, marginTop: spacing.md },
  tagsLabel:   { fontSize: fontSize.xs, fontWeight: '700', color: colors.gray400, letterSpacing: 0.6, marginBottom: spacing.sm },
  tagsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  injuryTag:   { backgroundColor: colors.red50, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  injuryTagTxt:{ fontSize: fontSize.xs, color: colors.red700, fontWeight: '500' },
  editDetailsBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: spacing.lg },
  editDetailsBtnTxt: { fontSize: fontSize.sm, fontWeight: '600', color: colors.gray600 },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  sectionTitle:  { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },
  sectionSub:    { fontSize: fontSize.xs, color: colors.gray400, marginTop: 2 },
  addIcon:       { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  manageBtn:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.black, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.sm + 1, borderRadius: borderRadius.sm },
  manageBtnTxt:  { fontSize: fontSize.xs, fontWeight: '600', color: colors.white },

  // Workouts
  emptyWorkoutsCard:  { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, marginBottom: spacing.lg },
  emptyWorkoutsTxt:   { fontSize: fontSize.sm, color: colors.gray500 },
  assignNowBtn:       { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.xs },
  assignNowBtnTxt:    { color: colors.white, fontSize: fontSize.sm, fontWeight: '600' },
  workoutGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  workoutCard:        { width: '47%', backgroundColor: colors.black, borderRadius: borderRadius.md, padding: spacing.lg, gap: spacing.xs },
  workoutCardTitle:   { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
  workoutFocusBadge:  { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  workoutFocusTxt:    { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '600', textTransform: 'capitalize' },
  workoutExCount:     { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

  // Goals
  goalCard:          { marginBottom: spacing.sm },
  goalRow:           { flexDirection: 'row', alignItems: 'flex-start' },
  goalDesc:          { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  goalMeta:          { fontSize: fontSize.sm, color: colors.gray400, marginTop: 4, lineHeight: 18 },
  goalProgressBar:   { height: 5, backgroundColor: colors.gray100, borderRadius: 3, overflow: 'hidden', marginTop: spacing.sm },
  goalProgressFill:  { height: '100%', backgroundColor: colors.black, borderRadius: 3 },
  goalActions:       { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray100 },
  goalCompleteBtn:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.green50, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: '#BBF7D0' },
  goalCompleteBtnTxt:{ fontSize: fontSize.xs, fontWeight: '600', color: colors.green700 },
  goalAbandonBtn:    { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.gray100, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full },
  goalAbandonBtnTxt: { fontSize: fontSize.xs, fontWeight: '600', color: colors.gray500 },
  goalReopenBtn:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray100, alignSelf: 'flex-start' },
  goalReopenBtnTxt:  { fontSize: fontSize.xs, color: colors.gray400 },

  // Measurements
  measureCard:  { marginBottom: spacing.sm },
  measureDate:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginBottom: spacing.sm },
  metricsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricItem:   { minWidth: '28%' },
  metricLabel:  { fontSize: fontSize.xs, color: colors.gray400 },
  metricValue:  { fontSize: fontSize.sm, fontWeight: '600', color: colors.black, marginTop: 2 },
  measureNotes: { fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.sm, fontStyle: 'italic' },
  emptyText:    { fontSize: fontSize.sm, color: colors.gray400, textAlign: 'center' },

  // Modals
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalKAV:    { flex: 1, justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '96%' },
  modalHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle:  { fontSize: fontSize.lg, fontWeight: '700', color: colors.black },
  modalHint:   { fontSize: fontSize.sm, color: colors.gray500, lineHeight: 20, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  modalBody:   { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },

  // Form inputs
  fieldLabel:   { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray700, marginBottom: spacing.sm, marginTop: spacing.lg },
  req:          { color: colors.red500 },
  hintTxt:      { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.sm, lineHeight: 16 },
  input:        { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2, fontSize: fontSize.md, color: colors.black, backgroundColor: colors.white },
  readonlyField:{ borderWidth: 1.5, borderColor: colors.gray100, borderRadius: borderRadius.sm, padding: spacing.md, backgroundColor: colors.gray50 },
  readonlyTxt:  { fontSize: fontSize.md, color: colors.gray400 },
  row2:         { flexDirection: 'row', gap: spacing.md },
  condGroupLabel:{ fontSize: fontSize.xs, fontWeight: '700', color: colors.gray600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  saveBtn:      { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.xl },
  saveBtnTxt:   { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },

  // Workout modal rows
  workoutRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  workoutRowSelected: { backgroundColor: colors.gray50 },
  workoutRowAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  workoutRowTitle:    { fontSize: fontSize.md, fontWeight: '600', color: colors.black },
  workoutRowMeta:     { fontSize: fontSize.xs, color: colors.gray400, marginTop: 1, textTransform: 'capitalize' },
  checkbox:           { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gray300, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected:   { backgroundColor: colors.black, borderColor: colors.black },
  selectedCount:      { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xs },
  noWorkoutsWrap:     { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  noWorkoutsTxt:      { fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center' },
  createWorkoutBtn:   { backgroundColor: colors.black, borderRadius: borderRadius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  createWorkoutBtnTxt:{ color: colors.white, fontSize: fontSize.sm, fontWeight: '600' },
});