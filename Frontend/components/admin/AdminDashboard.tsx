import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import type { AdminRole, AdminRoleFilter, AdminUser } from '../../types/admin';

type ThemeMode = 'light' | 'dark';

interface Props {
  users: AdminUser[];
  theme: ThemeMode;
  loading?: boolean;
  assignPatientId: string;
  assignDoctorId: string;
  changeRoleUserId: string;
  changeRoleNewVal: AdminRole;
  onAssignPatientId: (id: string) => void;
  onAssignDoctorId: (id: string) => void;
  onChangeRoleUserId: (id: string) => void;
  onChangeRoleNewVal: (role: AdminRole) => void;
  onAssign: () => void;
  onChangeRole: () => void;
}

function initials(user: AdminUser): string {
  const a = (user.first_name || '').trim().charAt(0);
  const b = (user.last_name || '').trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function displayName(user: AdminUser): string {
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
}

function roleLabel(role: string): string {
  if (role === 'CUIDADOR') return 'Doctor';
  if (role === 'PACIENTE') return 'Paciente';
  if (role === 'ADMIN') return 'Admin';
  return role;
}

function matchesQuery(user: AdminUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${user.first_name} ${user.last_name} ${user.email} ${user.caregiver_name || ''}`.toLowerCase();
  return haystack.includes(q);
}

function KpiCard({
  icon,
  label,
  value,
  accent,
  surface,
  border,
  text,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  accent: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: surface, borderColor: border }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={[styles.kpiValue, { color: text }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color: muted }]}>{label}</Text>
    </View>
  );
}

function UserPickRow({
  user,
  selected,
  onPress,
  colors,
  subtitle,
}: {
  user: AdminUser;
  selected: boolean;
  onPress: () => void;
  colors: {
    text: string;
    muted: string;
    border: string;
    surface: string;
    accent: string;
    selectedBg: string;
  };
  subtitle?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.userPickRow,
        {
          backgroundColor: selected ? colors.selectedBg : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: selected ? colors.accent : `${colors.accent}22` }]}>
        <Text style={[styles.avatarText, { color: selected ? '#fff' : colors.accent }]}>
          {initials(user)}
        </Text>
      </View>
      <View style={styles.userPickMeta}>
        <Text style={[styles.userPickName, { color: colors.text }]} numberOfLines={1}>
          {displayName(user)}
        </Text>
        <Text style={[styles.userPickEmail, { color: colors.muted }]} numberOfLines={1}>
          {user.email}
        </Text>
        {!!subtitle && (
          <Text style={[styles.userPickSub, { color: colors.accent }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={selected ? colors.accent : colors.muted}
      />
    </TouchableOpacity>
  );
}

export default function AdminDashboard({
  users,
  theme,
  loading = false,
  assignPatientId,
  assignDoctorId,
  changeRoleUserId,
  changeRoleNewVal,
  onAssignPatientId,
  onAssignDoctorId,
  onChangeRoleUserId,
  onChangeRoleNewVal,
  onAssign,
  onChangeRole,
}: Props) {
  const palette = Colors[theme];
  const isDark = theme === 'dark';
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [assignPatientQuery, setAssignPatientQuery] = useState('');
  const [assignDoctorQuery, setAssignDoctorQuery] = useState('');
  const [roleUserQuery, setRoleUserQuery] = useState('');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [directoryRole, setDirectoryRole] = useState<AdminRoleFilter>('ALL');

  const colors = useMemo(() => ({
    bg: palette.background,
    surface: palette.cardBackground,
    card: isDark ? '#152038' : '#F8FAFC',
    text: palette.text,
    muted: palette.subtext,
    accent: palette.primary,
    accentDark: palette.primaryDark,
    purple: palette.purpleAccent,
    border: palette.cardBorder,
    danger: palette.alertHighRisk,
    warning: palette.alertWarning,
    selectedBg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
    inputBg: palette.inputBg,
  }), [palette, isDark]);

  const patients = useMemo(() => users.filter((u) => u.role === 'PACIENTE'), [users]);
  const doctors = useMemo(() => users.filter((u) => u.role === 'CUIDADOR'), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === 'ADMIN'), [users]);
  const unassigned = useMemo(
    () => patients.filter((p) => !p.caregiver_name),
    [patients],
  );

  const filteredPatients = useMemo(
    () => patients.filter((p) => matchesQuery(p, assignPatientQuery)),
    [patients, assignPatientQuery],
  );
  const filteredDoctors = useMemo(
    () => doctors.filter((d) => matchesQuery(d, assignDoctorQuery)),
    [doctors, assignDoctorQuery],
  );
  const filteredRoleUsers = useMemo(
    () => users.filter((u) => matchesQuery(u, roleUserQuery)),
    [users, roleUserQuery],
  );
  const directoryUsers = useMemo(() => {
    return users
      .filter((u) => (directoryRole === 'ALL' ? true : u.role === directoryRole))
      .filter((u) => matchesQuery(u, directoryQuery))
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));
  }, [users, directoryRole, directoryQuery]);

  const selectedPatient = patients.find((p) => p.id === assignPatientId);
  const selectedDoctor = doctors.find((d) => d.id === assignDoctorId);
  const selectedRoleUser = users.find((u) => u.id === changeRoleUserId);

  const canAssign = !!assignPatientId && !!assignDoctorId && !loading;
  const canChangeRole = !!changeRoleUserId && !loading;

  const confirmChangeRole = () => {
    if (!selectedRoleUser) return;
    const next = roleLabel(changeRoleNewVal);
    const prev = roleLabel(selectedRoleUser.role);
    const message = `¿Cambiar el rol de ${displayName(selectedRoleUser)} de ${prev} a ${next}?`;

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm(message) : true;
      if (ok) onChangeRole();
      return;
    }

    Alert.alert('Confirmar cambio de rol', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: onChangeRole },
    ]);
  };

  const roleFilters: { key: AdminRoleFilter; label: string }[] = [
    { key: 'ALL', label: 'Todos' },
    { key: 'PACIENTE', label: 'Pacientes' },
    { key: 'CUIDADOR', label: 'Doctores' },
    { key: 'ADMIN', label: 'Admins' },
  ];

  const badgeStyle = (role: string) => {
    if (role === 'ADMIN') {
      return {
        bg: isDark ? 'rgba(248, 113, 113, 0.18)' : '#FEE2E2',
        border: isDark ? 'rgba(248, 113, 113, 0.45)' : '#FECACA',
        text: isDark ? '#FCA5A5' : '#B91C1C',
      };
    }
    if (role === 'CUIDADOR') {
      return {
        bg: isDark ? 'rgba(45, 212, 191, 0.16)' : '#CCFBF1',
        border: isDark ? 'rgba(45, 212, 191, 0.45)' : '#99F6E4',
        text: isDark ? '#5EEAD4' : '#0F766E',
      };
    }
    return {
      bg: isDark ? 'rgba(96, 165, 250, 0.16)' : '#DBEAFE',
      border: isDark ? 'rgba(96, 165, 250, 0.45)' : '#BFDBFE',
      text: isDark ? '#93C5FD' : '#1D4ED8',
    };
  };

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroLeft}>
          <View style={[styles.heroIcon, { backgroundColor: `${colors.accent}18` }]}>
            <Ionicons name="shield-checkmark" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Panel de Administración</Text>
            <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
              Gestiona cuentas, asignaciones clínicas y roles del sistema GDD-T2.
            </Text>
          </View>
        </View>
        {loading && <ActivityIndicator color={colors.accent} />}
      </View>

      <View style={[styles.kpiRow, isWide && styles.kpiRowWide]}>
        <KpiCard
          icon="people"
          label="Cuentas"
          value={users.length}
          accent={colors.accent}
          surface={colors.surface}
          border={colors.border}
          text={colors.text}
          muted={colors.muted}
        />
        <KpiCard
          icon="fitness"
          label="Pacientes"
          value={patients.length}
          accent="#2563EB"
          surface={colors.surface}
          border={colors.border}
          text={colors.text}
          muted={colors.muted}
        />
        <KpiCard
          icon="medkit"
          label="Doctores"
          value={doctors.length}
          accent={colors.accentDark}
          surface={colors.surface}
          border={colors.border}
          text={colors.text}
          muted={colors.muted}
        />
        <KpiCard
          icon="key"
          label="Admins"
          value={admins.length}
          accent={colors.purple}
          surface={colors.surface}
          border={colors.border}
          text={colors.text}
          muted={colors.muted}
        />
        <KpiCard
          icon="alert-circle"
          label="Sin asignar"
          value={unassigned.length}
          accent={colors.warning}
          surface={colors.surface}
          border={colors.border}
          text={colors.text}
          muted={colors.muted}
        />
      </View>

      <View style={[styles.actionsRow, isWide && styles.actionsRowWide]}>
        {/* Asignar paciente */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, isWide && styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Ionicons name="link" size={18} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Asignar Paciente a Doctor</Text>
          </View>
          <Text style={[styles.cardHint, { color: colors.muted }]}>
            Elige un paciente y un doctor para crear o actualizar la relación clínica.
          </Text>

          <Text style={[styles.inputLabel, { color: colors.muted }]}>1. Seleccionar paciente</Text>
          <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              value={assignPatientQuery}
              onChangeText={setAssignPatientQuery}
              placeholder="Buscar paciente..."
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          <View style={[styles.pickerBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {filteredPatients.length === 0 ? (
                <Text style={[styles.emptyInline, { color: colors.muted }]}>Sin pacientes coincidentes.</Text>
              ) : (
                filteredPatients.map((p) => (
                  <UserPickRow
                    key={p.id}
                    user={p}
                    selected={assignPatientId === p.id}
                    onPress={() => onAssignPatientId(p.id)}
                    colors={colors}
                    subtitle={p.caregiver_name ? `Actual: ${p.caregiver_name}` : 'Sin doctor asignado'}
                  />
                ))
              )}
            </ScrollView>
          </View>

          <Text style={[styles.inputLabel, { color: colors.muted }]}>2. Seleccionar doctor</Text>
          <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              value={assignDoctorQuery}
              onChangeText={setAssignDoctorQuery}
              placeholder="Buscar doctor..."
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          <View style={[styles.pickerBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {filteredDoctors.length === 0 ? (
                <Text style={[styles.emptyInline, { color: colors.muted }]}>Sin doctores coincidentes.</Text>
              ) : (
                filteredDoctors.map((d) => (
                  <UserPickRow
                    key={d.id}
                    user={d}
                    selected={assignDoctorId === d.id}
                    onPress={() => onAssignDoctorId(d.id)}
                    colors={colors}
                    subtitle="Doctor / Cuidador"
                  />
                ))
              )}
            </ScrollView>
          </View>

          {(selectedPatient || selectedDoctor) && (
            <View style={[styles.summaryBox, { backgroundColor: colors.selectedBg, borderColor: colors.accent }]}>
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {selectedPatient ? displayName(selectedPatient) : 'Paciente…'}
                {'  →  '}
                {selectedDoctor ? `Dr. ${displayName(selectedDoctor)}` : 'Doctor…'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: canAssign ? colors.accent : colors.border }]}
            onPress={onAssign}
            disabled={!canAssign}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Asignar Relación</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Cambiar rol */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, isWide && styles.cardHalf]}>
          <View style={styles.cardHeader}>
            <Ionicons name="swap-horizontal" size={18} color={colors.purple} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Cambiar Rol de Usuario</Text>
          </View>
          <Text style={[styles.cardHint, { color: colors.muted }]}>
            Actualiza el rol del sistema. Requiere confirmación antes de aplicar el cambio.
          </Text>

          <Text style={[styles.inputLabel, { color: colors.muted }]}>1. Selecciona el usuario</Text>
          <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              value={roleUserQuery}
              onChangeText={setRoleUserQuery}
              placeholder="Buscar usuario..."
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>
          <View style={[styles.pickerBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {filteredRoleUsers.length === 0 ? (
                <Text style={[styles.emptyInline, { color: colors.muted }]}>Sin usuarios coincidentes.</Text>
              ) : (
                filteredRoleUsers.map((u) => (
                  <UserPickRow
                    key={u.id}
                    user={u}
                    selected={changeRoleUserId === u.id}
                    onPress={() => onChangeRoleUserId(u.id)}
                    colors={colors}
                    subtitle={`Rol actual: ${roleLabel(u.role)}`}
                  />
                ))
              )}
            </ScrollView>
          </View>

          <Text style={[styles.inputLabel, { color: colors.muted }]}>2. Nuevo rol</Text>
          <View style={styles.roleRow}>
            {([
              { key: 'PACIENTE' as const, label: 'Paciente', icon: 'fitness' as const },
              { key: 'CUIDADOR' as const, label: 'Doctor', icon: 'medkit' as const },
              { key: 'ADMIN' as const, label: 'Admin', icon: 'shield' as const },
            ]).map((role) => {
              const active = changeRoleNewVal === role.key;
              return (
                <TouchableOpacity
                  key={role.key}
                  style={[
                    styles.roleChip,
                    {
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.selectedBg : colors.card,
                    },
                  ]}
                  onPress={() => onChangeRoleNewVal(role.key)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={role.icon} size={14} color={active ? colors.accent : colors.muted} />
                  <Text style={{ color: active ? colors.accent : colors.muted, fontWeight: '700', fontSize: 12 }}>
                    {role.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedRoleUser && (
            <View style={[styles.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {displayName(selectedRoleUser)}: {roleLabel(selectedRoleUser.role)} → {roleLabel(changeRoleNewVal)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: canChangeRole ? colors.purple : colors.border }]}
            onPress={confirmChangeRole}
            disabled={!canChangeRole}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Actualizar Rol</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Directorio */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="list" size={18} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Directorio de Cuentas</Text>
        </View>
        <Text style={[styles.cardHint, { color: colors.muted }]}>
          {directoryUsers.length} resultado{directoryUsers.length === 1 ? '' : 's'}
          {directoryQuery || directoryRole !== 'ALL' ? ' filtrados' : ' registrados'}
        </Text>

        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            value={directoryQuery}
            onChangeText={setDirectoryQuery}
            placeholder="Buscar por nombre o correo..."
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {roleFilters.map((f) => {
              const active = directoryRole === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setDirectoryRole(f.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.accent : colors.card,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? '#fff' : colors.muted, fontWeight: '700', fontSize: 12 }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {directoryUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={28} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin resultados</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Prueba con otro término de búsqueda o cambia el filtro de rol.
            </Text>
          </View>
        ) : (
          directoryUsers.map((u) => {
            const badge = badgeStyle(u.role);
            return (
              <View
                key={u.id}
                style={[styles.directoryItem, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <View style={[styles.avatar, { backgroundColor: `${colors.accent}22` }]}>
                  <Text style={[styles.avatarText, { color: colors.accent }]}>{initials(u)}</Text>
                </View>
                <View style={styles.directoryMeta}>
                  <Text style={[styles.userPickName, { color: colors.text }]} numberOfLines={1}>
                    {displayName(u)}
                  </Text>
                  <Text style={[styles.userPickEmail, { color: colors.muted }]} numberOfLines={1}>
                    {u.email}
                  </Text>
                  {u.role === 'PACIENTE' && (
                    <Text style={[styles.userPickSub, { color: u.caregiver_name ? colors.accent : colors.warning }]} numberOfLines={1}>
                      {u.caregiver_name ? `Asignado a: ${u.caregiver_name}` : 'Sin doctor asignado'}
                    </Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>{roleLabel(u.role).toUpperCase()}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
    paddingBottom: 8,
  },
  hero: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiRowWide: {
    flexWrap: 'nowrap',
  },
  kpiCard: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actionsRow: {
    gap: 16,
  },
  actionsRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
  },
  cardHalf: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  pickerBox: {
    height: 170,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 6,
  },
  pickerScroll: {
    flex: 1,
  },
  userPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
  },
  userPickMeta: {
    flex: 1,
    minWidth: 0,
  },
  userPickName: {
    fontSize: 13,
    fontWeight: '700',
  },
  userPickEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  userPickSub: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  summaryBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  primaryBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  roleChip: {
    flexGrow: 1,
    minWidth: 90,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  directoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  directoryMeta: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptyInline: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 17,
  },
});
