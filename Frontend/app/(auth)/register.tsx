import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

// ── Palette (misma que login) ─────────────────────────────────────────────────
const COLORS = {
  bg: '#0D1B2A',
  surface: '#132337',
  card: '#1A2E47',
  accent: '#00C9A7',
  accentDark: '#00A087',
  text: '#EEF2F7',
  textMuted: '#7A92A9',
  error: '#FF6B6B',
  success: '#4CAF93',
  border: '#1F3550',
  borderFocus: '#00C9A7',
};

interface FieldConfig {
  key: keyof FormData;
  label: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words';
  isPassword?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: 'first_name', label: 'Nombre', placeholder: 'Tu nombre', icon: 'person-outline', autoCapitalize: 'words' },
  { key: 'last_name', label: 'Apellido', placeholder: 'Tu apellido', icon: 'person-outline', autoCapitalize: 'words' },
  { key: 'email', label: 'Correo electrónico', placeholder: 'tu@correo.com', icon: 'mail-outline', keyboardType: 'email-address', autoCapitalize: 'none' },
  { key: 'password', label: 'Contraseña', placeholder: 'Mínimo 8 caracteres', icon: 'lock-closed-outline', isPassword: true, autoCapitalize: 'none' },
];

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export default function RegisterScreen() {
  const { register } = useAuth();

  const [form, setForm] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const buttonScale = useRef(new Animated.Value(1)).current;

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const validate = (): string | null => {
    if (!form.first_name.trim()) return 'Ingresa tu nombre';
    if (!form.last_name.trim()) return 'Ingresa tu apellido';
    if (!form.email.trim()) return 'Ingresa tu correo electrónico';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Correo electrónico inválido';
    if (!form.password) return 'Ingresa una contraseña';
    if (form.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    return null;
  };

  const handleRegister = async () => {
    setError('');
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    animateButton();
    setIsLoading(true);
    try {
      await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message ?? 'Error al crear la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Glow blobs */}
      <View style={styles.bgGlow} />
      <View style={styles.bgGlow2} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[COLORS.accent, COLORS.accentDark]}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="person-add" size={30} color="#fff" />
              </LinearGradient>
              <View style={styles.logoHalo} />
            </View>

            <Text style={styles.appName}>GDD-T2</Text>
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>
              Regístrate para comenzar tu seguimiento nutricional
            </Text>

            {/* Role badge */}
            <View style={styles.roleBadge}>
              <Ionicons name="medical-outline" size={12} color={COLORS.accent} />
              <Text style={styles.roleBadgeText}>Cuenta de Paciente</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {FIELDS.map((field) => (
              <View key={field.key} style={styles.fieldWrapper}>
                <Text style={styles.label}>{field.label}</Text>
                <View
                  style={[
                    styles.inputRow,
                    focusedField === field.key && styles.inputRowFocus,
                  ]}
                >
                  <Ionicons
                    name={field.icon}
                    size={18}
                    color={focusedField === field.key ? COLORS.accent : COLORS.textMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor={COLORS.textMuted}
                    value={form[field.key]}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, [field.key]: text }))}
                    keyboardType={field.keyboardType ?? 'default'}
                    autoCapitalize={field.autoCapitalize ?? 'none'}
                    autoCorrect={false}
                    secureTextEntry={field.isPassword && !showPassword}
                    onFocus={() => setFocusedField(field.key)}
                    onBlur={() => setFocusedField(null)}
                    selectionColor={COLORS.accent}
                  />
                  {field.isPassword && (
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* Password strength hint */}
            {form.password.length > 0 && (
              <View style={styles.passwordHint}>
                <View style={[
                  styles.strengthBar,
                  { backgroundColor: form.password.length >= 8 ? COLORS.success : COLORS.error },
                ]} />
                <Text style={[
                  styles.strengthText,
                  { color: form.password.length >= 8 ? COLORS.success : COLORS.error },
                ]}>
                  {form.password.length >= 12
                    ? 'Contraseña fuerte'
                    : form.password.length >= 8
                    ? 'Contraseña aceptable'
                    : 'Muy corta (mínimo 8 caracteres)'}
                </Text>
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit */}
            <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 8 }}>
              <TouchableOpacity
                style={styles.registerBtn}
                onPress={handleRegister}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[COLORS.accent, COLORS.accentDark]}
                  style={styles.registerBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.registerBtnText}>Crear cuenta</Text>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Login link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginRowText}>¿Ya tienes cuenta? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
                <Text style={styles.loginRowLink}>Iniciar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },

  bgGlow: {
    position: 'absolute',
    top: 100,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#00C9A712',
  },
  bgGlow2: {
    position: 'absolute',
    bottom: 40,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#00A08710',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 50,
    paddingBottom: 40,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  header: { alignItems: 'center', marginBottom: 28 },

  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#00C9A7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      web: {
        // @ts-ignore
        boxShadow: '0px 4px 10px rgba(0, 201, 167, 0.4)',
      },
      default: {},
    }),
  },
  logoHalo: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#00C9A710',
    zIndex: -1,
  },

  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
  },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00C9A715',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#00C9A730',
  },
  roleBadgeText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },

  form: { width: '100%' },

  fieldWrapper: { marginBottom: 14 },

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 7,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 50,
  },
  inputRowFocus: { borderColor: COLORS.borderFocus, backgroundColor: '#1E3655' },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  eyeBtn: { padding: 4 },

  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 2,
  },
  strengthBar: { width: 4, height: 14, borderRadius: 2 },
  strengthText: { fontSize: 12 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B18',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
  },
  errorText: { color: COLORS.error, fontSize: 13, flex: 1 },

  registerBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#00C9A7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      web: {
        // @ts-ignore
        boxShadow: '0px 4px 10px rgba(0, 201, 167, 0.35)',
      },
      default: {},
    }),
  },
  registerBtnGradient: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  registerBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginRowText: { color: COLORS.textMuted, fontSize: 14 },
  loginRowLink: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});
