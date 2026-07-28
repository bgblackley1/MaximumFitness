import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Modal, Clipboard, Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import API from '@/services/api';
import Button from '@/components/Button';
import { colors, fontSize, spacing, borderRadius } from '@/constants/theme';

/* ── Tiny reusable sub-components ────────────────────────────────────────── */

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

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={fl.label}>
      {label}{required ? <Text style={{ color: colors.red500 }}> *</Text> : null}
    </Text>
  );
}

const fl = StyleSheet.create({
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.gray700, marginBottom: spacing.sm, marginTop: spacing.lg },
});

function StyledInput(props: React.ComponentProps<typeof TextInput> & { error?: boolean }) {
  const { error, style, ...rest } = props;
  return (
    <TextInput
      style={[si.input, error && si.inputError, style]}
      placeholderTextColor={colors.gray400}
      {...rest}
    />
  );
}

const si = StyleSheet.create({
  input: {
    borderWidth: 1.5, borderColor: colors.gray200, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
    fontSize: fontSize.md, color: colors.black, backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.red500 },
});

/** Single or multi-select chip group */
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
  row:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip:        { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.gray200, backgroundColor: colors.white },
  chipActive:  { backgroundColor: colors.black, borderColor: colors.black },
  chipTxt:     { fontSize: fontSize.sm, color: colors.gray600, fontWeight: '500' },
  chipTxtActive: { color: colors.white },
});

