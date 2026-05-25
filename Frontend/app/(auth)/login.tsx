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
  Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// ── Palette ───────────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#0D1B2A',
  surface: '#132337',
  card: '#1A2E47',
  accent: '#00C9A7',
  accentDark: '#00A087',
  accentLight: '#4DDFCA',
  text: '#EEF2F7',
  textMuted: '#7A92A9',
  error: '#FF6B6B',
  border: '#1F3550',
  borderFocus: '#00C9A7',
};

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Animación del botón al presionar
  const buttonScale = useRef(new Animated.Value(1)).current;

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) { setError('Ingresa tu correo electrónico'); return; }
    if (!password) { setError('Ingresa tu contraseña'); return; }

    animateButton();
    setIsLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Fondo con gradiente radial simulado */}
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
          {/* ── Logo & Branding ── */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={[COLORS.accent, COLORS.accentDark]}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="leaf" size={36} color="#fff" />
              </LinearGradient>
              {/* Halo glow */}
              <View style={styles.logoHalo} />
            </View>

            <Text style={styles.appName}>GDD-T2</Text>
            <Text style={styles.appTagline}>Gestión Dietética para Diabetes Tipo 2</Text>

            <View style={styles.divider} />

            <Text style={styles.welcomeTitle}>Bienvenido de vuelta</Text>
            <Text style={styles.welcomeSubtitle}>
              Inicia sesión para continuar con tu seguimiento
            </Text>
          </View>

          {/* ── Formulario ── */}
          <View style={styles.form}>

            {/* Email */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Correo electrónico</Text>
              <View style={[styles.inputRow, emailFocused && styles.inputRowFocus]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={emailFocused ? COLORS.accent : COLORS.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="tu@correo.com"
                  placeholderTextColor={COLORS.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  selectionColor={COLORS.accent}
                />
              </View>
            </View>

            {/* Contraseña */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={[styles.inputRow, passwordFocused && styles.inputRowFocus]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={passwordFocused ? COLORS.accent : COLORS.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  selectionColor={COLORS.accent}
                />
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
              </View>
            </View>

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Botón login */}
            <Animated.View style={{ transform: [{ scale: buttonScale }], marginTop: 8 }}>
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[COLORS.accent, COLORS.accentDark]}
                  style={styles.loginBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Separator */}
            <View style={styles.separatorRow}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>¿Nuevo en GDD-T2?</Text>
              <View style={styles.separatorLine} />
            </View>

            {/* Register link */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.75}
            >
              <Text style={styles.registerBtnText}>Crear una cuenta</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            GDD-T2 · Sistema de gestión nutricional{'\n'}para pacientes con Diabetes Tipo 2
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },

  // Glow bg blobs
  bgGlow: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#00C9A715',
  },
  bgGlow2: {
    position: 'absolute',
    bottom: 60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#00A08710',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // ── Header ──
  header: { alignItems: 'center', marginBottom: 36 },

  logoContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoGradient: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#00C9A7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
      },
      web: {
        // @ts-ignore
        boxShadow: '0px 6px 12px rgba(0, 201, 167, 0.45)',
      },
      default: {},
    }),
  },
  logoHalo: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00C9A712',
    zIndex: -1,
  },

  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 2,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 12,
    color: COLORS.accent,
    letterSpacing: 0.5,
    textAlign: 'center',
    fontWeight: '500',
  },

  divider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
    marginVertical: 20,
    opacity: 0.6,
  },

  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Form ──
  form: { width: '100%' },

  fieldWrapper: { marginBottom: 16 },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 8,
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
    height: 52,
  },
  inputRowFocus: {
    borderColor: COLORS.borderFocus,
    backgroundColor: '#1E3655',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '400',
  },
  eyeBtn: { padding: 4 },

  // Error
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

  // Login button
  loginBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 8,
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
  loginBtnGradient: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Separator
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
    gap: 10,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  separatorText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '500' },

  // Register button
  registerBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    marginTop: 32,
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 18,
    opacity: 0.7,
  },
});
