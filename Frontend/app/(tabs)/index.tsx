import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
  Image,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Colors, ClinicalColors } from '../../constants/theme';
import { getAccessToken } from '../../services/authService';
import * as ImagePicker from 'expo-image-picker';
import DoctorClinicalReports from '../../components/doctor/DoctorClinicalReports';
import AdminDashboard from '../../components/admin/AdminDashboard';
import type { AdminRole } from '../../types/admin';

const { width } = Dimensions.get('window');

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000'
);

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const palette = Colors[theme];

  const clinical = ClinicalColors[theme];
  const COLORS = React.useMemo(() => ({
    bg: palette.background,
    surface: palette.cardBackground,
    card: palette.cardBackground,
    accent: palette.primary,
    accentDark: palette.primaryDark,
    accentLight: palette.primary,
    purple: palette.purpleAccent,
    purpleText: palette.purpleText,
    purpleBg: palette.purpleLightBg,
    text: palette.text,
    textMuted: palette.subtext,
    error: palette.alertHighRisk,
    danger: palette.alertHighRisk,
    warning: palette.alertWarning,
    success: palette.success,
    info: palette.alertInfo,
    border: palette.cardBorder,
    borderFocus: palette.purpleAccent,
    clinical,
  }), [palette, clinical]);

  const styles = React.useMemo(() => getStyles(COLORS, isDark), [COLORS, isDark]);
  
  // ── States ─────────────────────────────────────────────────────────────────
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'actions'>('overview');
  const [loading, setLoading] = useState(false);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    if (y > 20 && !isScrolled) {
      setIsScrolled(true);
    } else if (y <= 20 && isScrolled) {
      setIsScrolled(false);
    }
  };
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── 1. Patient States ──
  const [foodName, setFoodName] = useState('');
  const [portion, setPortion] = useState('');
  const [calories, setCalories] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [glycemicIndex, setGlycemicIndex] = useState('');
  const [glycemicLoad, setGlycemicLoad] = useState('');
  const [mealType, setMealType] = useState<'DESAYUNO' | 'ALMUERZO' | 'CENA' | 'MERIENDA'>('DESAYUNO');
  const [intakeHistory, setIntakeHistory] = useState<any[]>([]);
  const [aiRules, setAiRules] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [scanningImage, setScanningImage] = useState(false);
  const [foodImageBase64, setFoodImageBase64] = useState<string | null>(null);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [addIntakeModalVisible, setAddIntakeModalVisible] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentWeekAnchor, setCurrentWeekAnchor] = useState<Date>(new Date());
  const [selectedFoodPhoto, setSelectedFoodPhoto] = useState<any | null>(null);
  const [aiMealSuggestionNotice, setAiMealSuggestionNotice] = useState<string>('');

  // RF-02 Metabolic Hub States
  const [activeMetabolicTab, setActiveMetabolicTab] = useState<'GLUCOSE' | 'ANTHRO' | 'MEDS' | 'ACTIVITY'>('GLUCOSE');
  const [glucoseLevelInput, setGlucoseLevelInput] = useState('');
  const [glucoseContext, setGlucoseContext] = useState<'AYUNAS' | 'ANTES_COMIDA' | 'DESPUES_COMIDA' | 'MADRUGADA'>('AYUNAS');
  const [glucoseLogs, setGlucoseLogs] = useState<any[]>([]);
  const [anthroWeightInput, setAnthroWeightInput] = useState('');
  const [anthroHeightInput, setAnthroHeightInput] = useState('');
  const [anthroLogs, setAnthroLogs] = useState<any[]>([]);
  const [medNameInput, setMedNameInput] = useState('');
  const [medDosageInput, setMedDosageInput] = useState('');
  const [medLogs, setMedLogs] = useState<any[]>([]);
  const [activityTypeInput, setActivityTypeInput] = useState('');
  const [activityDurationInput, setActivityDurationInput] = useState('');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [intakeTimeInput, setIntakeTimeInput] = useState('');
  const [docPatientMetabolicSummary, setDocPatientMetabolicSummary] = useState<any | null>(null);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [aiChatModalVisible, setAiChatModalVisible] = useState(false);
  const [aiSessions, setAiSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileForm, setProfileForm] = useState({
    date_of_birth: '1990-01-01',
    gender: '',
    weight_kg: '',
    height_cm: '',
    diabetes_type: 'Tipo 2',
    diagnosis_year: '',
    last_hba1c: '',
    medications: '',
    allergies: '',
    activity_level: 'Moderado',
    medical_history: '',
  });
  const [incidentsList, setIncidentsList] = useState<any[]>([]);
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    description: '',
    pain_level: 5,
    doctor_question: '',
  });
  const [submittingIncident, setSubmittingIncident] = useState(false);

  // Chat IA
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // ── 2. Doctor States ──
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [docAiRules, setDocAiRules] = useState('');
  const [docRecommendations, setDocRecommendations] = useState('');
  const [selectedPatientIntakes, setSelectedPatientIntakes] = useState<any[]>([]);
  const [loadingPatientIntakes, setLoadingPatientIntakes] = useState(false);
  const [doctorIncidents, setDoctorIncidents] = useState<any[]>([]);
  const [incidentResponseText, setIncidentResponseText] = useState<{ [key: string]: string }>({});
  const [assessingIntakeId, setAssessingIntakeId] = useState<string | null>(null);
  const [assessmentRating, setAssessmentRating] = useState<'CORRECTA' | 'INCORRECTA'>('CORRECTA');
  const [assessmentComment, setAssessmentComment] = useState('');
  const [savingAssessment, setSavingAssessment] = useState(false);
  const [docMealSchedule, setDocMealSchedule] = useState<{
    timezone: string;
    advance_minutes: number;
    enabled: boolean;
    slots: { meal_type: string; meal_time: string; enabled: boolean }[];
  } | null>(null);
  const [loadingMealSchedule, setLoadingMealSchedule] = useState(false);
  const [savingMealSchedule, setSavingMealSchedule] = useState(false);

  // ── 3. Admin States ──
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [assignPatientId, setAssignPatientId] = useState('');
  const [assignDoctorId, setAssignDoctorId] = useState('');
  const [changeRoleUserId, setChangeRoleUserId] = useState('');
  const [changeRoleNewVal, setChangeRoleNewVal] = useState<AdminRole>('CUIDADOR');

  // ── Loaders ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      loadRoleData();
    }
  }, [user]);

  const loadRoleData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      if (user?.role === 'PACIENTE') {
        // Cargar historial de comidas
        const resIntakes = await fetch(`${API_URL}/dashboard/patient/intakes`, { headers });
        if (resIntakes.ok) {
          const data = await resIntakes.json();
          setIntakeHistory(data);
        }

        // Cargar reglas de IA / Recomendaciones
        const resRecs = await fetch(`${API_URL}/dashboard/patient/recommendation`, { headers });
        if (resRecs.ok) {
          const data = await resRecs.json();
          setAiRules(data.ai_rules || '');
          setRecommendations(data.recommendations || '');
          setDoctorName(data.doctor_name || '');
        }

        // Cargar Perfil Clínico Completo del Paciente
        const resProfile = await fetch(`${API_URL}/dashboard/patient/profile`, { headers });
        if (resProfile.ok) {
          const profileData = await resProfile.json();
          setPatientProfile(profileData);
          
          setProfileForm({
            date_of_birth: profileData.date_of_birth || '1990-01-01',
            gender: profileData.gender || '',
            weight_kg: profileData.weight_kg ? String(profileData.weight_kg) : '',
            height_cm: profileData.height_cm ? String(profileData.height_cm) : '',
            diabetes_type: profileData.diabetes_type || 'Tipo 2',
            diagnosis_year: profileData.diagnosis_year ? String(profileData.diagnosis_year) : '',
            last_hba1c: profileData.last_hba1c ? String(profileData.last_hba1c) : '',
            medications: profileData.medications || '',
            allergies: profileData.allergies || '',
            activity_level: profileData.activity_level || 'Moderado',
            medical_history: profileData.medical_history || '',
          });

          // Pre-llenar datos antropométricos e iniciales desde la Ficha Médica
          if (profileData.weight_kg && !anthroWeightInput) setAnthroWeightInput(String(profileData.weight_kg));
          if (profileData.height_cm && !anthroHeightInput) setAnthroHeightInput(String(profileData.height_cm));
          if (profileData.medications && !medNameInput) setMedNameInput(profileData.medications);
        }

        // Cargar historial de malestares e incidencias
        const resIncidents = await fetch(`${API_URL}/dashboard/patient/incidents`, { headers });
        if (resIncidents.ok) {
          const data = await resIncidents.json();
          setIncidentsList(data);
        }

        // Cargar registros RF-02 (Glucemia, Antropometría/IMC, Medicación, Actividad Física)
        const resGlucose = await fetch(`${API_URL}/dashboard/patient/glucose`, { headers });
        if (resGlucose.ok) setGlucoseLogs(await resGlucose.json());

        const resAnthro = await fetch(`${API_URL}/dashboard/patient/anthropometric`, { headers });
        if (resAnthro.ok) setAnthroLogs(await resAnthro.json());

        const resMeds = await fetch(`${API_URL}/dashboard/patient/medication`, { headers });
        if (resMeds.ok) setMedLogs(await resMeds.json());

        const resAct = await fetch(`${API_URL}/dashboard/patient/physical-activity`, { headers });
        if (resAct.ok) setActivityLogs(await resAct.json());
      } 
      else if (user?.role === 'CUIDADOR') {
        // Cargar pacientes del doctor
        const resPatients = await fetch(`${API_URL}/dashboard/doctor/patients`, { headers });
        if (resPatients.ok) {
          const data = await resPatients.json();
          setPatientsList(data);
        }

        // Cargar todas las incidencias de sus pacientes a cargo
        const resIncidents = await fetch(`${API_URL}/dashboard/doctor/incidents`, { headers });
        if (resIncidents.ok) {
          const data = await resIncidents.json();
          setDoctorIncidents(data);
        }
      } 
      else if (user?.role === 'ADMIN') {
        // Cargar todos los usuarios
        const resUsers = await fetch(`${API_URL}/dashboard/admin/users`, { headers });
        if (resUsers.ok) {
          const data = await resUsers.json();
          setAllUsersList(data);
        }
      }
    } catch (err: any) {
      setError('Error al sincronizar datos de la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  // A. Paciente: Guardar Perfil Clínico con Validaciones
  const handleSavePatientProfile = async () => {
    setError('');
    setSuccessMsg('');

    // Validaciones de Formato y Rango
    if (profileForm.date_of_birth) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const cleanDate = profileForm.date_of_birth.trim().replace(/ /g, '-').replace(/\//g, '-');
      if (!dateRegex.test(cleanDate)) {
        setError('Ingresa la fecha de nacimiento en formato AAAA-MM-DD (ej: 1990-01-01)');
        return;
      }
    }

    if (profileForm.weight_kg) {
      const w = Number(profileForm.weight_kg);
      if (isNaN(w) || w < 20 || w > 350) {
        setError('El peso debe ser un número válido entre 20 kg y 350 kg');
        return;
      }
    }

    if (profileForm.height_cm) {
      const h = Number(profileForm.height_cm);
      if (isNaN(h) || h < 50 || h > 260) {
        setError('La estatura debe ser un número válido entre 50 cm y 260 cm');
        return;
      }
    }

    if (profileForm.last_hba1c) {
      const hba = Number(profileForm.last_hba1c);
      if (isNaN(hba) || hba < 3.0 || hba > 20.0) {
        setError('La HbA1c debe ser un número válido entre 3.0% y 20.0%');
        return;
      }
    }

    if (profileForm.diagnosis_year) {
      const yr = Number(profileForm.diagnosis_year);
      const currentYear = new Date().getFullYear();
      if (isNaN(yr) || yr < 1920 || yr > currentYear) {
        setError(`El año de diagnóstico debe estar entre 1920 y ${currentYear}`);
        return;
      }
    }

    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const payload = {
        date_of_birth: profileForm.date_of_birth ? profileForm.date_of_birth.trim().replace(/ /g, '-').replace(/\//g, '-') : null,
        gender: profileForm.gender ? profileForm.gender.trim() : null,
        weight_kg: profileForm.weight_kg ? Number(profileForm.weight_kg) : null,
        height_cm: profileForm.height_cm ? Number(profileForm.height_cm) : null,
        diabetes_type: profileForm.diabetes_type ? profileForm.diabetes_type.trim() : null,
        diagnosis_year: profileForm.diagnosis_year ? Number(profileForm.diagnosis_year) : null,
        last_hba1c: profileForm.last_hba1c ? Number(profileForm.last_hba1c) : null,
        medications: profileForm.medications ? profileForm.medications.trim() : null,
        allergies: profileForm.allergies ? profileForm.allergies.trim() : null,
        activity_level: profileForm.activity_level ? profileForm.activity_level.trim() : null,
        medical_history: profileForm.medical_history ? profileForm.medical_history.trim() : null,
      };

      const res = await fetch(`${API_URL}/dashboard/patient/profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al actualizar el perfil clínico');
      }

      setSuccessMsg('¡Perfil clínico guardado correctamente!');
      setProfileModalVisible(false);
      await loadRoleData();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  // A. Paciente: Escanear Plato con IA
  const handleScanPlate = async () => {
    setError('');
    setSuccessMsg('');
    setScanningImage(true);

    try {
      // 1. Solicitar permisos de cámara
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      let result;
      if (cameraPermission.granted) {
        // Lanzar cámara si tiene permiso
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.5,
          base64: true,
        });
      } else {
        // Si no hay permiso o está en Simulador/Web, usar galería/archivos como fallback seguro
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.5,
          base64: true,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setScanningImage(false);
        return;
      }

      const base64Data = result.assets[0].base64;
      if (!base64Data) {
        throw new Error('No se pudo procesar la imagen elegida.');
      }

      // 2. Enviar base64 a la IA para analizar el plato
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/analyze-food`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image_base64: base64Data,
          mime_type: 'image/jpeg',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'La IA no pudo analizar la imagen.');
      }

      const parsedResult = await res.json();

      // 3. Rellenar campos sin sobreescribir la categoría elegida por el usuario
      setFoodName(parsedResult.food_name);
      setPortion(String(parsedResult.portion_size_g));
      setCalories(
        parsedResult.calories != null && parsedResult.calories !== ''
          ? String(Math.round(Number(parsedResult.calories)))
          : ''
      );
      setCarbsG(
        parsedResult.carbs_g != null && parsedResult.carbs_g !== ''
          ? String(Number(parsedResult.carbs_g))
          : ''
      );
      setGlycemicIndex(
        parsedResult.glycemic_index != null && parsedResult.glycemic_index !== ''
          ? String(Number(parsedResult.glycemic_index))
          : ''
      );
      setGlycemicLoad(
        parsedResult.glycemic_load != null && parsedResult.glycemic_load !== ''
          ? String(Number(parsedResult.glycemic_load))
          : ''
      );
      setFoodImageBase64(base64Data);

      const aiType = (parsedResult.meal_type || '').toUpperCase();
      const validTypes = ['DESAYUNO', 'ALMUERZO', 'CENA', 'MERIENDA'];
      
      if (validTypes.includes(aiType) && aiType !== mealType) {
        setAiMealSuggestionNotice(`La IA sugiere ${aiType}, pero mantuvimos tu categoría (${mealType}). Puedes cambiarla abajo si deseas.`);
      } else {
        setAiMealSuggestionNotice('');
      }

      setAddIntakeModalVisible(true);
      setSuccessMsg('La IA ha reconocido tu plato. Revisa los datos y presiona Guardar.');
    } catch (err: any) {
      setError(err.message ?? 'Error al escanear plato.');
    } finally {
      setScanningImage(false);
    }
  };

  // A. Paciente: Registrar Comida con Hora Exacta
  const handleRegisterIntake = async () => {
    setError(''); setSuccessMsg('');
    if (!foodName.trim()) { setError('Ingresa el nombre del alimento'); return; }
    const pVal = Number(portion);
    if (!portion || isNaN(pVal) || pVal <= 0 || pVal > 99999) { setError('Ingresa una porción válida en gramos (1g - 99,999g)'); return; }

    setLoading(true);
    try {
      const token = await getAccessToken();
      let timeStr = '';
      if (intakeTimeInput && intakeTimeInput.trim().includes(':')) {
        const parts = intakeTimeInput.trim().split(':');
        const h = String(parts[0] || '00').padStart(2, '0');
        const m = String(parts[1] || '00').padStart(2, '0');
        timeStr = `${h}:${m}:00`;
      } else {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        timeStr = `${hours}:${mins}:${secs}`;
      }
      const fullTimestamp = `${selectedCalendarDate}T${timeStr}`;

      const res = await fetch(`${API_URL}/dashboard/patient/intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          food_name: foodName.trim(),
          portion_size_g: Number(portion),
          meal_type: mealType,
          image_base64: foodImageBase64,
          consumed_at: fullTimestamp,
          calories: calories.trim() ? Number(calories) : null,
          carbs_g: carbsG.trim() ? Number(carbsG) : null,
          glycemic_index: glycemicIndex.trim() ? Number(glycemicIndex) : null,
          glycemic_load: glycemicLoad.trim() ? Number(glycemicLoad) : null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'Error al registrar comida');
      }

      setFoodName('');
      setPortion('');
      setCalories('');
      setCarbsG('');
      setGlycemicIndex('');
      setGlycemicLoad('');
      setFoodImageBase64(null);
      setSuccessMsg('Comida registrada exitosamente.');
      loadRoleData();
    } catch (err: any) {
      setError(err.message ?? 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // ── RF-02 Handlers: Registro Integral de Variables Metabólicas ──────────────

  const handleRegisterGlucose = async () => {
    setError(''); setSuccessMsg('');
    const val = Number(glucoseLevelInput);
    if (isNaN(val) || val < 20 || val > 600) {
      setError('Ingresa un nivel de glucosa válido entre 20 mg/dL y 600 mg/dL');
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const res = await fetch(`${API_URL}/dashboard/patient/glucose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          glucose_level: val,
          context: glucoseContext,
          recorded_at: `${selectedCalendarDate}T${timeStr}`
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'Error al registrar glucemia');
      }
      setGlucoseLevelInput('');
      setSuccessMsg('Medición de glucemia capilar registrada correctamente.');
      loadRoleData();
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAnthropometric = async () => {
    setError(''); setSuccessMsg('');
    const w = Number(anthroWeightInput);
    const h = Number(anthroHeightInput);
    if (isNaN(w) || w < 20 || w > 350) { setError('Peso inválido (20 - 350 kg)'); return; }
    if (isNaN(h) || h < 50 || h > 260) { setError('Estatura inválida (50 - 260 cm)'); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const res = await fetch(`${API_URL}/dashboard/patient/anthropometric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          weight_kg: w,
          height_cm: h,
          recorded_at: `${selectedCalendarDate}T${timeStr}`
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'Error al registrar antropometría');
      }
      setAnthroWeightInput(''); setAnthroHeightInput('');
      setSuccessMsg('Peso, estatura e IMC computados exitosamente.');
      loadRoleData();
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterMedication = async () => {
    setError(''); setSuccessMsg('');
    if (!medNameInput.trim()) { setError('Ingresa el nombre del medicamento'); return; }
    if (!medDosageInput.trim()) { setError('Ingresa la dosis administrada (ej. 850 mg)'); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const res = await fetch(`${API_URL}/dashboard/patient/medication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          medication_name: medNameInput.trim(),
          dosage: medDosageInput.trim(),
          taken_at: `${selectedCalendarDate}T${timeStr}`
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'Error al registrar medicamento');
      }
      setMedNameInput(''); setMedDosageInput('');
      setSuccessMsg('Medicamento administrado registrado en la bitácora.');
      loadRoleData();
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPhysicalActivity = async () => {
    setError(''); setSuccessMsg('');
    if (!activityTypeInput.trim()) { setError('Ingresa el tipo de actividad física'); return; }
    const mins = Number(activityDurationInput);
    if (isNaN(mins) || mins < 1 || mins > 1440) { setError('Duración inválida (1 - 1440 min)'); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const res = await fetch(`${API_URL}/dashboard/patient/physical-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          activity_type: activityTypeInput.trim(),
          duration_minutes: mins,
          recorded_at: `${selectedCalendarDate}T${timeStr}`
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'Error al registrar actividad física');
      }
      setActivityTypeInput(''); setActivityDurationInput('');
      setSuccessMsg('Actividad física registrada en la bitácora.');
      loadRoleData();
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // ── Generador de Menú Diario con IA ──
  const [menuTargetDay, setMenuTargetDay] = useState<'HOY' | 'MANANA'>('HOY');
  const [menuMeals, setMenuMeals] = useState<any[]>([]);
  const [menuGeneralTip, setMenuGeneralTip] = useState('');
  const [menuMissing, setMenuMissing] = useState<string[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [savedMenus, setSavedMenus] = useState<any[]>([]);
  const [showSavedMenus, setShowSavedMenus] = useState(false);
  const [viewingSavedMenu, setViewingSavedMenu] = useState<any | null>(null);

  const handleGenerateMenu = async (day: 'HOY' | 'MANANA') => {
    setMenuTargetDay(day);
    setMenuMeals([]);
    setMenuGeneralTip('');
    setMenuMissing([]);
    setMenuLoading(true);
    setViewingSavedMenu(null);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/generate-menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ target_day: day })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'Error al generar menú');
      }
      const data = await res.json();
      setMenuMeals(data.meals || []);
      setMenuGeneralTip(data.general_tip || '');
      setMenuMissing(data.missing_meals || []);
    } catch (err: any) {
      setError(err.message || 'Error de conexión al generar menú');
    } finally {
      setMenuLoading(false);
    }
  };

  const handleSaveMenu = async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/save-menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ target_day: menuTargetDay, meals: menuMeals, general_tip: menuGeneralTip })
      });
      if (res.ok) { setSuccessMsg('¡Menú guardado exitosamente!'); fetchSavedMenus(); }
    } catch (e) { setError('Error al guardar menú'); }
  };

  const fetchSavedMenus = async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/saved-menus`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { const data = await res.json(); setSavedMenus(data); }
    } catch (e) {}
  };

  const handleDeleteSavedMenu = async (id: string) => {
    try {
      const token = await getAccessToken();
      await fetch(`${API_URL}/ai/saved-menus/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchSavedMenus();
      if (viewingSavedMenu?.id === id) setViewingSavedMenu(null);
    } catch (e) {}
  };


  // B. Paciente: Cargar e interactuar con Sesiones de IA
  const fetchAiSessions = async () => {
    setSessionsLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAiSessions(data);
      }
    } catch (e) {
      console.warn('Error al cargar sesiones IA:', e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadAiSessionDetail = async (sessionId: string) => {
    setChatLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(data.id);
        setChatMessages(data.messages || []);
        setShowSessionDrawer(false);
      }
    } catch (e) {
      console.warn('Error al cargar detalle de sesión IA:', e);
    } finally {
      setChatLoading(false);
    }
  };

  const startNewAiChat = () => {
    setCurrentSessionId(null);
    setChatMessages([]);
    setChatResponse('');
    setChatPrompt('');
    setShowSessionDrawer(false);
  };

  const handleDeleteAiSession = async (sessionId: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (currentSessionId === sessionId) {
          startNewAiChat();
        }
        fetchAiSessions();
      }
    } catch (e) {
      console.warn('Error al eliminar sesión IA:', e);
    }
  };

  const handleChatWithAI = async () => {
    const userText = chatPrompt.trim();
    if (!userText) return;

    const tempUserMsg = { id: Date.now().toString(), sender: 'user', content: userText, created_at: new Date().toISOString() };
    setChatMessages((prev) => [...prev, tempUserMsg]);
    setChatPrompt('');
    setChatLoading(true);
    setError('');

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          prompt: userText,
          session_id: currentSessionId 
        }),
      });

      if (!res.ok) {
        throw new Error('El servicio de IA no está disponible temporalmente.');
      }

      const data = await res.json();
      setCurrentSessionId(data.session_id);
      
      const tempAiMsg = { id: (Date.now() + 1).toString(), sender: 'ai', content: data.response, created_at: new Date().toISOString() };
      setChatMessages((prev) => [...prev, tempAiMsg]);
      fetchAiSessions();
    } catch (err: any) {
      setError(err.message ?? 'Error al conectar con la IA.');
    } finally {
      setChatLoading(false);
    }
  };

  // C. Doctor: Seleccionar paciente y cargar su historial de comida
  const handleSelectPatientForDoctor = async (pat: any) => {
    setSelectedPatient(pat);
    setDocAiRules(pat.ai_rules || '');
    setDocRecommendations(pat.recommendations || '');
    setSelectedPatientIntakes([]);
    setDocMealSchedule(null);
    setLoadingPatientIntakes(true);
    setLoadingMealSchedule(true);
    try {
      const token = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };
      const res = await fetch(`${API_URL}/dashboard/doctor/patient/${pat.id}/intakes`, {
        headers,
      });
      if (res.ok) {
        const intakesData = await res.json();
        setSelectedPatientIntakes(intakesData);
      }

      const resMetabolic = await fetch(`${API_URL}/dashboard/doctor/patient/${pat.id}/metabolic-summary`, {
        headers,
      });
      if (resMetabolic.ok) {
        setDocPatientMetabolicSummary(await resMetabolic.json());
      } else {
        setDocPatientMetabolicSummary(null);
      }

      const resSchedule = await fetch(`${API_URL}/notifications/doctor/patient/${pat.id}/schedule`, {
        headers,
      });
      if (resSchedule.ok) {
        setDocMealSchedule(await resSchedule.json());
      } else {
        setDocMealSchedule(null);
      }
    } catch (err) {
      console.log('Error al cargar historial del paciente:', err);
    } finally {
      setLoadingPatientIntakes(false);
      setLoadingMealSchedule(false);
    }
  };

  const updateDocMealSlot = (mealType: string, patch: Partial<{ meal_time: string; enabled: boolean }>) => {
    setDocMealSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        slots: prev.slots.map((slot) =>
          slot.meal_type === mealType ? { ...slot, ...patch } : slot
        ),
      };
    });
  };

  const handleSaveMealSchedule = async () => {
    if (!selectedPatient || !docMealSchedule) return;
    setError('');
    setSuccessMsg('');
    setSavingMealSchedule(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/notifications/doctor/patient/${selectedPatient.id}/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          timezone: docMealSchedule.timezone,
          advance_minutes: Number(docMealSchedule.advance_minutes) || 30,
          enabled: docMealSchedule.enabled,
          slots: docMealSchedule.slots.map((s) => ({
            meal_type: s.meal_type,
            meal_time: s.meal_time,
            enabled: s.enabled,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Error al guardar horarios.' }));
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Error al guardar horarios.');
      }
      setDocMealSchedule(await res.json());
      setSuccessMsg('¡Horarios de comida actualizados correctamente!');
    } catch (err: any) {
      setError(err.message || 'Error al guardar horarios de comida.');
    } finally {
      setSavingMealSchedule(false);
    }
  };

  // C. Doctor: Guardar recomendaciones
  const handleSaveDocRecommendation = async () => {
    if (!selectedPatient) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/dashboard/doctor/recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          ai_rules: docAiRules,
          recommendations: docRecommendations,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al actualizar recomendación médica.');
      }

      setSuccessMsg('¡Recomendación y reglas de IA guardadas correctamente!');
      loadRoleData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // E. Paciente: Registrar Incidencia / Malestar
  const handleSubmitIncident = async () => {
    if (!incidentForm.description.trim()) {
      Alert.alert('Error', 'Por favor describe el malestar o dolor.');
      return;
    }
    setSubmittingIncident(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/dashboard/patient/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: incidentForm.description.trim(),
          pain_level: incidentForm.pain_level,
          doctor_question: incidentForm.doctor_question.trim() || null,
        }),
      });

      if (res.ok) {
        Alert.alert('Éxito', 'Incidencia y consulta médica registradas correctamente.');
        setIncidentModalVisible(false);
        setIncidentForm({ description: '', pain_level: 5, doctor_question: '' });
        loadRoleData();
      } else {
        const errData = await res.json();
        Alert.alert('Error', errData.detail || 'No se pudo registrar la incidencia.');
      }
    } catch (err) {
      Alert.alert('Error', 'Hubo un error de conexión con el servidor.');
    } finally {
      setSubmittingIncident(false);
    }
  };

  // F. Doctor: Responder a la Incidencia de Malestar de un Paciente
  const handleRespondToIncident = async (incidentId: string) => {
    const text = incidentResponseText[incidentId]?.trim();
    if (!text) {
      Alert.alert('Error', 'Por favor escribe un consejo o respuesta médica.');
      return;
    }
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/dashboard/doctor/incident/${incidentId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_response: text,
        }),
      });

      if (res.ok) {
        Alert.alert('Éxito', 'Respuesta y consejo directo enviados con éxito.');
        setIncidentResponseText(prev => ({ ...prev, [incidentId]: '' }));
        loadRoleData();
      } else {
        const errData = await res.json();
        Alert.alert('Error', errData.detail || 'No se pudo enviar la respuesta.');
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexión.');
    }
  };

  // G. Doctor: Evaluar comida (marcar correcta/incorrecta con comentarios)
  const handleAssessMeal = async (intakeId: string) => {
    if (!assessmentComment.trim()) {
      Alert.alert('Error', 'Por favor introduce una recomendación o comentario para esta comida.');
      return;
    }
    setSavingAssessment(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/dashboard/doctor/intake/${intakeId}/assess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_assessment: assessmentRating,
          doctor_comment: assessmentComment,
        }),
      });

      if (res.ok) {
        Alert.alert('Éxito', 'Comida evaluada con éxito.');
        setAssessingIntakeId(null);
        setAssessmentComment('');
        
        // Recargar comidas del paciente seleccionado actual
        if (selectedPatient) {
          handleSelectPatientForDoctor(selectedPatient);
        }
      } else {
        const errData = await res.json();
        Alert.alert('Error', errData.detail || 'No se pudo guardar la evaluación.');
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexión.');
    } finally {
      setSavingAssessment(false);
    }
  };

  // D. Admin: Asignar paciente a doctor
  const handleAssignPatient = async () => {
    setError('');
    setSuccessMsg('');
    if (!assignPatientId || !assignDoctorId) { setError('Selecciona un paciente y un doctor.'); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/dashboard/admin/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_id: assignPatientId,
          doctor_id: assignDoctorId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? 'Error de asignación.');
      }

      setSuccessMsg('¡Paciente asignado al doctor exitosamente!');
      setAssignPatientId('');
      setAssignDoctorId('');
      loadRoleData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // E. Admin: Cambiar rol de usuario
  const handleChangeRole = async () => {
    setError('');
    setSuccessMsg('');
    if (!changeRoleUserId) { setError('Selecciona un usuario.'); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/dashboard/admin/change-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: changeRoleUserId,
          new_role: changeRoleNewVal,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al cambiar de rol.');
      }

      setSuccessMsg('¡Rol de usuario cambiado exitosamente!');
      setChangeRoleUserId('');
      loadRoleData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Renders ────────────────────────────────────────────────────────────────

  // Render A: VISTA PACIENTE
  const renderPatientDashboard = () => (
    <>
      <View style={styles.dashboardContainer}>
      {/* Indicador de Doctor Asignado (Requirement 2) */}
      <View style={[styles.doctorIndicator, doctorName ? styles.doctorIndicatorActive : styles.doctorIndicatorEmpty]}>
        <Ionicons 
          name={doctorName ? "medical" : "alert-circle"} 
          size={16} 
          color={doctorName ? COLORS.accent : COLORS.error} 
        />
        <Text style={[styles.doctorIndicatorText, doctorName ? {} : { color: COLORS.error }]}>
          {doctorName ? `Médico de Cabecera: ${doctorName}` : 'Sin Médico de Cabecera Asignado'}
        </Text>
      </View>

      {/* Banner / Card para Completar Perfil Clínico */}
      {(!patientProfile?.weight_kg || !patientProfile?.gender || !patientProfile?.last_hba1c) ? (
        <TouchableOpacity 
          style={styles.onboardingBanner} 
          onPress={() => setProfileModalVisible(true)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#FF6B6B', '#E63946']}
            style={styles.onboardingBannerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.onboardingBannerContent}>
              <View style={styles.onboardingIconContainer}>
                <Ionicons name="medical" size={24} color="#fff" />
              </View>
              <View style={styles.onboardingTextContainer}>
                <Text style={styles.onboardingTitle}>Completar Ficha Médica</Text>
                <Text style={styles.onboardingSub}>Tu médico necesita estos datos clínicos para un mejor diagnóstico y control dietético.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" style={styles.onboardingArrow} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.clinicalSummaryCard}>
          <View style={styles.clinicalHeader}>
            <View style={styles.clinicalHeaderLeft}>
              <Ionicons name="pulse" size={16} color={COLORS.accent} />
              <Text style={styles.clinicalTitle}>Ficha Médica Registrada</Text>
            </View>
            <TouchableOpacity onPress={() => setProfileModalVisible(true)} style={styles.clinicalEditBtn}>
              <Ionicons name="create-outline" size={16} color={COLORS.accent} />
              <Text style={styles.clinicalEditBtnText}>Actualizar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.clinicalGrid}>
            <View style={styles.clinicalGridItem}>
              <Text style={styles.clinicalLabel}>Diabetes</Text>
              <Text style={styles.clinicalValue}>{patientProfile?.diabetes_type || 'Tipo 2'}</Text>
            </View>
            <View style={styles.clinicalGridItem}>
              <Text style={styles.clinicalLabel}>Peso / Estatura</Text>
              <Text style={styles.clinicalValue}>
                {patientProfile?.weight_kg ? `${patientProfile.weight_kg} kg` : '--'} / {patientProfile?.height_cm ? `${patientProfile.height_cm} cm` : '--'}
              </Text>
            </View>
            <View style={styles.clinicalGridItem}>
              <Text style={styles.clinicalLabel}>HbA1c Glicosilada</Text>
              <Text style={[styles.clinicalValue, Number(patientProfile?.last_hba1c) > 7.0 ? { color: '#FF6B6B' } : { color: COLORS.accent }]}>
                {patientProfile?.last_hba1c ? `${patientProfile.last_hba1c}%` : '--'}
              </Text>
            </View>
            <View style={styles.clinicalGridItem}>
              <Text style={styles.clinicalLabel}>Actividad</Text>
              <Text style={styles.clinicalValue}>{patientProfile?.activity_level || 'Moderado'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Calendario Dinámico por Semanas y Meses (UX Estilo Yazio / MyFitnessPal) ── */}
      <View style={{ marginBottom: 16, backgroundColor: COLORS.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
        {/* Encabezado con Nombre del Mes y Controles de Navegación */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}
            onPress={() => {
              const prev = new Date(currentWeekAnchor);
              prev.setDate(prev.getDate() - 7);
              setCurrentWeekAnchor(prev);
            }}
          >
            <Ionicons name="chevron-back" size={18} color={COLORS.text} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: COLORS.text, textTransform: 'capitalize' }}>
              {currentWeekAnchor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => {
              const today = new Date();
              setCurrentWeekAnchor(today);
              setSelectedCalendarDate(today.toISOString().split('T')[0]);
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.accent, marginTop: 2 }}>
                Ir a Hoy
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border }}
            onPress={() => {
              const next = new Date(currentWeekAnchor);
              next.setDate(next.getDate() + 7);
              setCurrentWeekAnchor(next);
            }}
          >
            <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Días de la Semana Activa (Calculados Dinámicamente) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          {(() => {
            const dayOfWeek = (currentWeekAnchor.getDay() + 6) % 7; // Lunes = 0
            const monday = new Date(currentWeekAnchor);
            monday.setDate(currentWeekAnchor.getDate() - dayOfWeek);

            const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
            return dayLabels.map((dayChar, dIdx) => {
              const targetDate = new Date(monday);
              targetDate.setDate(monday.getDate() + dIdx);
              const targetDateStr = targetDate.toISOString().split('T')[0];
              const isSelected = selectedCalendarDate === targetDateStr;
              const isToday = targetDateStr === new Date().toISOString().split('T')[0];

              return (
                <TouchableOpacity 
                  key={dIdx} 
                  style={{ alignItems: 'center', gap: 4 }}
                  onPress={() => setSelectedCalendarDate(targetDateStr)}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? COLORS.accent : COLORS.textMuted }}>
                    {dayChar}
                  </Text>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isSelected ? COLORS.accent : (isToday ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.12)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')),
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isSelected ? 0 : (isToday ? 1.5 : 1),
                      borderColor: isToday ? COLORS.accent : COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isSelected ? '#fff' : (isToday ? COLORS.accent : COLORS.text) }}>
                      {targetDate.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            });
          })()}
        </View>
      </View>

      {/* ── Tarjetas Organizadoras por Categoría de Comida (Filtradas por Fecha Seleccionada) ── */}
      {[
        { key: 'DESAYUNO', title: 'Desayuno', icon: 'sunny-outline', color: '#F59E0B' },
        { key: 'ALMUERZO', title: 'Almuerzo', icon: 'restaurant-outline', color: '#059669' },
        { key: 'CENA', title: 'Cena', icon: 'moon-outline', color: '#8B5CF6' },
        { key: 'MERIENDA', title: 'Merienda', icon: 'cafe-outline', color: '#EC4899' },
      ].map((mealCat) => {
        const mealIntakes = intakeHistory.filter((item: any) => {
          const itemMeal = (item.meal_type || '').toUpperCase();
          const rawDateStr = String(item.consumed_at || item.created_at || '');
          const itemDate = rawDateStr.split('T')[0].split(' ')[0];
          return itemMeal === mealCat.key && itemDate === selectedCalendarDate;
        });
        const totalGrams = mealIntakes.reduce((sum: number, item: any) => sum + Number(item.portion_size_g || 0), 0);

        return (
          <View key={mealCat.key} style={[styles.card, { marginBottom: 14 }]}>
            {/* Header de la Tarjeta de Comida */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${mealCat.color}15`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={mealCat.icon as any} size={18} color={mealCat.color} />
                </View>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>{mealCat.title}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '600' }}>
                    {mealIntakes.length === 0 ? 'Sin registros' : `${mealIntakes.length} alimento(s) • ${totalGrams}g total`}
                  </Text>
                </View>
              </View>

              {/* Botón Escáner IA Rápido */}
              <TouchableOpacity
                style={{
                  backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(109, 40, 217, 0.08)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
                onPress={() => {
                  setMealType(mealCat.key as any);
                  handleScanPlate();
                }}
              >
                <Ionicons name="camera" size={14} color={COLORS.purple} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.purple }}>IA</Text>
              </TouchableOpacity>
            </View>

            {/* Lista de Alimentos Registrados en esta Categoría */}
            {mealIntakes.length > 0 ? (
              <View style={{ marginBottom: 12, gap: 8 }}>
                {mealIntakes.map((item: any, idx: number) => (
                  <View
                    key={item.id || idx}
                    style={{
                      backgroundColor: COLORS.bg,
                      borderRadius: 12,
                      padding: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    {item.image_base64 ? (
                      <TouchableOpacity onPress={() => setSelectedFoodPhoto(item)} activeOpacity={0.8}>
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }}
                          style={{ width: 44, height: 44, borderRadius: 8, marginRight: 10 }}
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                        <Ionicons name="nutrition-outline" size={20} color={COLORS.accent} />
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>{item.food_name}</Text>
                      <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                        {item.portion_size_g}g • {new Date(item.created_at || item.consumed_at || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {(item.calories != null || item.carbs_g != null || item.glycemic_index != null || item.glycemic_load != null) && (
                        <Text style={{ fontSize: 10, color: COLORS.accent, marginTop: 2, fontWeight: '600' }}>
                          {[
                            item.calories != null ? `${item.calories} kcal` : null,
                            item.carbs_g != null ? `${item.carbs_g}g CH` : null,
                            item.glycemic_index != null ? `IG ${item.glycemic_index}` : null,
                            item.glycemic_load != null ? `CG ${item.glycemic_load}` : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>

                    {/* Badge de Evaluación del Médico */}
                    {item.doctor_assessment === 'CORRECT' && (
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="checkmark-circle" size={12} color={COLORS.accent} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.accent }}>Aprobado</Text>
                      </View>
                    )}
                    {item.doctor_assessment === 'INCORRECT' && (
                      <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="alert-circle" size={12} color={COLORS.error} />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.error }}>Revisar</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Botón "+ Agregar Alimento" */}
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.bg,
                borderColor: COLORS.border,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
              }}
              onPress={() => {
                setMealType(mealCat.key as any);
                setFoodName('');
                setPortion('');
                setFoodImageBase64(null);
                const now = new Date();
                const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                setIntakeTimeInput(nowTime);
                setAddIntakeModalVisible(true);
              }}
            >
              <Ionicons name="add-circle" size={18} color={COLORS.accent} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.accent }}>
                + Agregar a {mealCat.title}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* ── Módulo de Registro Integral de Variables Metabólicas ── */}
      {user?.role === 'PACIENTE' && (
        <View style={[styles.card, { marginBottom: 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(5, 150, 105, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="pulse-outline" size={18} color={COLORS.accent} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>Variables Metabólicas</Text>
                <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '600' }}>Glucemia, Antropometría/IMC, Medicación y Actividad</Text>
              </View>
            </View>
          </View>

          {/* Píldoras de Navegación del Módulo RF-02 */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {[
              { key: 'GLUCOSE', label: 'Glucemia', icon: 'water-outline', color: '#EF4444' },
              { key: 'ANTHRO', label: 'IMC / Peso', icon: 'scale-outline', color: '#10B981' },
              { key: 'MEDS', label: 'Medicación', icon: 'medical-outline', color: '#3B82F6' },
              { key: 'ACTIVITY', label: 'Actividad', icon: 'fitness-outline', color: '#8B5CF6' },
            ].map((tab) => {
              const isSelected = activeMetabolicTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: isSelected ? tab.color : COLORS.border,
                    backgroundColor: isSelected ? `${tab.color}15` : COLORS.bg,
                  }}
                  onPress={() => setActiveMetabolicTab(tab.key as any)}
                >
                  <Ionicons name={tab.icon as any} size={16} color={isSelected ? tab.color : COLORS.textMuted} />
                  <Text style={{ fontSize: 10, fontWeight: isSelected ? '800' : '600', color: isSelected ? tab.color : COLORS.textMuted, marginTop: 2 }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ──────────────── TAB 1: GLUCEMIA CAPILAR ──────────────── */}
          {activeMetabolicTab === 'GLUCOSE' && (
            <View>
              <Text style={styles.inputLabel}>Medición de Glucemia Capilar (mg/dL)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                  placeholder="Ej. 110"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  maxLength={3}
                  value={glucoseLevelInput}
                  onChangeText={(val) => setGlucoseLevelInput(val.replace(/[^0-9]/g, ''))}
                />
                <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 12, height: 48, justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textMuted }}>mg/dL</Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>Contexto de la Medición</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  { key: 'AYUNAS', label: 'Ayunas (Preprandial)' },
                  { key: 'ANTES_COMIDA', label: 'Antes de Comer' },
                  { key: 'DESPUES_COMIDA', label: 'Postprandial (2h)' },
                  { key: 'MADRUGADA', label: 'Madrugada' },
                ].map((ctx) => {
                  const isSelected = glucoseContext === ctx.key;
                  return (
                    <TouchableOpacity
                      key={ctx.key}
                      style={{
                        flex: 1,
                        minWidth: 120,
                        paddingVertical: 8,
                        borderRadius: 10,
                        alignItems: 'center',
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#EF4444' : COLORS.border,
                        backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : COLORS.bg,
                      }}
                      onPress={() => setGlucoseContext(ctx.key as any)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#EF4444' : COLORS.textMuted }}>
                        {ctx.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#EF4444' }]} onPress={handleRegisterGlucose}>
                <Text style={styles.primaryBtnText}>Guardar Glucemia</Text>
              </TouchableOpacity>

              {/* Historial de Glucemia */}
              <Text style={[styles.inputLabel, { marginTop: 16, marginBottom: 8 }]}>Historial de Mediciones Capilares</Text>
              {glucoseLogs.length === 0 ? (
                <Text style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' }}>Sin registros de glucemia aún.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {glucoseLogs.slice(0, 5).map((gLog: any, idx: number) => {
                    const val = Number(gLog.glucose_level);
                    let badgeBg = 'rgba(16, 185, 129, 0.15)';
                    let badgeText = '#10B981';
                    let badgeLabel = 'Normal';

                    if (val < 70) { badgeBg = 'rgba(245, 158, 11, 0.15)'; badgeText = '#F59E0B'; badgeLabel = 'Hipoglucemia'; }
                    else if (val > 180) { badgeBg = 'rgba(239, 68, 68, 0.15)'; badgeText = '#EF4444'; badgeLabel = 'Hiperglucemia'; }
                    else if (val > 130) { badgeBg = 'rgba(249, 115, 22, 0.15)'; badgeText = '#F97316'; badgeLabel = 'Elevada'; }

                    return (
                      <View key={gLog.id || idx} style={{ backgroundColor: COLORS.bg, padding: 10, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text }}>{gLog.glucose_level} mg/dL</Text>
                          <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: badgeText }}>{badgeLabel}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                          {gLog.context} • {new Date(gLog.recorded_at || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ──────────────── TAB 2: ANTROPOMETRÍA E IMC ──────────────── */}
          {activeMetabolicTab === 'ANTHRO' && (
            <View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Peso (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="70.5"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                    value={anthroWeightInput}
                    onChangeText={(val) => setAnthroWeightInput(val.replace(/[^0-9.]/g, ''))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Estatura (cm)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="170"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    value={anthroHeightInput}
                    onChangeText={(val) => setAnthroHeightInput(val.replace(/[^0-9]/g, ''))}
                  />
                </View>
              </View>

              {/* Computación Automatizada en Tiempo Real del IMC */}
              {(() => {
                const w = Number(anthroWeightInput);
                const h = Number(anthroHeightInput);
                if (w >= 20 && h >= 50) {
                  const bmiVal = (w / ((h / 100) ** 2)).toFixed(2);
                  const bmiNum = Number(bmiVal);
                  let bmiClass = 'Peso Normal';
                  let bmiColor = '#10B981';
                  if (bmiNum < 18.5) { bmiClass = 'Bajo Peso'; bmiColor = '#F59E0B'; }
                  else if (bmiNum >= 25 && bmiNum < 30) { bmiClass = 'Sobrepeso'; bmiColor = '#F97316'; }
                  else if (bmiNum >= 30) { bmiClass = 'Obesidad'; bmiColor = '#EF4444'; }

                  return (
                    <View style={{ backgroundColor: `${bmiColor}15`, padding: 12, borderRadius: 10, marginVertical: 12, borderWidth: 1, borderColor: `${bmiColor}40`, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' }}>Cálculo Automatizado del IMC</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.text }}>{bmiVal} kg/m²</Text>
                      </View>
                      <View style={{ backgroundColor: bmiColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>{bmiClass}</Text>
                      </View>
                    </View>
                  );
                }
                return null;
              })()}

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#10B981', marginTop: 8 }]} onPress={handleRegisterAnthropometric}>
                <Text style={styles.primaryBtnText}>Guardar Peso e IMC</Text>
              </TouchableOpacity>

              {/* Historial Antropométrico */}
              <Text style={[styles.inputLabel, { marginTop: 16, marginBottom: 8 }]}>Historial de Evaluación Física</Text>
              {anthroLogs.length === 0 ? (
                <Text style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' }}>Sin registros de IMC aún.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {anthroLogs.slice(0, 5).map((aLog: any, idx: number) => (
                    <View key={aLog.id || idx} style={{ backgroundColor: COLORS.bg, padding: 10, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>{aLog.weight_kg} kg • {aLog.height_cm} cm</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>IMC: {aLog.bmi} kg/m²</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                        {new Date(aLog.recorded_at || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ──────────────── TAB 3: DIARIO DE MEDICACIÓN ──────────────── */}
          {activeMetabolicTab === 'MEDS' && (
            <View>
              <Text style={styles.inputLabel}>Nombre del Fármaco o Medicamento</Text>
              <TextInput
                style={[styles.textInput, { marginBottom: 10 }]}
                placeholder="Ej. Metformina 850 mg"
                placeholderTextColor={COLORS.textMuted}
                value={medNameInput}
                onChangeText={setMedNameInput}
              />

              <Text style={styles.inputLabel}>Dosis e Indicación</Text>
              <TextInput
                style={[styles.textInput, { marginBottom: 12 }]}
                placeholder="Ej. 1 tableta con el almuerzo"
                placeholderTextColor={COLORS.textMuted}
                value={medDosageInput}
                onChangeText={setMedDosageInput}
              />

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#3B82F6' }]} onPress={handleRegisterMedication}>
                <Text style={styles.primaryBtnText}>Registrar Fármaco Administrado</Text>
              </TouchableOpacity>

              {/* Historial de Medicación */}
              <Text style={[styles.inputLabel, { marginTop: 16, marginBottom: 8 }]}>Bitácora de Medicamentos Tomados</Text>
              {medLogs.length === 0 ? (
                <Text style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' }}>Sin dosis registradas aún.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {medLogs.slice(0, 5).map((mLog: any, idx: number) => (
                    <View key={mLog.id || idx} style={{ backgroundColor: COLORS.bg, padding: 10, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>{mLog.medication_name}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Dosis: {mLog.dosage}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                        {new Date(mLog.taken_at || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ──────────────── TAB 4: BITÁCORA DE ACTIVIDAD FÍSICA ──────────────── */}
          {activeMetabolicTab === 'ACTIVITY' && (
            <View>
              <Text style={styles.inputLabel}>Tipo de Actividad Física</Text>
              <TextInput
                style={[styles.textInput, { marginBottom: 10 }]}
                placeholder="Ej. Caminata a paso ligero, Natación, Ciclismo"
                placeholderTextColor={COLORS.textMuted}
                value={activityTypeInput}
                onChangeText={setActivityTypeInput}
              />

              <Text style={styles.inputLabel}>Tiempo Dedicado (Minutos)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TextInput
                  style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                  placeholder="Ej. 30"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={activityDurationInput}
                  onChangeText={(val) => setActivityDurationInput(val.replace(/[^0-9]/g, ''))}
                />
                <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 12, height: 48, justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textMuted }}>min</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#8B5CF6' }]} onPress={handleRegisterPhysicalActivity}>
                <Text style={styles.primaryBtnText}>Registrar Actividad Física</Text>
              </TouchableOpacity>

              {/* Historial de Actividad Física */}
              <Text style={[styles.inputLabel, { marginTop: 16, marginBottom: 8 }]}>Bitácora de Ejercicio y Movimiento</Text>
              {activityLogs.length === 0 ? (
                <Text style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' }}>Sin actividad física registrada aún.</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {activityLogs.slice(0, 5).map((actLog: any, idx: number) => (
                    <View key={actLog.id || idx} style={{ backgroundColor: COLORS.bg, padding: 10, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>{actLog.activity_type}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{actLog.duration_minutes} minutos dedicados</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                        {new Date(actLog.recorded_at || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Generador de Menú Diario con IA ── */}
      {user?.role === 'PACIENTE' && (
        <View style={[styles.card, { marginBottom: 14, borderColor: '#7C3AED40', borderWidth: 1.5 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124, 58, 237, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="restaurant-outline" size={20} color={COLORS.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>Menú del Día con IA</Text>
              <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '600' }}>Sugerencia personalizada según tu perfil clínico</Text>
            </View>
          </View>

          {/* Selector: Hoy o Mañana */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: menuTargetDay === 'HOY' && !menuLoading ? COLORS.purple : COLORS.border,
                backgroundColor: menuTargetDay === 'HOY' && !menuLoading ? (isDark ? 'rgba(124, 58, 237, 0.18)' : 'rgba(124, 58, 237, 0.08)') : COLORS.bg,
              }}
              disabled={menuLoading}
              onPress={() => handleGenerateMenu('HOY')}
            >
              <Ionicons name="today-outline" size={18} color={menuTargetDay === 'HOY' ? COLORS.purple : COLORS.textMuted} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: menuTargetDay === 'HOY' ? COLORS.purple : COLORS.textMuted, marginTop: 2 }}>
                Menú de Hoy
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '600' }}>Solo comidas faltantes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: menuTargetDay === 'MANANA' && !menuLoading ? COLORS.accent : COLORS.border,
                backgroundColor: menuTargetDay === 'MANANA' && !menuLoading ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(5, 150, 105, 0.08)') : COLORS.bg,
              }}
              disabled={menuLoading}
              onPress={() => handleGenerateMenu('MANANA')}
            >
              <Ionicons name="calendar-outline" size={18} color={menuTargetDay === 'MANANA' ? COLORS.accent : COLORS.textMuted} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: menuTargetDay === 'MANANA' ? COLORS.accent : COLORS.textMuted, marginTop: 2 }}>
                Menú de Mañana
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '600' }}>Plan completo del día</Text>
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {menuLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
              <ActivityIndicator size="large" color={COLORS.purple} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.purple }}>Generando tu menú personalizado...</Text>
              <Text style={{ fontSize: 10, color: COLORS.textMuted }}>Analizando perfil clínico, glucemia, peso e historial</Text>
            </View>
          )}

          {/* Structured meals result */}
          {!menuLoading && menuMeals.length > 0 ? (
            <View style={{ gap: 10 }}>
              {menuMeals.map((meal: any, idx: number) => {
                const mealIcons: any = { DESAYUNO: 'sunny-outline', ALMUERZO: 'restaurant-outline', CENA: 'moon-outline', MERIENDA: 'cafe-outline', INFO: 'information-circle-outline' };
                const mealColors: any = { DESAYUNO: '#F59E0B', ALMUERZO: '#10B981', CENA: '#6366F1', MERIENDA: '#EC4899', INFO: COLORS.purple };
                const iconName = mealIcons[meal.meal_type] || 'restaurant-outline';
                const accentColor = mealColors[meal.meal_type] || COLORS.purple;
                return (
                  <View key={idx} style={{ backgroundColor: COLORS.bg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' }}>
                    {/* Meal header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${accentColor}18`, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={iconName} size={18} color={accentColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: accentColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{meal.meal_label || meal.meal_type}</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: 1 }}>{meal.dish_name}</Text>
                      </View>
                      {meal.portion_g > 0 && (
                        <View style={{ backgroundColor: `${accentColor}15`, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: accentColor }}>{meal.portion_g}g</Text>
                        </View>
                      )}
                    </View>
                    {/* Meal body */}
                    <View style={{ padding: 12, gap: 8 }}>
                      {meal.ingredients ? (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                          <Ionicons name="leaf-outline" size={14} color={COLORS.accent} style={{ marginTop: 1 }} />
                          <Text style={{ fontSize: 12, color: COLORS.text, flex: 1, lineHeight: 18 }}>{meal.ingredients}</Text>
                        </View>
                      ) : null}
                      {meal.tip ? (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start', backgroundColor: isDark ? 'rgba(124, 58, 237, 0.08)' : 'rgba(124, 58, 237, 0.05)', padding: 8, borderRadius: 8 }}>
                          <Ionicons name="bulb-outline" size={13} color={COLORS.purple} style={{ marginTop: 1 }} />
                          <Text style={{ fontSize: 11, color: COLORS.purple, flex: 1, fontStyle: 'italic', lineHeight: 16 }}>{meal.tip}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}

              {/* General tip */}
              {menuGeneralTip ? (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.06)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: `${COLORS.accent}30` }}>
                  <Ionicons name="heart-outline" size={16} color={COLORS.accent} style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: COLORS.accent, flex: 1, fontWeight: '600', lineHeight: 18 }}>{menuGeneralTip}</Text>
                </View>
              ) : null}

              {/* Action buttons: Guardar + Regenerar */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.purple, paddingVertical: 11, borderRadius: 10 }}
                  onPress={handleSaveMenu}
                >
                  <Ionicons name="bookmark-outline" size={16} color="#fff" />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Guardar Menú</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.bg, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.border }}
                  onPress={() => handleGenerateMenu(menuTargetDay)}
                >
                  <Ionicons name="refresh-outline" size={16} color={COLORS.text} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.text }}>Otro Menú</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : !menuLoading && menuMeals.length === 0 && menuGeneralTip ? (
            <View style={{ alignItems: 'center', paddingVertical: 16, gap: 6 }}>
              <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.accent} />
              <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: '700', textAlign: 'center' }}>{menuGeneralTip}</Text>
            </View>
          ) : !menuLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', textAlign: 'center' }}>
                Presiona "Menú de Hoy" o "Menú de Mañana" para generar un plan alimenticio personalizado.
              </Text>
            </View>
          ) : null}

          {/* Saved menus toggle */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8 }}
            onPress={() => { setShowSavedMenus(!showSavedMenus); if (!showSavedMenus) fetchSavedMenus(); }}
          >
            <Ionicons name={showSavedMenus ? 'chevron-up-outline' : 'bookmarks-outline'} size={14} color={COLORS.textMuted} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted }}>{showSavedMenus ? 'Ocultar guardados' : 'Ver menús guardados'}</Text>
          </TouchableOpacity>

          {/* Saved menus list */}
          {showSavedMenus && (
            <View style={{ gap: 8, marginTop: 6 }}>
              {savedMenus.length === 0 ? (
                <Text style={{ fontSize: 11, color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic' }}>No tienes menús guardados aún.</Text>
              ) : savedMenus.map((sm: any) => (
                <View key={sm.id} style={{ backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Ionicons name="bookmark" size={14} color={COLORS.purple} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.text }}>
                        Menú {sm.target_day === 'HOY' ? 'del Día' : 'de Mañana'}
                      </Text>
                      <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
                        {new Date(sm.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => setViewingSavedMenu(viewingSavedMenu?.id === sm.id ? null : sm)}>
                        <Ionicons name={viewingSavedMenu?.id === sm.id ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.purple} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteSavedMenu(sm.id)}>
                        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Expand saved menu */}
                  {viewingSavedMenu?.id === sm.id && (
                    <View style={{ marginTop: 8, gap: 6 }}>
                      {(sm.meals || []).map((m: any, i: number) => {
                        const mealIcons2: any = { DESAYUNO: 'sunny-outline', ALMUERZO: 'restaurant-outline', CENA: 'moon-outline', MERIENDA: 'cafe-outline' };
                        const mealColors2: any = { DESAYUNO: '#F59E0B', ALMUERZO: '#10B981', CENA: '#6366F1', MERIENDA: '#EC4899' };
                        return (
                          <View key={i} style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 10, borderRadius: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Ionicons name={mealIcons2[m.meal_type] || 'restaurant'} size={14} color={mealColors2[m.meal_type] || COLORS.purple} />
                              <Text style={{ fontSize: 12, fontWeight: '800', color: mealColors2[m.meal_type] || COLORS.text }}>{m.meal_label || m.meal_type}</Text>
                              {m.portion_g > 0 && <Text style={{ fontSize: 10, color: COLORS.textMuted }}>({m.portion_g}g)</Text>}
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text, marginTop: 3 }}>{m.dish_name}</Text>
                            {m.ingredients ? <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{m.ingredients}</Text> : null}
                          </View>
                        );
                      })}
                      {sm.general_tip ? <Text style={{ fontSize: 11, color: COLORS.accent, fontStyle: 'italic', marginTop: 4 }}>💡 {sm.general_tip}</Text> : null}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

          {/* Recomendaciones del Médico */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pulse" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Indicaciones de tu Doctor</Text>
            </View>
            {recommendations ? (
              <View style={styles.recContainer}>
                <View style={styles.recSection}>
                  <Text style={styles.recLabel}>Recomendación Médica:</Text>
                  <Text style={styles.recText}>{recommendations}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>Tu doctor no ha añadido recomendaciones específicas todavía.</Text>
            )}
          </View>

          {/* Malestares e Incidencias Médicas (Dolor, emergencias, consulta directa) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="warning" size={18} color="#FF6B6B" />
              <Text style={styles.cardTitle}>Reportar Dolor o Malestar</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Registra dolores o síntomas extraños e inicia consultas de emergencia directamente con tu médico.
            </Text>

            <TouchableOpacity 
              style={[styles.primaryBtn, { backgroundColor: '#FF6B6B20', borderColor: '#FF6B6B50', borderWidth: 1.5, marginTop: 8 }]} 
              onPress={() => setIncidentModalVisible(true)}
            >
              <View style={styles.scanBtnRow}>
                <Ionicons name="pulse" size={18} color="#FF6B6B" />
                <Text style={[styles.primaryBtnText, { color: '#FF6B6B' }]}>Registrar Síntoma o Incidencia</Text>
              </View>
            </TouchableOpacity>

            {incidentsList.length > 0 ? (
              <ScrollView style={{ maxHeight: 200, marginTop: 12 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {incidentsList.map((inc, index) => (
                  <View key={inc.id || index} style={[styles.incidentItemCard, { borderColor: inc.doctor_response ? '#00C9A740' : '#FF6B6B40' }]}>
                    <View style={styles.incidentItemHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="bandage" size={14} color="#FF6B6B" />
                        <Text style={styles.incidentItemTitle} numberOfLines={2}>{inc.description}</Text>
                      </View>
                      {inc.pain_level && (
                        <View style={styles.painBadge}>
                          <Text style={styles.painBadgeText}>Dolor: {inc.pain_level}/10</Text>
                        </View>
                      )}
                    </View>

                    {inc.doctor_question && (
                      <View style={styles.incidentQuestionBox}>
                        <Text style={styles.incidentQuestionText}>
                          <Text style={{ fontWeight: '700' }}>Consulta al médico: </Text>
                          {inc.doctor_question}
                        </Text>
                      </View>
                    )}

                    {inc.doctor_response ? (
                      <View style={[styles.mealFeedbackBox, { marginLeft: 0, marginTop: 8, backgroundColor: 'rgba(0, 201, 167, 0.08)', borderColor: '#00C9A730' }]}>
                        <Ionicons name="medical" size={14} color={COLORS.accent} />
                        <Text style={styles.mealFeedbackText}>
                          <Text style={{ fontWeight: '700', color: COLORS.accent }}>Indicación Directa del Dr: </Text>
                          {inc.doctor_response}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.mealFeedbackBox, { marginLeft: 0, marginTop: 8, backgroundColor: 'rgba(255, 107, 107, 0.05)', borderColor: '#FF6B6B20' }]}>
                        <Ionicons name="time" size={14} color="#FF6B6B" />
                        <Text style={[styles.mealFeedbackText, { color: COLORS.textMuted }]}>
                          Esperando respuesta y consejo de tu médico de cabecera...
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.emptyText, { marginTop: 10 }]}>No tienes incidencias o dolores reportados.</Text>
            )}
          </View>

          {/* Historial de Comidas */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Historial de Comidas Recientes</Text>
            </View>
            {intakeHistory.length > 0 ? (
              <>
                {intakeHistory.slice(0, 6).map((item, idx) => (
                  <View key={item.id || idx} style={{ marginBottom: 12 }}>
                    <View style={styles.historyItem}>
                      <View style={styles.historyLeft}>
                        {item.image_base64 ? (
                          <Image 
                            source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} 
                            style={styles.historyThumbnail} 
                          />
                        ) : (
                          <View style={styles.historyThumbnailPlaceholder}>
                            <Ionicons name="restaurant" size={14} color={COLORS.textMuted} />
                          </View>
                        )}
                        <View>
                          <Text style={styles.historyFoodName}>{item.food_name}</Text>
                          <Text style={styles.historyMeta}>
                            {item.meal_type} · {item.portion_size_g}g
                            {item.calories != null ? ` · ${item.calories} kcal` : ''}
                            {item.carbs_g != null ? ` · ${item.carbs_g}g CH` : ''}
                          </Text>
                          {(item.glycemic_index != null || item.glycemic_load != null) && (
                            <Text style={[styles.historyMeta, { color: COLORS.accent }]}>
                              {item.glycemic_index != null ? `IG ${item.glycemic_index}` : ''}
                              {item.glycemic_index != null && item.glycemic_load != null ? ' · ' : ''}
                              {item.glycemic_load != null ? `CG ${item.glycemic_load}` : ''}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={styles.historyTime}>
                          {new Date(item.consumed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {item.doctor_assessment && (
                          <View style={[
                            styles.assessmentBadge,
                            item.doctor_assessment === 'CORRECTA' ? styles.assessmentCorrect : styles.assessmentIncorrect
                          ]}>
                            <Text style={styles.assessmentBadgeText}>
                              {item.doctor_assessment === 'CORRECTA' ? 'Correcta' : 'Evitar'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    {/* Recomendación médica específica para esta comida */}
                    {item.doctor_comment && (
                      <View style={styles.mealFeedbackBox}>
                        <Ionicons 
                          name={item.doctor_assessment === 'CORRECTA' ? "checkmark-circle" : "close-circle"} 
                          size={14} 
                          color={item.doctor_assessment === 'CORRECTA' ? COLORS.accent : '#FF6B6B'} 
                        />
                        <Text style={styles.mealFeedbackText}>
                          <Text style={{ fontWeight: '700' }}>Consejo Médico: </Text>
                          {item.doctor_comment}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
                
                <TouchableOpacity 
                  style={styles.fullHistoryBtn} 
                  onPress={() => setHistoryDrawerVisible(true)}
                >
                  <Ionicons name="list-circle" size={18} color={COLORS.accent} />
                  <Text style={styles.fullHistoryBtnText}>Ver Historial Completo</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyText}>Aún no has registrado ninguna comida hoy.</Text>
            )}
          </View>
        </View>

      {/* Modal / Sidebar del Historial Completo */}
      <Modal
        visible={historyDrawerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryDrawerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Cabecera del modal */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="journal" size={22} color={COLORS.accent} />
                <Text style={styles.modalTitle}>Historial Completo</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseBtn} 
                onPress={() => setHistoryDrawerVisible(false)}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Cuerpo del listado */}
            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 40 }}>
              {intakeHistory.length > 0 ? (
                intakeHistory.map((item, idx) => (
                  <View key={item.id || idx} style={styles.modalHistoryItem}>
                    <View style={styles.modalItemLeft}>
                      {item.image_base64 ? (
                        <Image 
                          source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} 
                          style={styles.modalThumbnail} 
                        />
                      ) : (
                        <View style={styles.modalThumbnailPlaceholder}>
                          <Ionicons name="restaurant" size={20} color={COLORS.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalFoodName}>{item.food_name}</Text>
                        <Text style={styles.modalFoodMeta}>
                          {item.meal_type} · {item.portion_size_g}g
                          {item.calories != null ? ` · ${item.calories} kcal` : ''}
                          {item.carbs_g != null ? ` · ${item.carbs_g}g CH` : ''}
                        </Text>
                        {(item.glycemic_index != null || item.glycemic_load != null) && (
                          <Text style={[styles.modalFoodMeta, { color: COLORS.accent }]}>
                            {item.glycemic_index != null ? `IG ${item.glycemic_index}` : ''}
                            {item.glycemic_index != null && item.glycemic_load != null ? ' · ' : ''}
                            {item.glycemic_load != null ? `CG ${item.glycemic_load}` : ''}
                          </Text>
                        )}
                        <Text style={styles.modalFoodDate}>
                          {new Date(item.consumed_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalTime}>
                      {new Date(item.consumed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No hay comidas registradas.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );

  // Render B: VISTA DOCTOR
  const renderDoctorDashboard = () => (
    <View style={styles.dashboardContainer}>
      <Text style={styles.sectionHeader}>Panel Médico y Prescripciones</Text>
      
      {/* Lista de pacientes asignados */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="people" size={18} color={COLORS.accent} />
          <Text style={styles.cardTitle}>Mis Pacientes Asignados</Text>
        </View>
        {patientsList.length > 0 ? (
          patientsList.map((pat) => (
            <TouchableOpacity
              key={pat.id}
              style={[styles.patientCardItem, selectedPatient?.id === pat.id && styles.patientCardItemActive]}
              onPress={() => handleSelectPatientForDoctor(pat)}
            >
              <View>
                <Text style={styles.patientCardName}>{pat.first_name} {pat.last_name}</Text>
                <Text style={styles.patientCardEmail}>{pat.email}</Text>
              </View>
              <Ionicons 
                name={selectedPatient?.id === pat.id ? "chevron-down-circle" : "chevron-forward-circle"} 
                size={20} 
                color={selectedPatient?.id === pat.id ? COLORS.accent : COLORS.textMuted} 
              />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>No tienes pacientes asignados todavía. Consulta al administrador.</Text>
        )}
      </View>

      {/* Editor de recomendaciones si hay seleccionado */}
      {selectedPatient ? (
        <>
          {/* Ficha Clínica Detallada (Requirements for Doctor Diagnosis) */}
          <View style={[styles.clinicalSummaryCard, { borderColor: COLORS.clinical.cardAccent, borderWidth: 1.5, backgroundColor: COLORS.surface }]}>
            <View style={styles.clinicalHeader}>
              <View style={styles.clinicalHeaderLeft}>
                <Ionicons name="medical" size={16} color={COLORS.clinical.cardAccent} />
                <Text style={[styles.clinicalTitle, { color: COLORS.clinical.cardAccent }]}>Historial y Ficha Clínica: {selectedPatient.first_name} {selectedPatient.last_name}</Text>
              </View>
            </View>

            <View style={styles.clinicalGrid}>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>Fecha Nac. / Edad</Text>
                <Text style={styles.clinicalValue}>{selectedPatient.date_of_birth || 'No registrada'}</Text>
              </View>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>Género</Text>
                <Text style={styles.clinicalValue}>{selectedPatient.gender || 'No registrado'}</Text>
              </View>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>Peso / Estatura</Text>
                <Text style={styles.clinicalValue}>
                  {selectedPatient.weight_kg ? `${selectedPatient.weight_kg} kg` : '--'} / {selectedPatient.height_cm ? `${selectedPatient.height_cm} cm` : '--'}
                </Text>
              </View>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>HbA1c Glicosilada</Text>
                <Text style={[styles.clinicalValue, Number(selectedPatient.last_hba1c) > 7.0 ? { color: '#FF6B6B' } : { color: COLORS.accent }]}>
                  {selectedPatient.last_hba1c ? `${selectedPatient.last_hba1c}%` : 'No registrada'}
                </Text>
              </View>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>Tipo de Diabetes</Text>
                <Text style={styles.clinicalValue}>{selectedPatient.diabetes_type || 'Tipo 2'}</Text>
              </View>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>Año Diagnóstico</Text>
                <Text style={styles.clinicalValue}>{selectedPatient.diagnosis_year || 'No registrado'}</Text>
              </View>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>Nivel de Actividad</Text>
                <Text style={styles.clinicalValue}>{selectedPatient.activity_level || 'No registrado'}</Text>
              </View>
              <View style={styles.clinicalGridItem}>
                <Text style={styles.clinicalLabel}>Alergias</Text>
                <Text style={styles.clinicalValue}>{selectedPatient.allergies || 'Ninguna registrada'}</Text>
              </View>
            </View>

            <View style={{ marginTop: 12, padding: 10, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={styles.recLabel}>Medicamentos Activos</Text>
              <Text style={[styles.recText, { fontSize: 12 }]}>{selectedPatient.medications || 'Ninguno registrado'}</Text>
            </View>

            <View style={{ marginTop: 8, padding: 10, backgroundColor: COLORS.card, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={styles.recLabel}>Antecedentes Clínicos / Notas</Text>
              <Text style={[styles.recText, { fontSize: 12 }]}>{selectedPatient.medical_history || 'Sin antecedentes registrados'}</Text>
            </View>
          </View>

          {/* RF-06: Reportes clínicos, gráficos e indicadores */}
          <DoctorClinicalReports
            patientId={selectedPatient.id}
            patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
            theme={isDark ? 'dark' : 'light'}
          />

          {/* Registro Integral de Variables Metabólicas RF-02 (Doctor View) */}
          {docPatientMetabolicSummary && (() => {
            const qs = docPatientMetabolicSummary.quick_stats || {};
            const nut = docPatientMetabolicSummary.nutrition || {};
            const glucoseStatus = (level: number) => {
              if (level < 70) return { label: 'Baja', color: COLORS.clinical.glucoseLow, bg: isDark ? 'rgba(251, 191, 36, 0.14)' : 'rgba(180, 83, 9, 0.12)' };
              if (level > 180) return { label: 'Alta', color: COLORS.clinical.glucoseHigh, bg: isDark ? 'rgba(248, 113, 113, 0.14)' : 'rgba(185, 28, 28, 0.1)' };
              return { label: 'En rango', color: COLORS.clinical.glucoseNormal, bg: isDark ? 'rgba(52, 211, 153, 0.14)' : 'rgba(4, 120, 87, 0.1)' };
            };
            const bmiColor = qs.bmi_category === 'Normal' ? COLORS.clinical.glucoseNormal
              : qs.bmi_category === 'Sobrepeso' ? COLORS.clinical.glucoseElevated
              : qs.bmi_category === 'Obesidad' ? COLORS.clinical.glucoseHigh
              : COLORS.accent;

            const MetaSection = ({
              icon,
              iconColor,
              title,
              emptyText,
              children,
              hasData,
            }: {
              icon: React.ComponentProps<typeof Ionicons>['name'];
              iconColor: string;
              title: string;
              emptyText: string;
              children: React.ReactNode;
              hasData: boolean;
            }) => (
              <View style={{
                backgroundColor: COLORS.bg,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 12,
                marginBottom: 10,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: hasData ? 10 : 6 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: `${iconColor}22`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name={icon} size={16} color={iconColor} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text, flex: 1 }}>{title}</Text>
                </View>
                {hasData ? children : (
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 16 }}>{emptyText}</Text>
                )}
              </View>
            );

            return (
            <View style={[styles.card, { borderColor: COLORS.accent, borderWidth: 1.5 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Ionicons name="pulse" size={20} color={COLORS.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text }}>Variables Metabólicas</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                    Resumen clínico de {selectedPatient.first_name} · últimos registros
                  </Text>
                </View>
              </View>

              {/* KPIs rápidos */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                <View style={{ flexGrow: 1, minWidth: '45%', backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '700', marginBottom: 4 }}>GLUCEMIA</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: qs.latest_glucose != null ? (Number(qs.latest_glucose) > 180 ? COLORS.clinical.glucoseHigh : Number(qs.latest_glucose) < 70 ? COLORS.clinical.glucoseLow : COLORS.text) : COLORS.textMuted }}>
                    {qs.latest_glucose != null ? `${qs.latest_glucose}` : '—'}
                    {qs.latest_glucose != null && <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textMuted }}> mg/dL</Text>}
                  </Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                    {qs.latest_glucose_context || `${qs.glucose_count || 0} registros`}
                  </Text>
                </View>
                <View style={{ flexGrow: 1, minWidth: '45%', backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '700', marginBottom: 4 }}>IMC</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: qs.latest_bmi != null ? bmiColor : COLORS.textMuted }}>
                    {qs.latest_bmi != null ? qs.latest_bmi : '—'}
                  </Text>
                  <Text style={{ fontSize: 10, color: bmiColor, marginTop: 2, fontWeight: '700' }}>
                    {qs.bmi_category || 'Sin dato'}
                  </Text>
                </View>
                <View style={{ flexGrow: 1, minWidth: '45%', backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '700', marginBottom: 4 }}>ACTIVIDAD 7D</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>
                    {qs.activity_minutes_7d || 0}
                    <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textMuted }}> min</Text>
                  </Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                    {qs.medication_doses_7d || 0} dosis meds / 7d
                  </Text>
                </View>
                <View style={{ flexGrow: 1, minWidth: '45%', backgroundColor: COLORS.bg, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border }}>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '700', marginBottom: 4 }}>NUTRICIÓN 7D</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>
                    {nut.last_7_days_calories != null ? Math.round(nut.last_7_days_calories) : '—'}
                    {nut.last_7_days_calories != null && <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textMuted }}> kcal</Text>}
                  </Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                    {nut.last_7_days_carbs_g != null ? `${nut.last_7_days_carbs_g}g CH` : 'Sin comidas con CH'}
                  </Text>
                </View>
              </View>

              {/* Nutrición detallada */}
              <MetaSection
                icon="nutrition"
                iconColor="#F59E0B"
                title="Nutrición de comidas registradas"
                emptyText="El paciente aún no tiene comidas con datos nutricionales (kcal, carbohidratos, IG, CG)."
                hasData={!!(nut.intake_count > 0 && (nut.total_calories != null || nut.avg_glycemic_index != null))}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { label: 'Calorías (recientes)', value: nut.total_calories != null ? `${Math.round(nut.total_calories)} kcal` : '—' },
                    { label: 'Carbohidratos', value: nut.total_carbs_g != null ? `${nut.total_carbs_g} g` : '—' },
                    { label: 'IG promedio', value: nut.avg_glycemic_index != null ? String(nut.avg_glycemic_index) : '—' },
                    { label: 'CG promedio', value: nut.avg_glycemic_load != null ? String(nut.avg_glycemic_load) : '—' },
                  ].map((chip) => (
                    <View key={chip.label} style={{
                      flexGrow: 1,
                      minWidth: '40%',
                      backgroundColor: COLORS.card,
                      borderRadius: 10,
                      padding: 8,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}>
                      <Text style={{ fontSize: 9, color: COLORS.textMuted, fontWeight: '700', marginBottom: 2 }}>{chip.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>{chip.value}</Text>
                    </View>
                  ))}
                </View>
              </MetaSection>

              <MetaSection
                icon="water"
                iconColor={COLORS.clinical.glucoseHigh}
                title="Glucemia capilar"
                emptyText="Sin mediciones de glucemia. Sugiere al paciente registrar ayunas y postprandial."
                hasData={docPatientMetabolicSummary.glucose_logs.length > 0}
              >
                <View style={{ gap: 6 }}>
                  {docPatientMetabolicSummary.glucose_logs.slice(0, 5).map((gLog: any, idx: number) => {
                    const st = glucoseStatus(Number(gLog.glucose_level));
                    return (
                      <View key={gLog.id || idx} style={{
                        backgroundColor: COLORS.card,
                        padding: 10,
                        borderRadius: 10,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: COLORS.border,
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: st.color }}>
                            {gLog.glucose_level} <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.textMuted }}>mg/dL</Text>
                          </Text>
                          <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{gLog.context}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={{ backgroundColor: st.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: st.color }}>{st.label}</Text>
                          </View>
                          <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
                            {new Date(gLog.recorded_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </MetaSection>

              <MetaSection
                icon="scale"
                iconColor={COLORS.clinical.glucoseNormal}
                title="Antropometría e IMC"
                emptyText="Sin historial de peso/estatura. Pide al paciente actualizar su ficha."
                hasData={docPatientMetabolicSummary.anthropometric_logs.length > 0}
              >
                <View style={{ gap: 6 }}>
                  {docPatientMetabolicSummary.anthropometric_logs.slice(0, 4).map((aLog: any, idx: number) => (
                    <View key={aLog.id || idx} style={{
                      backgroundColor: COLORS.card,
                      padding: 10,
                      borderRadius: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>
                          {aLog.weight_kg} kg · {aLog.height_cm} cm
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.clinical.glucoseNormal, marginTop: 2 }}>
                          IMC {aLog.bmi} kg/m²
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
                        {new Date(aLog.recorded_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </MetaSection>

              <MetaSection
                icon="medkit"
                iconColor={COLORS.info}
                title="Bitácora de medicación"
                emptyText="Sin dosis registradas. Revisa si el paciente está documentando su tratamiento."
                hasData={docPatientMetabolicSummary.medication_logs.length > 0}
              >
                <View style={{ gap: 6 }}>
                  {docPatientMetabolicSummary.medication_logs.slice(0, 4).map((mLog: any, idx: number) => (
                    <View key={mLog.id || idx} style={{
                      backgroundColor: COLORS.card,
                      padding: 10,
                      borderRadius: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>{mLog.medication_name}</Text>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>Dosis: {mLog.dosage}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
                        {new Date(mLog.taken_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </MetaSection>

              <MetaSection
                icon="walk"
                iconColor={COLORS.purple}
                title="Actividad física"
                emptyText="Sin actividad física registrada en la bitácora del paciente."
                hasData={docPatientMetabolicSummary.physical_activity_logs.length > 0}
              >
                <View style={{ gap: 6 }}>
                  {docPatientMetabolicSummary.physical_activity_logs.slice(0, 4).map((actLog: any, idx: number) => (
                    <View key={actLog.id || idx} style={{
                      backgroundColor: COLORS.card,
                      padding: 10,
                      borderRadius: 10,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>{actLog.activity_type}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.purple, marginTop: 2 }}>
                          {actLog.duration_minutes} min
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: COLORS.textMuted }}>
                        {new Date(actLog.recorded_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </MetaSection>
            </View>
            );
          })()}

          {/* Malestares e Incidencias del Paciente (Doctor View) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="warning" size={18} color={COLORS.clinical.incident} />
              <Text style={styles.cardTitle}>Alertas de Malestar e Incidencias</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Revisa los dolores, síntomas o consultas reportadas por {selectedPatient.first_name}. Puedes responder con consejos directos.
            </Text>

            {doctorIncidents.filter(inc => inc.patient_id === selectedPatient?.id).length > 0 ? (
              <ScrollView style={{ maxHeight: 220, marginTop: 10 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {doctorIncidents.filter(inc => inc.patient_id === selectedPatient?.id).map((inc, index) => (
                  <View key={inc.id || index} style={[styles.incidentItemCard, { borderColor: inc.doctor_response ? `${COLORS.clinical.responded}66` : `${COLORS.clinical.incident}66` }]}>
                    <View style={styles.incidentItemHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="bandage" size={14} color={COLORS.clinical.incident} />
                        <Text style={styles.incidentItemTitle} numberOfLines={2}>{inc.description}</Text>
                      </View>
                      {inc.pain_level && (
                        <View style={styles.painBadge}>
                          <Text style={styles.painBadgeText}>Dolor: {inc.pain_level}/10</Text>
                        </View>
                      )}
                    </View>

                    {inc.doctor_question && (
                      <View style={styles.incidentQuestionBox}>
                        <Text style={styles.incidentQuestionText}>
                          <Text style={{ fontWeight: '700' }}>Pregunta del Paciente: </Text>
                          {inc.doctor_question}
                        </Text>
                      </View>
                    )}

                    {inc.doctor_response ? (
                      <View style={[styles.mealFeedbackBox, { marginLeft: 0, marginTop: 8, backgroundColor: 'rgba(0, 201, 167, 0.08)', borderColor: '#00C9A730' }]}>
                        <Ionicons name="medical" size={14} color={COLORS.accent} />
                        <Text style={styles.mealFeedbackText}>
                          <Text style={{ fontWeight: '700', color: COLORS.accent }}>Tu Indicación Directa: </Text>
                          {inc.doctor_response}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: 8 }}>
                        <TextInput 
                          style={[styles.textInput, { fontSize: 11, padding: 6, height: 50, marginBottom: 8 }]}
                          placeholder="Escribe tu consejo, recomendación o receta de respuesta de inmediato..."
                          placeholderTextColor={COLORS.textMuted}
                          multiline
                          value={incidentResponseText[inc.id] || ''}
                          onChangeText={(val) => setIncidentResponseText(prev => ({ ...prev, [inc.id]: val }))}
                        />
                        <TouchableOpacity 
                          style={[styles.primaryBtn, { backgroundColor: '#FF6B6B', paddingVertical: 6 }]}
                          onPress={() => handleRespondToIncident(inc.id)}
                        >
                          <Text style={styles.primaryBtnText}>Enviar Consejo Directo</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.emptyText, { marginTop: 10 }]}>El paciente no tiene incidencias ni dolores reportados.</Text>
            )}
          </View>

          {/* Historial de Alimentación Reciente (Doctor View) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="restaurant" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Historial de Alimentación de {selectedPatient.first_name}</Text>
            </View>

            {loadingPatientIntakes ? (
              <ActivityIndicator color={COLORS.accent} size="small" style={{ marginVertical: 10 }} />
            ) : selectedPatientIntakes.length > 0 ? (
              <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {selectedPatientIntakes.map((item, idx) => (
                  <View key={item.id || idx} style={{ marginBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 10 }}>
                    <View style={styles.historyItem}>
                      <View style={styles.historyLeft}>
                        {item.image_base64 ? (
                          <Image 
                            source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} 
                            style={styles.historyThumbnail} 
                          />
                        ) : (
                          <View style={styles.historyThumbnailPlaceholder}>
                            <Ionicons name="restaurant" size={16} color={COLORS.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyFoodName}>{item.food_name}</Text>
                          <Text style={styles.historyMeta}>
                            {item.meal_type} · {item.portion_size_g}g
                            {item.calories != null ? ` · ${item.calories} kcal` : ''}
                            {item.carbs_g != null ? ` · ${item.carbs_g}g CH` : ''}
                          </Text>
                          {(item.glycemic_index != null || item.glycemic_load != null) && (
                            <Text style={[styles.historyMeta, { color: COLORS.accent }]}>
                              {item.glycemic_index != null ? `IG ${item.glycemic_index}` : ''}
                              {item.glycemic_index != null && item.glycemic_load != null ? ' · ' : ''}
                              {item.glycemic_load != null ? `CG ${item.glycemic_load}` : ''}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.historyTime}>
                          {new Date(item.consumed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={[styles.historyMeta, { color: COLORS.accent, fontSize: 9 }]}>
                          {new Date(item.consumed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                    </View>

                    {/* Mostrar evaluación actual */}
                    {item.doctor_assessment ? (
                      <View style={[styles.mealFeedbackBox, { marginLeft: 0, marginTop: 4, borderColor: item.doctor_assessment === 'CORRECTA' ? '#00C9A740' : '#FF6B6B40', backgroundColor: item.doctor_assessment === 'CORRECTA' ? 'rgba(0, 201, 167, 0.05)' : 'rgba(255, 107, 107, 0.05)' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons 
                            name={item.doctor_assessment === 'CORRECTA' ? "checkmark-circle" : "close-circle"} 
                            size={14} 
                            color={item.doctor_assessment === 'CORRECTA' ? COLORS.accent : '#FF6B6B'} 
                          />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: item.doctor_assessment === 'CORRECTA' ? COLORS.accent : '#FF6B6B' }}>
                            Evaluación: {item.doctor_assessment === 'CORRECTA' ? 'Correcta' : 'Evitar'}
                          </Text>
                        </View>
                        {item.doctor_comment && (
                          <Text style={[styles.mealFeedbackText, { marginTop: 2, fontSize: 11 }]}>
                            <Text style={{ fontWeight: '700' }}>Comentario: </Text>{item.doctor_comment}
                          </Text>
                        )}
                        <TouchableOpacity 
                          style={{ marginTop: 6, alignSelf: 'flex-start' }}
                          onPress={() => {
                            setAssessingIntakeId(item.id);
                            setAssessmentRating(item.doctor_assessment);
                            setAssessmentComment(item.doctor_comment || '');
                          }}
                        >
                          <Text style={{ fontSize: 10, color: COLORS.accent, fontWeight: '600', textDecorationLine: 'underline' }}>Editar Evaluación</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' }}>Sin evaluación médica</Text>
                        <TouchableOpacity 
                          style={[styles.clinicalEditBtn, { paddingVertical: 4, paddingHorizontal: 8 }]}
                          onPress={() => {
                            setAssessingIntakeId(item.id);
                            setAssessmentRating('CORRECTA');
                            setAssessmentComment('');
                          }}
                        >
                          <Ionicons name="create-outline" size={12} color={COLORS.accent} />
                          <Text style={{ fontSize: 10, color: COLORS.accent, fontWeight: '600' }}>Evaluar Comida</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Formulario inline de evaluación */}
                    {assessingIntakeId === item.id && (
                      <View style={{ marginTop: 8, padding: 10, backgroundColor: COLORS.surface, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>Calificar esta Ingesta</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                          <TouchableOpacity 
                            style={{ 
                              flex: 1, 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              gap: 6, 
                              paddingVertical: 6, 
                              borderRadius: 6, 
                              borderWidth: 1.5, 
                              borderColor: assessmentRating === 'CORRECTA' ? COLORS.accent : COLORS.border,
                              backgroundColor: assessmentRating === 'CORRECTA' ? 'rgba(0, 201, 167, 0.1)' : COLORS.card
                            }}
                            onPress={() => setAssessmentRating('CORRECTA')}
                          >
                            <Ionicons name="checkmark" size={14} color={COLORS.accent} />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.accent }}>Correcta</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={{ 
                              flex: 1, 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              gap: 6, 
                              paddingVertical: 6, 
                              borderRadius: 6, 
                              borderWidth: 1.5, 
                              borderColor: assessmentRating === 'INCORRECTA' ? '#FF6B6B' : COLORS.border,
                              backgroundColor: assessmentRating === 'INCORRECTA' ? 'rgba(255, 107, 107, 0.1)' : COLORS.card
                            }}
                            onPress={() => setAssessmentRating('INCORRECTA')}
                          >
                            <Ionicons name="close" size={14} color="#FF6B6B" />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#FF6B6B' }}>Evitar</Text>
                          </TouchableOpacity>
                        </View>

                        <TextInput 
                          style={[styles.textInput, { fontSize: 11, padding: 6, height: 50, marginBottom: 8 }]}
                          placeholder="Introduce sugerencias (ej: reducir carbohidratos simples, excelente elección)..."
                          placeholderTextColor={COLORS.textMuted}
                          multiline
                          value={assessmentComment}
                          onChangeText={setAssessmentComment}
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                          <TouchableOpacity 
                            style={{ paddingVertical: 4, paddingHorizontal: 10 }}
                            onPress={() => setAssessingIntakeId(null)}
                          >
                            <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Cancelar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                            style={{ backgroundColor: COLORS.accent, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4 }}
                            onPress={() => handleAssessMeal(item.id)}
                            disabled={savingAssessment}
                          >
                            <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>
                              {savingAssessment ? 'Guardando...' : 'Guardar'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>El paciente no ha registrado comidas todavía.</Text>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="alarm" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Horarios de comidas</Text>
            </View>
            <Text style={[styles.emptyText, { marginBottom: 12 }]}>
              El paciente recibe un aviso en el móvil {docMealSchedule?.advance_minutes ?? 30} min antes de cada comida.
            </Text>

            {loadingMealSchedule ? (
              <ActivityIndicator color={COLORS.accent} />
            ) : docMealSchedule ? (
              <>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Anticipación (minutos)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="number-pad"
                    value={String(docMealSchedule.advance_minutes)}
                    onChangeText={(val) =>
                      setDocMealSchedule((prev) =>
                        prev
                          ? { ...prev, advance_minutes: Math.max(0, Number(val.replace(/[^0-9]/g, '') || 0)) }
                          : prev
                      )
                    }
                    maxLength={3}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.miniListItem, docMealSchedule.enabled && styles.miniListItemActive, { marginBottom: 10 }]}
                  onPress={() =>
                    setDocMealSchedule((prev) => (prev ? { ...prev, enabled: !prev.enabled } : prev))
                  }
                >
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                    Recordatorios {docMealSchedule.enabled ? 'activados' : 'desactivados'}
                  </Text>
                </TouchableOpacity>

                {docMealSchedule.slots.map((slot) => (
                  <View key={slot.meal_type} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={styles.inputLabel}>{slot.meal_type}</Text>
                      <TouchableOpacity
                        onPress={() => updateDocMealSlot(slot.meal_type, { enabled: !slot.enabled })}
                        style={[styles.miniListItem, slot.enabled && styles.miniListItemActive, { paddingVertical: 6, paddingHorizontal: 10 }]}
                      >
                        <Text style={{ fontSize: 12, color: COLORS.text }}>
                          {slot.enabled ? 'Activo' : 'Off'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={slot.meal_time}
                      onChangeText={(val) => updateDocMealSlot(slot.meal_type, { meal_time: val })}
                      placeholder="HH:mm"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.primaryBtn, savingMealSchedule && { opacity: 0.7 }]}
                  onPress={handleSaveMealSchedule}
                  disabled={savingMealSchedule}
                >
                  <Text style={styles.primaryBtnText}>
                    {savingMealSchedule ? 'Guardando...' : 'Guardar Horarios'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptyText}>No se pudo cargar la configuración de horarios.</Text>
            )}
          </View>

          <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="create" size={18} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Editar Directrices para: {selectedPatient.first_name}</Text>
          </View>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Recomendación Nutricional / Médica</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Consejos prácticos, porciones de carbohidratos máximos por comida..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              value={docRecommendations}
              onChangeText={setDocRecommendations}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Reglas Especiales para la IA</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Define las restricciones de alimentos. Ej: 'Prohíbe que el paciente consuma piña o mango en la cena'"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              value={docAiRules}
              onChangeText={setDocAiRules}
            />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveDocRecommendation}>
            <Text style={styles.primaryBtnText}>Guardar Directrices</Text>
          </TouchableOpacity>
        </View>
        </>
      ) : null}
    </View>
  );

  // Render C: VISTA ADMIN
  const renderAdminDashboard = () => (
    <AdminDashboard
      users={allUsersList}
      theme={theme}
      loading={loading}
      assignPatientId={assignPatientId}
      assignDoctorId={assignDoctorId}
      changeRoleUserId={changeRoleUserId}
      changeRoleNewVal={changeRoleNewVal}
      onAssignPatientId={setAssignPatientId}
      onAssignDoctorId={setAssignDoctorId}
      onChangeRoleUserId={setChangeRoleUserId}
      onChangeRoleNewVal={setChangeRoleNewVal}
      onAssign={handleAssignPatient}
      onChangeRole={handleChangeRole}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: COLORS.bg }]}>
      {/* Header Fijo Limpio sin Gradiente (Compacto al hacer Scroll) */}
      <View 
        style={[
          styles.headerBanner,
          { 
            backgroundColor: COLORS.surface, 
            borderBottomColor: COLORS.border,
            paddingTop: isScrolled ? (Platform.OS === 'ios' ? 44 : 28) : (Platform.OS === 'ios' ? 56 : 40),
            paddingBottom: isScrolled ? 10 : 16,
            elevation: isScrolled ? 4 : 1,
          }
        ]}
      >
        <View style={styles.headerInfo}>
          <Text style={[styles.welcomeUser, { color: COLORS.text, fontSize: isScrolled ? 18 : 22 }]}>
            ¡Hola, {user?.first_name || 'Usuario'}!
          </Text>
          {!isScrolled && user?.role !== 'PACIENTE' && (
            <Text style={[styles.roleLabel, { color: COLORS.purple }]}>
              Rol: {user?.role === 'CUIDADOR' ? 'DOCTOR' : user?.role}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Botón de cambio de Modo Claro / Oscuro */}
          <TouchableOpacity 
            style={[
              styles.logoutBtn, 
              { 
                backgroundColor: isDark ? 'rgba(167, 139, 250, 0.15)' : 'rgba(109, 40, 217, 0.08)',
                borderColor: COLORS.border,
                borderWidth: 1,
              }
            ]} 
            onPress={toggleTheme}
            activeOpacity={0.8}
          >
            <Ionicons name={isDark ? "sunny" : "moon"} size={20} color={COLORS.purple} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.logoutBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 107, 107, 0.12)' : 'rgba(220, 38, 38, 0.08)',
                borderColor: COLORS.border,
                borderWidth: 1,
              }
            ]} 
            onPress={logout}
          >
            <Ionicons name="log-out" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Alertas de error/éxito */}
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!!successMsg && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        {loading && (
          <ActivityIndicator color={COLORS.accent} size="large" style={{ marginVertical: 10 }} />
        )}

        {/* Carga condicional según el rol */}
        {user?.role === 'PACIENTE' && renderPatientDashboard()}
        {user?.role === 'CUIDADOR' && renderDoctorDashboard()}
        {user?.role === 'ADMIN' && renderAdminDashboard()}
      </ScrollView>

      {/* ── Modal de Reportar Incidencia / Malestar (Paciente) ── */}
      <Modal
        visible={incidentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIncidentModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent, { height: '75%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="warning" size={22} color="#FF6B6B" />
                <Text style={styles.modalTitle}>Reportar Malestar o Incidencia</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIncidentModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <Text style={styles.cardSubtitle}>
                Describe tu malestar con la mayor precisión posible. Tu médico recibirá un aviso de inmediato.
              </Text>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>¿Qué malestar sientes?</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Ej. Fuerte dolor de cabeza localizado, mareos al levantarme, náuseas..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  value={incidentForm.description}
                  onChangeText={(val) => setIncidentForm(prev => ({ ...prev, description: val }))}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nivel de Dolor o Malestar: {incidentForm.pain_level}/10</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        {
                          width: 30,
                          height: 30,
                          borderRadius: 15,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1.5,
                          borderColor: incidentForm.pain_level === num ? '#FF6B6B' : COLORS.border,
                          backgroundColor: incidentForm.pain_level === num ? '#FF6B6B20' : COLORS.card,
                        }
                      ]}
                      onPress={() => setIncidentForm(prev => ({ ...prev, pain_level: num }))}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: incidentForm.pain_level === num ? '#FF6B6B' : COLORS.text }}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Consulta directa a tu Médico (Opcional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="¿Quieres pedirle algún consejo específico o dosis de ajuste?"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  value={incidentForm.doctor_question}
                  onChangeText={(val) => setIncidentForm(prev => ({ ...prev, doctor_question: val }))}
                />
              </View>

              {submittingIncident ? (
                <ActivityIndicator color="#FF6B6B" size="small" style={{ marginVertical: 12 }} />
              ) : (
                <TouchableOpacity 
                  style={[styles.primaryBtn, { backgroundColor: '#FF6B6B' }]} 
                  onPress={handleSubmitIncident}
                >
                  <Text style={styles.primaryBtnText}>Enviar Reporte Médico</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal de Ficha/Perfil Clínico del Paciente ── */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent, { height: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="medical" size={22} color={COLORS.accent} />
                <Text style={styles.modalTitle}>Completar Ficha Médica</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setProfileModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.cardSubtitle}>
                Esta información clínica es confidencial y permite al médico programar pautas específicas para tu salud e inyectarlas al asistente de IA.
              </Text>

              {/* Fecha de Nacimiento Selector */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Fecha de Nacimiento</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={profileForm.date_of_birth || '1990-01-01'}
                    max={new Date().toISOString().split('T')[0]}
                    min="1920-01-01"
                    onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                    style={{
                      backgroundColor: COLORS.card,
                      color: COLORS.text,
                      borderColor: COLORS.border,
                      borderWidth: '1px',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      fontSize: '14px',
                      width: '100%',
                      boxSizing: 'border-box',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1.2, textAlign: 'center' }]}
                      placeholder="AAAA"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={4}
                      value={(profileForm.date_of_birth || '1990-01-01').split('-')[0]}
                      onChangeText={(yr) => {
                        const parts = (profileForm.date_of_birth || '1990-01-01').split('-');
                        const cleanYr = yr.replace(/[^0-9]/g, '');
                        setProfileForm({ ...profileForm, date_of_birth: `${cleanYr}-${parts[1] || '01'}-${parts[2] || '01'}` });
                      }}
                    />
                    <Text style={{ alignSelf: 'center', color: COLORS.textMuted, fontSize: 16 }}>/</Text>
                    <TextInput
                      style={[styles.textInput, { flex: 1, textAlign: 'center' }]}
                      placeholder="MM"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={(profileForm.date_of_birth || '1990-01-01').split('-')[1]}
                      onChangeText={(mo) => {
                        const parts = (profileForm.date_of_birth || '1990-01-01').split('-');
                        const cleanMo = mo.replace(/[^0-9]/g, '');
                        setProfileForm({ ...profileForm, date_of_birth: `${parts[0] || '1990'}-${cleanMo}-${parts[2] || '01'}` });
                      }}
                    />
                    <Text style={{ alignSelf: 'center', color: COLORS.textMuted, fontSize: 16 }}>/</Text>
                    <TextInput
                      style={[styles.textInput, { flex: 1, textAlign: 'center' }]}
                      placeholder="DD"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={(profileForm.date_of_birth || '1990-01-01').split('-')[2]}
                      onChangeText={(dy) => {
                        const parts = (profileForm.date_of_birth || '1990-01-01').split('-');
                        const cleanDy = dy.replace(/[^0-9]/g, '');
                        setProfileForm({ ...profileForm, date_of_birth: `${parts[0] || '1990'}-${parts[1] || '01'}-${cleanDy}` });
                      }}
                    />
                  </View>
                )}
              </View>

              {/* Género */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Género</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['Masculino', 'Femenino', 'Otro'].map((gOption) => {
                    const isSelected = (profileForm.gender || '').toLowerCase() === gOption.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={gOption}
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: isSelected ? COLORS.accent : COLORS.border,
                          backgroundColor: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(5, 150, 105, 0.12)') : COLORS.card,
                        }}
                        onPress={() => setProfileForm({ ...profileForm, gender: gOption })}
                      >
                        <Text style={{ fontSize: 12, fontWeight: isSelected ? '800' : '600', color: isSelected ? COLORS.accent : COLORS.textMuted }}>
                          {gOption}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Peso */}
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Peso Actual</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                      placeholder="78.5"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      maxLength={5}
                      value={profileForm.weight_kg}
                      onChangeText={(val) => {
                        let cleaned = val.replace(/[^0-9.]/g, '');
                        const parts = cleaned.split('.');
                        if (parts.length > 2) cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
                        setProfileForm({ ...profileForm, weight_kg: cleaned });
                      }}
                    />
                    <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 10, height: 48, justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textMuted }}>kg</Text>
                    </View>
                  </View>
                </View>

                {/* Estatura */}
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Estatura</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                      placeholder="172"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={3}
                      value={profileForm.height_cm}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/[^0-9]/g, '');
                        setProfileForm({ ...profileForm, height_cm: cleaned });
                      }}
                    />
                    <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 10, height: 48, justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textMuted }}>cm</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Tipo de Diabetes Selector */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Tipo de Diabetes</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {['Tipo 2', 'Tipo 1', 'Pre-diabetes', 'Gestacional'].map((dType) => {
                    const isSelected = (profileForm.diabetes_type || 'Tipo 2').toLowerCase() === dType.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={dType}
                        style={{
                          flex: 1,
                          minWidth: 70,
                          paddingVertical: 8,
                          borderRadius: 10,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: isSelected ? COLORS.accent : COLORS.border,
                          backgroundColor: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(5, 150, 105, 0.12)') : COLORS.card,
                        }}
                        onPress={() => setProfileForm({ ...profileForm, diabetes_type: dType })}
                      >
                        <Text style={{ fontSize: 11, fontWeight: isSelected ? '800' : '600', color: isSelected ? COLORS.accent : COLORS.textMuted }}>
                          {dType}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Año de Diagnóstico */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Año del Diagnóstico</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: 2018"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={profileForm.diagnosis_year}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/[^0-9]/g, '');
                    setProfileForm({ ...profileForm, diagnosis_year: cleaned });
                  }}
                />
              </View>

              {/* Último HbA1c */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Última Glicosilada (HbA1c)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                    placeholder="Ej: 6.8"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="decimal-pad"
                    maxLength={4}
                    value={profileForm.last_hba1c}
                    onChangeText={(val) => {
                      let cleaned = val.replace(/[^0-9.]/g, '');
                      const parts = cleaned.split('.');
                      if (parts.length > 2) cleaned = `${parts[0]}.${parts.slice(1).join('')}`;
                      setProfileForm({ ...profileForm, last_hba1c: cleaned });
                    }}
                  />
                  <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 12, height: 48, justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textMuted }}>%</Text>
                  </View>
                </View>
              </View>

              {/* Medicación */}
              <View style={styles.inputWrapper}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Medicamentos habituales</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{(profileForm.medications || '').length}/250</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Ej: Metformina 850mg (mañana y noche), Insulina 12 UI antes de acostarse"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={250}
                  value={profileForm.medications}
                  onChangeText={(text) => setProfileForm({ ...profileForm, medications: text })}
                />
              </View>

              {/* Alergias / Intolerancias */}
              <View style={styles.inputWrapper}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Alergias o Restricciones alimenticias</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{(profileForm.allergies || '').length}/250</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: Intolerancia al gluten, alergia al pescado, ninguna"
                  placeholderTextColor={COLORS.textMuted}
                  maxLength={250}
                  value={profileForm.allergies}
                  onChangeText={(text) => setProfileForm({ ...profileForm, allergies: text })}
                />
              </View>

              {/* Nivel de Actividad */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nivel de Actividad Física habitual</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {['Sedentario', 'Poco Activo', 'Moderado', 'Muy Activo'].map((actOption) => {
                    const isSelected = (profileForm.activity_level || '').toLowerCase() === actOption.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={actOption}
                        style={{
                          flex: 1,
                          minWidth: 70,
                          paddingVertical: 8,
                          borderRadius: 10,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: isSelected ? COLORS.purple : COLORS.border,
                          backgroundColor: isSelected ? (isDark ? 'rgba(167, 139, 250, 0.18)' : 'rgba(109, 40, 217, 0.08)') : COLORS.card,
                        }}
                        onPress={() => setProfileForm({ ...profileForm, activity_level: actOption })}
                      >
                        <Text style={{ fontSize: 11, fontWeight: isSelected ? '800' : '600', color: isSelected ? COLORS.purple : COLORS.textMuted }}>
                          {actOption}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Historial Médico General / Notas */}
              <View style={styles.inputWrapper}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.inputLabel}>Otras Comorbilidades / Historial</Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{(profileForm.medical_history || '').length}/250</Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Ej: Hipertensión arterial en tratamiento con losartán, dislipidemia..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={250}
                  value={profileForm.medical_history}
                  onChangeText={(text) => setProfileForm({ ...profileForm, medical_history: text })}
                />
              </View>

              <TouchableOpacity 
                style={[styles.primaryBtn, { marginVertical: 20 }]} 
                onPress={handleSavePatientProfile}
              >
                <Text style={styles.primaryBtnText}>Guardar Ficha Médica</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal para Registrar Alimento en Categoría ── */}
      <Modal
        visible={addIntakeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddIntakeModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent, { height: '70%', backgroundColor: COLORS.card }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(5, 150, 105, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="restaurant" size={16} color={COLORS.accent} />
                </View>
                <Text style={[styles.modalTitle, { color: COLORS.text }]}>
                  Agregar a {mealType.charAt(0) + mealType.slice(1).toLowerCase()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setAddIntakeModalVisible(false)}
              >
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 10 }}>
              {/* Botón de Escaneo Inteligente IA */}
              <TouchableOpacity 
                onPress={() => {
                  setAddIntakeModalVisible(false);
                  handleScanPlate();
                }}
                disabled={scanningImage}
                activeOpacity={0.85}
                style={{ marginBottom: 16 }}
              >
                <LinearGradient
                  colors={['#7C3AED', '#6D28D9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.scanBtn, { borderWidth: 0, marginBottom: 0 }]}
                >
                  <View style={styles.scanBtnRow}>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.scanBtnText}>Escanear Plato con Foto (IA)</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Vista previa de foto adjunta si se escaneó */}
              {foodImageBase64 && (
                <View style={[styles.imagePreviewContainer, { marginBottom: 14 }]}>
                  <Image 
                    source={{ uri: `data:image/jpeg;base64,${foodImageBase64}` }} 
                    style={styles.imagePreview} 
                  />
                  <TouchableOpacity 
                    style={styles.removeImageBtn} 
                    onPress={() => setFoodImageBase64(null)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Notificación de sugerencia de la IA si difiere */}
              {aiMealSuggestionNotice ? (
                <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="information-circle-outline" size={18} color="#F59E0B" />
                  <Text style={{ fontSize: 11, color: COLORS.text, flex: 1, fontWeight: '600', lineHeight: 16 }}>
                    {aiMealSuggestionNotice}
                  </Text>
                </View>
              ) : null}

              {/* Selector de Categoría de Comida */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Momento del día (Comida)</Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { key: 'DESAYUNO', label: 'Desayuno' },
                    { key: 'ALMUERZO', label: 'Almuerzo' },
                    { key: 'CENA', label: 'Cena' },
                    { key: 'MERIENDA', label: 'Merienda' },
                  ].map((mType) => {
                    const isSelected = mealType === mType.key;
                    return (
                      <TouchableOpacity
                        key={mType.key}
                        style={{
                          flex: 1,
                          minWidth: 70,
                          paddingVertical: 8,
                          borderRadius: 10,
                          alignItems: 'center',
                          borderWidth: 1.5,
                          borderColor: isSelected ? COLORS.accent : COLORS.border,
                          backgroundColor: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(5, 150, 105, 0.12)') : COLORS.card,
                        }}
                        onPress={() => {
                          setMealType(mType.key as any);
                          setAiMealSuggestionNotice('');
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: isSelected ? '800' : '600', color: isSelected ? COLORS.accent : COLORS.textMuted }}>
                          {mType.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Input Nombre Alimento */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>¿Qué alimento o plato consumiste?</Text>
                <TextInput 
                  style={[styles.textInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]}
                  placeholder="Ej. Pollo a la plancha con ensalada de pepino"
                  placeholderTextColor={COLORS.textMuted}
                  value={foodName}
                  onChangeText={setFoodName}
                />
              </View>

              {/* Input Porción en Gramos */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Porción aproximada (Gramos)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput 
                    style={[styles.textInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text, flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                    placeholder="Ej. 200"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={5}
                    value={portion}
                    onChangeText={(val) => setPortion(val.replace(/[^0-9]/g, ''))}
                  />
                  <View style={{ backgroundColor: COLORS.border, paddingHorizontal: 12, height: 48, justifyContent: 'center', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.textMuted }}>g</Text>
                  </View>
                </View>
              </View>

              {/* Valores nutricionales de la porción (IA o manual) */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nutrición de la porción (relleno por IA / editable)</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: '600' }}>Calorías (kcal)</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]}
                      placeholder="Ej. 420"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      value={calories}
                      onChangeText={(val) => setCalories(val.replace(/[^0-9.]/g, ''))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: '600' }}>Carbohidratos (g)</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]}
                      placeholder="Ej. 35"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      value={carbsG}
                      onChangeText={(val) => setCarbsG(val.replace(/[^0-9.]/g, ''))}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: '600' }}>Índice glucémico</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]}
                      placeholder="Ej. 50"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      value={glycemicIndex}
                      onChangeText={(val) => setGlycemicIndex(val.replace(/[^0-9.]/g, ''))}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: '600' }}>Carga glucémica</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]}
                      placeholder="Ej. 17.5"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="decimal-pad"
                      value={glycemicLoad}
                      onChangeText={(val) => setGlycemicLoad(val.replace(/[^0-9.]/g, ''))}
                    />
                  </View>
                </View>
              </View>

              {/* Input Hora de Consumo (HH:mm) */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Hora de Consumo (HH:mm)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <TextInput 
                    style={[styles.textInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text, flex: 1 }]}
                    placeholder="Ej. 08:30"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    value={intakeTimeInput}
                    onChangeText={setIntakeTimeInput}
                  />
                </View>
                {/* Atajos de hora rápida */}
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Desayuno (08:00)', val: '08:00' },
                    { label: 'Almuerzo (13:00)', val: '13:00' },
                    { label: 'Merienda (17:00)', val: '17:00' },
                    { label: 'Cena (20:00)', val: '20:00' },
                    {
                      label: 'Hora Actual',
                      val: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
                    },
                  ].map((preset) => (
                    <TouchableOpacity
                      key={preset.label}
                      style={{
                        backgroundColor: intakeTimeInput === preset.val ? (isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.15)') : COLORS.bg,
                        borderColor: intakeTimeInput === preset.val ? COLORS.accent : COLORS.border,
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                      }}
                      onPress={() => setIntakeTimeInput(preset.val)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: intakeTimeInput === preset.val ? COLORS.accent : COLORS.textMuted }}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Botón Guardar Alimento */}
              <TouchableOpacity 
                style={[styles.primaryBtn, { marginTop: 10 }]} 
                onPress={() => {
                  setAddIntakeModalVisible(false);
                  handleRegisterIntake();
                }}
              >
                <Text style={styles.primaryBtnText}>Guardar en {mealType.charAt(0) + mealType.slice(1).toLowerCase()}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal Bloqueante de Carga durante Análisis IA de Plato ── */}
      <Modal
        visible={scanningImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: COLORS.card, borderRadius: 20, padding: 28, alignItems: 'center', width: '88%', maxWidth: 360, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: isDark ? 'rgba(167, 139, 250, 0.2)' : 'rgba(109, 40, 217, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="sparkles" size={32} color={COLORS.purple} />
            </View>
            <ActivityIndicator color={COLORS.purple} size="large" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 8 }}>
              Analizando tu plato con IA...
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 }}>
              Reconociendo ingredientes, estimando la porción en gramos y verificando compatibilidad con Diabetes Tipo 2.
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Modal Visor de Fotos en Pantalla Completa ── */}
      <Modal
        visible={!!selectedFoodPhoto}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedFoodPhoto(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => setSelectedFoodPhoto(null)}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {selectedFoodPhoto && (
            <View style={{ width: '100%', maxWidth: 440, alignItems: 'center' }}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${selectedFoodPhoto.image_base64}` }}
                style={{ width: '100%', height: 320, borderRadius: 16, marginBottom: 16, resizeMode: 'cover' }}
              />

              <View style={{ backgroundColor: COLORS.card, borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: COLORS.border }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 }}>
                  {selectedFoodPhoto.food_name}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>
                  Porción: {selectedFoodPhoto.portion_size_g}g • Registrado el {new Date(selectedFoodPhoto.consumed_at || selectedFoodPhoto.created_at || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
                {(selectedFoodPhoto.calories != null || selectedFoodPhoto.carbs_g != null || selectedFoodPhoto.glycemic_index != null || selectedFoodPhoto.glycemic_load != null) && (
                  <Text style={{ fontSize: 12, color: COLORS.accent, fontWeight: '700', marginBottom: 12 }}>
                    {[
                      selectedFoodPhoto.calories != null ? `${selectedFoodPhoto.calories} kcal` : null,
                      selectedFoodPhoto.carbs_g != null ? `${selectedFoodPhoto.carbs_g}g carbohidratos` : null,
                      selectedFoodPhoto.glycemic_index != null ? `IG ${selectedFoodPhoto.glycemic_index}` : null,
                      selectedFoodPhoto.glycemic_load != null ? `CG ${selectedFoodPhoto.glycemic_load}` : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                )}

                {selectedFoodPhoto.doctor_assessment === 'CORRECT' && (
                  <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.accent }}>Aprobado por el médico tratante</Text>
                  </View>
                )}

                {selectedFoodPhoto.doctor_comment && (
                  <View style={{ backgroundColor: COLORS.bg, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.text, marginBottom: 2 }}>Observaciones del Doctor:</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 17 }}>{selectedFoodPhoto.doctor_comment}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Botón Flotante de Chat IA (FAB) para Pacientes ── */}
      {user?.role === 'PACIENTE' && (
        <TouchableOpacity 
          style={styles.fabAiBtn}
          onPress={() => setAiChatModalVisible(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isDark ? ['#8B5CF6', '#059669'] : ['#6D28D9', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="sparkles" size={20} color="#fff" />
            <Text style={styles.fabText}>Consulta IA</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ── Modal Flotante de Asistente IA ── */}
      <Modal
        visible={aiChatModalVisible}
        animationType="slide"
        transparent={true}
        onShow={() => fetchAiSessions()}
        onRequestClose={() => setAiChatModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalContent, { height: '84%', backgroundColor: COLORS.card }]}>
            {/* Header del Modal con Acciones de Historial */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isDark ? 'rgba(167, 139, 250, 0.2)' : 'rgba(109, 40, 217, 0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="sparkles" size={18} color={COLORS.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: COLORS.text, fontSize: 15 }]} numberOfLines={1}>
                    {currentSessionId ? (aiSessions.find(s => s.id === currentSessionId)?.title || 'Consulta IA') : 'Asistente Nutricional IA'}
                  </Text>
                  <Text style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: '600' }}>Diabetes Tipo 2</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {/* Botón "+ Nuevo Chat" */}
                <TouchableOpacity
                  style={{
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(5, 150, 105, 0.1)',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onPress={startNewAiChat}
                >
                  <Ionicons name="add-circle" size={14} color={COLORS.accent} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.accent }}>Nuevo</Text>
                </TouchableOpacity>

                {/* Botón "Historial Chats" */}
                <TouchableOpacity
                  style={{
                    backgroundColor: showSessionDrawer 
                      ? COLORS.purple 
                      : (isDark ? 'rgba(167, 139, 250, 0.15)' : 'rgba(109, 40, 217, 0.1)'),
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onPress={() => {
                    if (!showSessionDrawer) fetchAiSessions();
                    setShowSessionDrawer(!showSessionDrawer);
                  }}
                >
                  <Ionicons name="time" size={14} color={showSessionDrawer ? '#fff' : COLORS.purple} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: showSessionDrawer ? '#fff' : COLORS.purple }}>
                    {showSessionDrawer ? 'Chat' : 'Historial'}
                  </Text>
                </TouchableOpacity>

                {/* Cierre de Modal */}
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setAiChatModalVisible(false)}
                >
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Aviso Médico Disclaimer */}
            <View style={{ backgroundColor: isDark ? 'rgba(217, 119, 6, 0.12)' : 'rgba(217, 119, 6, 0.08)', borderRadius: 10, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.warning} />
              <Text style={{ fontSize: 10, color: COLORS.text, flex: 1, lineHeight: 13 }}>
                Orientación IA para Diabetes Tipo 2. Valida decisiones alimentarias con tu médico.
              </Text>
            </View>

            {/* VISTA A: Cajón de Historial de Conversaciones */}
            {showSessionDrawer ? (
              <View style={{ flex: 1, backgroundColor: COLORS.bg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }}>Conversaciones Guardadas</Text>
                  <TouchableOpacity onPress={startNewAiChat}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.accent }}>+ Iniciar Nueva</Text>
                  </TouchableOpacity>
                </View>

                {sessionsLoading ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator color={COLORS.purple} size="small" />
                  </View>
                ) : aiSessions.length > 0 ? (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {aiSessions.map((session) => (
                      <TouchableOpacity
                        key={session.id}
                        style={{
                          backgroundColor: currentSessionId === session.id 
                            ? (isDark ? 'rgba(167, 139, 250, 0.18)' : 'rgba(109, 40, 217, 0.08)')
                            : COLORS.surface,
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 8,
                          borderWidth: 1,
                          borderColor: currentSessionId === session.id ? COLORS.purple : COLORS.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        onPress={() => loadAiSessionDetail(session.id)}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }} numberOfLines={1}>
                            {session.title}
                          </Text>
                          <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                            {new Date(session.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={() => handleDeleteAiSession(session.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={36} color={COLORS.textMuted} />
                    <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' }}>
                      Aún no tienes conversaciones guardadas.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* VISTA B: Hilo de Conversación Activo */
              <View style={{ flex: 1, flexDirection: 'column' }}>
                <View style={[styles.chatResponseBox, { flex: 1, backgroundColor: COLORS.bg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border }]}>
                  {chatMessages.length > 0 ? (
                    <ScrollView style={styles.chatScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {chatMessages.map((msg, idx) => (
                        <View
                          key={msg.id || idx}
                          style={{
                            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            backgroundColor: msg.sender === 'user' ? COLORS.purple : COLORS.surface,
                            borderColor: msg.sender === 'user' ? COLORS.purple : COLORS.border,
                            borderWidth: 1,
                            borderRadius: 14,
                            borderBottomRightRadius: msg.sender === 'user' ? 2 : 14,
                            borderBottomLeftRadius: msg.sender === 'ai' ? 2 : 14,
                            padding: 12,
                            marginBottom: 10,
                            maxWidth: '88%',
                          }}
                        >
                          {msg.sender === 'ai' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Ionicons name="sparkles" size={12} color={COLORS.purple} />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.purple }}>IA Nutricional</Text>
                            </View>
                          )}
                          <Text style={{ fontSize: 13, color: msg.sender === 'user' ? '#fff' : COLORS.text, lineHeight: 19 }}>
                            {msg.content}
                          </Text>
                        </View>
                      ))}
                      {chatLoading && (
                        <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
                          <ActivityIndicator color={COLORS.purple} size="small" />
                          <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Procesando tu consulta médica...</Text>
                        </View>
                      )}
                    </ScrollView>
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                      <Ionicons name="chatbubbles-outline" size={40} color={COLORS.purple} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 10, textAlign: 'center' }}>
                        ¡Hola {user?.first_name || 'Paciente'}!
                      </Text>
                      <Text style={[styles.chatPlaceholder, { textAlign: 'center', marginTop: 4, color: COLORS.textMuted, fontSize: 12 }]}>
                        Hazme cualquier consulta sobre alimentos permitidos, índice glucémico o porciones para tu Diabetes Tipo 2.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Sugerencias Rápidas (Solo en Chat Limpio) */}
                {chatMessages.length === 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8, maxHeight: 32 }}>
                    {[
                      "¿Puedo comer avena en el desayuno?",
                      "Frutas con bajo índice glucémico",
                      "¿Qué cenar para mantener glucosa estable?",
                      "¿Puedo comer pan integral?"
                    ].map((suggestion, sIdx) => (
                      <TouchableOpacity
                        key={sIdx}
                        style={{
                          backgroundColor: isDark ? 'rgba(167, 139, 250, 0.15)' : 'rgba(109, 40, 217, 0.08)',
                          borderColor: COLORS.border,
                          borderWidth: 1,
                          borderRadius: 16,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          marginRight: 6,
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onPress={() => setChatPrompt(suggestion)}
                      >
                        <Text style={{ fontSize: 11, color: COLORS.purple, fontWeight: '700' }}>{suggestion}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Input de consulta */}
                <View style={[styles.chatInputRow, { marginTop: 8 }]}>
                  <TextInput
                    style={[styles.chatTextInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text, flex: 1 }]}
                    placeholder="Escribe tu consulta nutricional..."
                    placeholderTextColor={COLORS.textMuted}
                    value={chatPrompt}
                    onChangeText={setChatPrompt}
                    onSubmitEditing={handleChatWithAI}
                  />
                  <TouchableOpacity 
                    style={[styles.chatSendBtn, { backgroundColor: COLORS.purple }]} 
                    onPress={handleChatWithAI}
                    disabled={chatLoading}
                  >
                    <Ionicons name="send" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const getStyles = (COLORS: any, isDark: boolean) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },

  // Header Banner
  headerBanner: {
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: { gap: 2 },
  welcomeUser: { fontWeight: '800' },
  roleLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FAB Floating Button
  fabAiBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    zIndex: 999,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
    gap: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Alert Boxes
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B15',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 24,
    marginTop: 16,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  errorText: { color: COLORS.error, fontSize: 13, flex: 1 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2EC4B615',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 24,
    marginTop: 16,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  successText: { color: COLORS.success, fontSize: 13, flex: 1, fontWeight: '500' },

  // Containers
  dashboardContainer: { paddingHorizontal: 24, paddingTop: 16, gap: 16 },
  sectionHeader: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },

  // Cards styling
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  cardSubtitle: { fontSize: 12, color: COLORS.textMuted, marginBottom: 16, lineHeight: 18 },

  // Tab selector (for Patient)
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabButtonActive: { backgroundColor: COLORS.accent },
  tabButtonText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 13 },
  tabButtonTextActive: { color: '#fff' },

  // Inputs
  inputWrapper: { marginBottom: 14 },
  inputLabel: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: isDark ? '#CBD5E1' : '#1E293B', 
    marginBottom: 6, 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 48,
    color: COLORS.text,
    fontSize: 14,
  },
  textArea: { height: 90, textAlignVertical: 'top', paddingTop: 12 },

  // Meal types row selection
  mealTypesRow: { flexDirection: 'row', gap: 6, marginBottom: 16, marginTop: 4, flexWrap: 'wrap' },
  mealTypeBtn: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  mealTypeBtnActive: { 
    borderColor: COLORS.accent, 
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(5, 150, 105, 0.12)',
  },
  mealTypeBtnText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  mealTypeBtnTextActive: { color: COLORS.accent, fontWeight: '800' },

  // Buttons
  primaryBtn: {
    backgroundColor: COLORS.accent,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Doctor Indicator (Requirement 2)
  doctorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
    marginBottom: 4,
  },
  doctorIndicatorActive: {
    backgroundColor: '#00C9A710',
    borderColor: '#00C9A740',
  },
  doctorIndicatorEmpty: {
    backgroundColor: '#FF6B6B10',
    borderColor: '#FF6B6B40',
  },
  doctorIndicatorText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Scan Button (Requirement 1)
  scanBtn: {
    backgroundColor: '#3E5C76',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#4E6C86',
  },
  scanBtnActive: {
    backgroundColor: '#2D3E4E',
    borderColor: '#3D4E5E',
  },
  scanBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Photo Attachment Preview
  imagePreviewContainer: {
    width: '100%',
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Doctor recommendations details in patient
  recContainer: { gap: 10 },
  recSection: { backgroundColor: COLORS.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  recLabel: { fontSize: 12, fontWeight: '700', color: COLORS.accent, marginBottom: 4 },
  recText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },

  // History list
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  historyThumbnail: {
    width: 42,
    height: 42,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  historyThumbnailPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyFoodName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  historyMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  historyTime: { fontSize: 12, color: COLORS.textMuted },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginVertical: 10 },

  fullHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  fullHistoryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // Modal / Sidebar Full History Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 21, 38, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    padding: 24,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 14,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  modalHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  modalThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  modalThumbnailPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalFoodName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalFoodMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalFoodDate: {
    fontSize: 10,
    color: COLORS.accent,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  modalTime: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Chat Asistencia IA
  chatResponseBox: {
    height: 160,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    justifyContent: 'center',
  },
  chatScroll: { flex: 1 },
  chatResponseText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  chatPlaceholder: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  chatInputRow: { flexDirection: 'row', gap: 10 },
  chatTextInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 48,
    color: COLORS.text,
  },
  chatSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Doctor patients list
  patientCardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  patientCardItemActive: {
    borderColor: COLORS.accent,
    borderWidth: 1.5,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
  },
  patientCardName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  patientCardEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Admin select fake lists
  pickerFake: {
    height: 120,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    padding: 6,
  },
  miniList: { flex: 1 },
  miniListItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginBottom: 4 },
  miniListItemActive: { backgroundColor: COLORS.accent },
  miniListItemText: { fontSize: 13, color: COLORS.text },

  // Admin user list items
  userListItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userListItemName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  userListItemEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  userListCaregiver: { fontSize: 11, color: COLORS.accent, marginTop: 2 },
  roleBadge: {
    backgroundColor: '#00C9A720',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00C9A740',
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.text },
  badgeAdmin: { backgroundColor: '#FF6B6B20', borderColor: '#FF6B6B40' },
  badgeDoc: { backgroundColor: '#2EC4B620', borderColor: '#2EC4B640' },

  // Clinical Profile & Onboarding Banner
  onboardingBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
  },
  onboardingBannerGradient: {
    padding: 16,
  },
  onboardingBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onboardingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingTextContainer: {
    flex: 1,
  },
  onboardingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  onboardingSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 15,
  },
  onboardingArrow: {
    alignSelf: 'center',
  },
  
  clinicalSummaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  clinicalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  clinicalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clinicalTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  clinicalEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clinicalEditBtnText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  clinicalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  clinicalGridItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  clinicalLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  clinicalValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },

  // Nuevos Estilos Médicos de Incidencias y Evaluaciones
  assessmentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 4,
  },
  assessmentCorrect: {
    backgroundColor: 'rgba(0, 201, 167, 0.08)',
    borderColor: 'rgba(0, 201, 167, 0.3)',
  },
  assessmentIncorrect: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  assessmentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.text,
  },
  mealFeedbackBox: {
    backgroundColor: COLORS.card,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
    marginLeft: 40,
  },
  mealFeedbackText: {
    fontSize: 11,
    color: COLORS.text,
    lineHeight: 15,
    flex: 1,
  },
  incidentItemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  incidentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  incidentItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  painBadge: {
    backgroundColor: '#FF6B6B20',
    borderColor: '#FF6B6B40',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  painBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6B6B',
  },
  incidentQuestionBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  incidentQuestionText: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 14,
  },
});