/* ── Health condition groups ─────────────────────────────────────────────── */
const HEALTH_GROUPS: { label: string; conditions: string[] }[] = [
  { label: 'CV / Blood',         conditions: ['Hyper/Hypotension','Angina','Heart Attacks','Anaemia','Blood Clots','Varicose Veins'] },
  { label: 'Respiratory',        conditions: ['Asthma','Respiratory Infections'] },
  { label: 'Musculo-Skeletal',   conditions: ['Joint Problems','Recent Fractures','Ligament Sprains','Muscle Strains'] },
  { label: 'Nervous System',     conditions: ['Stroke','Sciatica','Sleep Disorders','Stress Issues'] },
  { label: 'Endocrine',          conditions: ['Hypothyroidism','Hyperthyroidism','Diabetes Type 1','Diabetes Type 2'] },
  { label: 'Digestive',          conditions: ["IBS","Digestive Intolerances","Crohn's Disease","Toileting Issues"] },
  { label: 'Urinary',            conditions: ['Cystitis','Urinary Infections','Kidney Stones','Urination Issues'] },
];

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function AddClientScreen() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  /* Success modal */
  const [successModal,   setSuccessModal]   = useState(false);
  const [createdClient,  setCreatedClient]  = useState<{ name: string; email: string; temp_password: string } | null>(null);
  const [copied,         setCopied]         = useState(false);

  /* ── Form state ── */
  // Basic info
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [sex,     setSex]     = useState('');
  const [dob,     setDob]     = useState('');
  const [age,     setAge]     = useState('');
  const [phone,   setPhone]   = useState('');
  const [address, setAddress] = useState('');

  // Historical
  const [drugHistory,       setDrugHistory]       = useState('');
  const [smokingHistory,    setSmokingHistory]     = useState('');
  const [physicalAppearance, setPhysicalAppearance] = useState('');

  // Health conditions (multi-select)
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  // Anthropometric
  const [heightInches, setHeightInches] = useState('');
  const [weightKg,     setWeightKg]     = useState('');

  // Socio-economic
  const [employmentStatus, setEmploymentStatus] = useState('');
  const [gymMembership,    setGymMembership]    = useState('');   // 'Yes'|'No'
  const [gymFrequency,     setGymFrequency]     = useState('');
  const [eatsOut,          setEatsOut]          = useState('');
  const [sportingBg,       setSportingBg]       = useState('');
  const [religiousBeliefs, setReligiousBeliefs] = useState('');
  const [hasChildren,      setHasChildren]      = useState('');   // 'Yes'|'No'
  const [hasPets,          setHasPets]          = useState('');   // 'Yes'|'No'

  // Goals
  const [shortTermGoals, setShortTermGoals] = useState('');
  const [longTermGoals,  setLongTermGoals]  = useState('');

  // Dietary
  const [isVegetarian,         setIsVegetarian]         = useState(''); // 'Yes'|'No'
  const [dietRegimes,          setDietRegimes]          = useState('');
  const [dietaryReligious,     setDietaryReligious]     = useState('');
  const [allergies,            setAllergies]            = useState('');
  const [dietaryIntolerances,  setDietaryIntolerances]  = useState('');

  /* ── Build notes string ── */
  const buildNotes = (): string => {
    const lines: string[] = [];

    if (dob)     lines.push(`DOB: ${dob}`);
    if (phone)   lines.push(`Phone: ${phone}`);
    if (address) lines.push(`Address: ${address}`);

    const hasHistory = drugHistory || smokingHistory || physicalAppearance;
    if (hasHistory) {
      lines.push('', '── HISTORICAL INFORMATION ──');
      if (drugHistory)         lines.push(`Drug/Prescribed Meds: ${drugHistory}`);
      if (smokingHistory)      lines.push(`Smoking History: ${smokingHistory}`);
      if (physicalAppearance)  lines.push(`Physical Appearance: ${physicalAppearance}`);
    }

    if (selectedConditions.length > 0) {
      lines.push('', '── HEALTH CONDITIONS ──');
      lines.push(selectedConditions.join(', '));
    }

    const hasSocio = employmentStatus || gymMembership || eatsOut || sportingBg || religiousBeliefs || hasChildren || hasPets;
    if (hasSocio) {
      lines.push('', '── SOCIO-ECONOMIC ──');
      if (employmentStatus) lines.push(`Employment: ${employmentStatus}`);
      if (gymMembership) {
        const freq = gymMembership === 'Yes' && gymFrequency ? ` (${gymFrequency}x per week)` : '';
        lines.push(`Gym Membership: ${gymMembership}${freq}`);
      }
      if (eatsOut)          lines.push(`Eats Out: ${eatsOut}`);
      if (sportingBg)       lines.push(`Sporting Background: ${sportingBg}`);
      if (religiousBeliefs) lines.push(`Religious Beliefs: ${religiousBeliefs}`);
      if (hasChildren)      lines.push(`Children: ${hasChildren}`);
      if (hasPets)          lines.push(`Pets: ${hasPets}`);
    }

    const hasDietary = isVegetarian || dietRegimes || dietaryReligious || allergies || dietaryIntolerances;
    if (hasDietary) {
      lines.push('', '── DIETARY ──');
      if (isVegetarian)         lines.push(`Vegetarian: ${isVegetarian}`);
      if (dietRegimes)          lines.push(`Diet Regimes: ${dietRegimes}`);
      if (dietaryReligious)     lines.push(`Dietary Religious Impact: ${dietaryReligious}`);
      if (allergies)            lines.push(`Allergies: ${allergies}`);
      if (dietaryIntolerances)  lines.push(`Intolerances: ${dietaryIntolerances}`);
    }

    return lines.join('\n').trim();
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Convert height inches → cm
      const height_cm = heightInches ? parseFloat(heightInches) * 2.54 : null;

      // Goals array
      const goalsArr: string[] = [];
      if (shortTermGoals) goalsArr.push(`Short term: ${shortTermGoals}`);
      if (longTermGoals)  goalsArr.push(`Long term: ${longTermGoals}`);

      // injuries = selected health conditions
      const res = await API.post('/clients', {
        name:                name.trim(),
        email:               email.trim().toLowerCase(),
        phone:               phone || null,
        age:                 age ? Number(age) : null,
        sex:                 sex || null,
        height_cm:           height_cm ? Math.round(height_cm * 10) / 10 : null,
        starting_weight_kg:  weightKg ? parseFloat(weightKg) : null,
        goals:               goalsArr.length ? goalsArr : null,
        injuries:            selectedConditions.length ? selectedConditions : null,
        notes:               buildNotes() || null,
      });

      setCreatedClient({
        name:          name.trim(),
        email:         email.trim().toLowerCase(),
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
    Clipboard.setString(
      `Login details for Maximum Fitness:\nEmail: ${createdClient.email}\nPassword: ${createdClient.temp_password}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDone = () => {
    setSuccessModal(false);
    setCreatedClient(null);
    setCopied(false);
    router.back();
  };

  /* ── Render ── */
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
          <Text style={styles.title}>New Client</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.red700} />
              <Text style={styles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          {/* ══ 1. BASIC INFORMATION ══════════════════════════════════════════ */}
          <SectionHeader title="Client's Basic Information" />

          <FieldLabel label="Full Name" required />
          <StyledInput
            value={name}
            onChangeText={setName}
            placeholder="First and last name"
            error={!name && !!error}
          />

          <FieldLabel label="Sex" />
          <ChipGroup
            options={['Male', 'Female', 'Other', 'Prefer not to say']}
            value={sex}
            onChange={setSex}
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Date of Birth" />
              <StyledInput
                value={dob}
                onChangeText={setDob}
                placeholder="DD/MM/YYYY"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Age" />
              <StyledInput
                value={age}
                onChangeText={setAge}
                placeholder="e.g. 32"
                keyboardType="numeric"
              />
            </View>
          </View>

          <FieldLabel label="Contact Email" required />
          <StyledInput
            value={email}
            onChangeText={setEmail}
            placeholder="client@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            error={!email && !!error}
          />

          <FieldLabel label="Contact Phone Number" />
          <StyledInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07xxx xxxxxx"
            keyboardType="phone-pad"
          />

          <FieldLabel label="Home Address" />
          <StyledInput
            value={address}
            onChangeText={setAddress}
            placeholder="Street, City, Postcode"
            multiline
            numberOfLines={2}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />

          {/* ══ 2. HISTORICAL INFORMATION ════════════════════════════════════ */}
          <SectionHeader title="Historical Information" />

          <FieldLabel label="Drug History / Prescribed Medications" />
          <StyledInput
            value={drugHistory}
            onChangeText={setDrugHistory}
            placeholder="List any medications (or N/A)"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          <FieldLabel label="Smoking History" />
          <StyledInput
            value={smokingHistory}
            onChangeText={setSmokingHistory}
            placeholder="Current smoker / Ex-smoker / Non-smoker (or N/A)"
            multiline
            numberOfLines={2}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          <FieldLabel label="Physical Appearance" />
          <ChipGroup
            options={['Healthy', 'Malnourished', 'Under-Nourished', 'Over-Nourished']}
            value={physicalAppearance}
            onChange={setPhysicalAppearance}
          />

          {/* ══ 3. HEALTH HISTORY ════════════════════════════════════════════ */}
          <SectionHeader title="Health History" />
          <Text style={styles.hint}>Tap to select all that apply</Text>

          {HEALTH_GROUPS.map((group) => (
            <View key={group.label}>
              <Text style={styles.condGroupLabel}>{group.label}</Text>
              <ChipGroup
                options={group.conditions}
                value={selectedConditions}
                onChange={setSelectedConditions}
                multi
              />
            </View>
          ))}

          {/* ══ 4. ANTHROPOMETRIC TESTS ══════════════════════════════════════ */}
          <SectionHeader title="Anthropometric Tests" />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Height (inches)" />
              <StyledInput
                value={heightInches}
                onChangeText={setHeightInches}
                placeholder='e.g. 70"'
                keyboardType="decimal-pad"
              />
              {heightInches ? (
                <Text style={styles.convertHint}>
                  ≈ {(parseFloat(heightInches) * 2.54).toFixed(1)} cm
                </Text>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Weight (kg)" />
              <StyledInput
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="e.g. 80"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* ══ 5. SOCIO-ECONOMIC HISTORY ════════════════════════════════════ */}
          <SectionHeader title="Socio-Economic History" />

          <FieldLabel label="Employment Status" />
          <ChipGroup
            options={['Employed', 'Part Time', 'Self Employed', 'Unemployed', 'Student', 'Retired']}
            value={employmentStatus}
            onChange={setEmploymentStatus}
          />

          <FieldLabel label="Do you have a gym membership?" />
          <ChipGroup
            options={['Yes', 'No']}
            value={gymMembership}
            onChange={setGymMembership}
          />

          {gymMembership === 'Yes' && (
            <>
              <FieldLabel label="How many times per week?" />
              <ChipGroup
                options={['1', '2', '3', '4', '5', '6', '7']}
                value={gymFrequency}
                onChange={setGymFrequency}
              />
            </>
          )}

          <FieldLabel label="Do you eat out often?" />
          <ChipGroup
            options={['Once a week', 'Multiple times a week', 'Every day', 'Rarely']}
            value={eatsOut}
            onChange={setEatsOut}
          />

          <FieldLabel label="Sporting Background" />
          <StyledInput
            value={sportingBg}
            onChangeText={setSportingBg}
            placeholder="Sport(s) played (or N/A)"
            multiline
            numberOfLines={2}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          <FieldLabel label="Religious Beliefs" />
          <StyledInput
            value={religiousBeliefs}
            onChangeText={setReligiousBeliefs}
            placeholder="If not applicable, state N/A"
          />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Any Children?" />
              <ChipGroup
                options={['Yes', 'No']}
                value={hasChildren}
                onChange={setHasChildren}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Any Pets?" />
              <ChipGroup
                options={['Yes', 'No']}
                value={hasPets}
                onChange={setHasPets}
              />
            </View>
          </View>

          {/* ══ 6. CLIENT GOALS ══════════════════════════════════════════════ */}
          <SectionHeader title="Client Goals" />

          <FieldLabel label="Short Term Goals" />
          <StyledInput
            value={shortTermGoals}
            onChangeText={setShortTermGoals}
            placeholder="What do you want to achieve in the next 4–12 weeks?"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          <FieldLabel label="Long Term Goals" />
          <StyledInput
            value={longTermGoals}
            onChangeText={setLongTermGoals}
            placeholder="What do you want to achieve in the next 6–12 months?"
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          {/* ══ 7. DIETARY HISTORY ═══════════════════════════════════════════ */}
          <SectionHeader title="Dietary History" />

          <FieldLabel label="Are you vegetarian?" />
          <ChipGroup
            options={['Yes', 'No']}
            value={isVegetarian}
            onChange={setIsVegetarian}
          />

          <FieldLabel label="Do you follow any diet regimes?" />
          <StyledInput
            value={dietRegimes}
            onChangeText={setDietRegimes}
            placeholder="e.g. Keto, Intermittent Fasting (or N/A)"
            multiline
            numberOfLines={2}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          <FieldLabel label="Do your religious beliefs impact your diet?" />
          <StyledInput
            value={dietaryReligious}
            onChangeText={setDietaryReligious}
            placeholder="If applicable, please clarify (or N/A)"
            multiline
            numberOfLines={2}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          <FieldLabel label="Allergies" />
          <StyledInput
            value={allergies}
            onChangeText={setAllergies}
            placeholder="List allergies (or N/A)"
            multiline
            numberOfLines={2}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          <FieldLabel label="Intolerances" />
          <StyledInput
            value={dietaryIntolerances}
            onChangeText={setDietaryIntolerances}
            placeholder="e.g. Lactose, Gluten (or N/A)"
            multiline
            numberOfLines={2}
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />

          {/* ══ Submit ════════════════════════════════════════════════════════ */}
          <View style={styles.submitWrap}>
            <Button
              title="Create Client"
              onPress={handleSubmit}
              loading={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Success Modal ──────────────────────────────────────────────────── */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={32} color={colors.white} />
            </View>

            <Text style={styles.successTitle}>Client Created!</Text>
            <Text style={styles.successSubtitle}>
              Share these login details with{' '}
              <Text style={{ fontWeight: '700' }}>{createdClient?.name}</Text>
            </Text>

            <View style={styles.credCard}>
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
                {copied ? 'Copied!' : 'Copy login details'}
              </Text>
            </TouchableOpacity>

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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: fontSize.lg, fontWeight: '600', color: colors.black },

  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.red50, borderWidth: 1, borderColor: colors.red500,
    borderRadius: borderRadius.sm, padding: spacing.md, marginBottom: spacing.lg,
  },
  errorTxt: { fontSize: fontSize.sm, color: colors.red700, flex: 1 },

  row2: { flexDirection: 'row', gap: spacing.md },

  hint: { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.md },

  condGroupLabel: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.gray600,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },

  convertHint: {
    fontSize: fontSize.xs, color: colors.gray400, marginTop: spacing.xs,
  },

  submitWrap: { marginTop: spacing.xxl, marginBottom: spacing.lg },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.xl,
  },
  modalBox: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.xl, width: '100%', maxWidth: 400, alignItems: 'center',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.black,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: fontSize.xxl, fontWeight: '700', color: colors.black, marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: fontSize.sm, color: colors.gray500, textAlign: 'center',
    marginBottom: spacing.xl, lineHeight: 20,
  },
  credCard: {
    width: '100%', borderWidth: 1.5, borderColor: colors.gray200,
    borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.md,
  },
  credRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg },
  credDivider: { height: 1, backgroundColor: colors.gray100 },
  credLabel:   { fontSize: fontSize.xs, color: colors.gray400, marginBottom: spacing.xs },
  credValue:   { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  credPassword:{ fontSize: fontSize.lg, fontWeight: '700', color: colors.black, letterSpacing: 1 },
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
  copyBtnTxt:     { fontSize: fontSize.md, fontWeight: '500', color: colors.black },
  doneBtn: {
    width: '100%', backgroundColor: colors.black, borderRadius: borderRadius.sm,
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  doneBtnTxt: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});