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
import { getAccessToken } from '../../services/authService';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

// ── Palette (Harmonized with Auth Design) ────────────────────────────────────
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
  success: '#2EC4B6',
  border: '#1F3550',
  borderFocus: '#00C9A7',
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000'
);

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  
  // ── States ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'overview' | 'actions'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── 1. Patient States ──
  const [foodName, setFoodName] = useState('');
  const [portion, setPortion] = useState('');
  const [mealType, setMealType] = useState<'DESAYUNO' | 'ALMUERZO' | 'CENA' | 'MERIENDA'>('DESAYUNO');
  const [intakeHistory, setIntakeHistory] = useState<any[]>([]);
  const [aiRules, setAiRules] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [scanningImage, setScanningImage] = useState(false);
  const [foodImageBase64, setFoodImageBase64] = useState<string | null>(null);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [patientProfile, setPatientProfile] = useState<any>(null);
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

  // ── 3. Admin States ──
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [assignPatientId, setAssignPatientId] = useState('');
  const [assignDoctorId, setAssignDoctorId] = useState('');
  const [changeRoleUserId, setChangeRoleUserId] = useState('');
  const [changeRoleNewVal, setChangeRoleNewVal] = useState<'PACIENTE' | 'CUIDADOR' | 'ADMIN'>('CUIDADOR');

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
        }

        // Cargar historial de malestares e incidencias
        const resIncidents = await fetch(`${API_URL}/dashboard/patient/incidents`, { headers });
        if (resIncidents.ok) {
          const data = await resIncidents.json();
          setIncidentsList(data);
        }
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

  // A. Paciente: Guardar Perfil Clínico
  const handleSavePatientProfile = async () => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      };

      const payload = {
        date_of_birth: profileForm.date_of_birth ? profileForm.date_of_birth.trim() : null,
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
      
      // 3. Rellenar campos automáticamente
      setFoodName(parsedResult.food_name);
      setPortion(String(parsedResult.portion_size_g));
      setFoodImageBase64(base64Data);
      
      const validTypes = ['DESAYUNO', 'ALMUERZO', 'CENA', 'MERIENDA'];
      if (validTypes.includes(parsedResult.meal_type)) {
        setMealType(parsedResult.meal_type as any);
      }

      setSuccessMsg('La IA ha reconocido tu plato y rellenado los datos exitosamente.');
    } catch (err: any) {
      setError(err.message ?? 'Error al escanear plato.');
    } finally {
      setScanningImage(false);
    }
  };

  // A. Paciente: Registrar Comida
  const handleRegisterIntake = async () => {
    setError('');
    setSuccessMsg('');
    if (!foodName.trim()) { setError('Ingresa el nombre del alimento'); return; }
    if (!portion || isNaN(Number(portion))) { setError('Ingresa una porción válida en gramos'); return; }

    setLoading(true);
    try {
      const token = await getAccessToken();
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
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail ?? 'Error al registrar comida');
      }

      setFoodName('');
      setPortion('');
      setFoodImageBase64(null);
      setSuccessMsg('Comida registrada exitosamente.');
      loadRoleData();
    } catch (err: any) {
      setError(err.message ?? 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // B. Paciente: Chatear con IA
  const handleChatWithAI = async () => {
    if (!chatPrompt.trim()) return;
    setChatLoading(true);
    setChatResponse('');
    setError('');
    try {
      const token = await getAccessToken();
      // Incluir instrucciones del doctor si las hay para mayor coherencia
      const enrichedPrompt = aiRules 
        ? `[INSTRUCCIONES DE MI NUTRICIONISTA/DOCTOR]: "${aiRules}". Teniendo en cuenta esta regla médica, por favor responde a la siguiente consulta del paciente: ${chatPrompt}` 
        : chatPrompt;

      const res = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: enrichedPrompt }),
      });

      if (!res.ok) {
        throw new Error('El servicio de IA no está disponible temporalmente.');
      }

      const data = await res.json();
      setChatResponse(data.response);
      setChatPrompt('');
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
    setLoadingPatientIntakes(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/dashboard/doctor/patient/${pat.id}/intakes`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });
      if (res.ok) {
        const intakesData = await res.json();
        setSelectedPatientIntakes(intakesData);
      }
    } catch (err) {
      console.log('Error al cargar historial del paciente:', err);
    } finally {
      setLoadingPatientIntakes(false);
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

      {/* Selector de sub-sección */}
      <View style={styles.tabSelector}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'overview' && styles.tabButtonActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'overview' && styles.tabButtonTextActive]}>Mi Control</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'actions' && styles.tabButtonActive]}
          onPress={() => setActiveTab('actions')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'actions' && styles.tabButtonTextActive]}>Consulta IA</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'overview' ? (
        <>
          {/* Formulario de registro de comida */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="restaurant" size={18} color={COLORS.accent} />
              <Text style={styles.cardTitle}>Registrar Ingesta de Alimentos</Text>
            </View>

            {/* Botón de Escaneo de Plato con IA (Requirement 1) */}
            <TouchableOpacity 
              style={[styles.scanBtn, scanningImage && styles.scanBtnActive]} 
              onPress={handleScanPlate}
              disabled={scanningImage}
            >
              {scanningImage ? (
                <View style={styles.scanBtnRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.scanBtnText}>Analizando tu plato con IA...</Text>
                </View>
              ) : (
                <View style={styles.scanBtnRow}>
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.scanBtnText}>Escanear Plato con Foto (IA)</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Vista previa de la foto adjunta */}
            {foodImageBase64 ? (
              <View style={styles.imagePreviewContainer}>
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
            ) : null}
            
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>¿Qué comiste?</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Ej. Manzana, Pollo a la plancha, Avena"
                placeholderTextColor={COLORS.textMuted}
                value={foodName}
                onChangeText={setFoodName}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Porción aproximada (Gramos)</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="Ej. 150"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={portion}
                onChangeText={setPortion}
              />
            </View>

            <Text style={styles.inputLabel}>Tipo de Comida</Text>
            <View style={styles.mealTypesRow}>
              {(['DESAYUNO', 'ALMUERZO', 'CENA', 'MERIENDA'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.mealTypeBtn, mealType === t && styles.mealTypeBtnActive]}
                  onPress={() => setMealType(t)}
                >
                  <Text style={[styles.mealTypeBtnText, mealType === t && styles.mealTypeBtnTextActive]}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleRegisterIntake}>
              <Text style={styles.primaryBtnText}>Registrar Alimento</Text>
            </TouchableOpacity>
          </View>

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
                          </Text>
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
        </>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="sparkles" size={18} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Asistente Virtual Inteligente</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Consúltame sobre alimentos recomendados, índice glucémico de recetas o dudas nutricionales.
          </Text>

          {/* Caja de Respuesta */}
          <View style={styles.chatResponseBox}>
            {chatLoading ? (
              <ActivityIndicator color={COLORS.accent} size="large" />
            ) : chatResponse ? (
              <ScrollView style={styles.chatScroll} nestedScrollEnabled>
                <Text style={styles.chatResponseText}>{chatResponse}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.chatPlaceholder}>Escribe tu duda nutricional abajo para comenzar.</Text>
            )}
          </View>

          {/* Input de consulta */}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatTextInput}
              placeholder="Ej. ¿Puedo desayunar pan integral con palta?"
              placeholderTextColor={COLORS.textMuted}
              value={chatPrompt}
              onChangeText={setChatPrompt}
              onSubmitEditing={handleChatWithAI}
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={handleChatWithAI}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

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
                        </Text>
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
    </View>
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
          <View style={[styles.clinicalSummaryCard, { borderColor: '#E29578', borderWidth: 1.5, backgroundColor: COLORS.surface }]}>
            <View style={styles.clinicalHeader}>
              <View style={styles.clinicalHeaderLeft}>
                <Ionicons name="medical" size={16} color="#E29578" />
                <Text style={[styles.clinicalTitle, { color: '#E29578' }]}>Historial y Ficha Clínica: {selectedPatient.first_name} {selectedPatient.last_name}</Text>
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

          {/* Malestares e Incidencias del Paciente (Doctor View) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="warning" size={18} color="#FF6B6B" />
              <Text style={styles.cardTitle}>Alertas de Malestar e Incidencias</Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Revisa los dolores, síntomas o consultas reportadas por {selectedPatient.first_name}. Puedes responder con consejos directos.
            </Text>

            {doctorIncidents.filter(inc => inc.patient_id === selectedPatient?.id).length > 0 ? (
              <ScrollView style={{ maxHeight: 220, marginTop: 10 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {doctorIncidents.filter(inc => inc.patient_id === selectedPatient?.id).map((inc, index) => (
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
                          </Text>
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
                            Evaluación: {item.doctor_assessment === 'CORRECTA' ? 'Correcta ✅' : 'Evitar ❌'}
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
  const renderAdminDashboard = () => {
    const patients = allUsersList.filter(u => u.role === 'PACIENTE');
    const doctors = allUsersList.filter(u => u.role === 'CUIDADOR');

    return (
      <View style={styles.dashboardContainer}>
        <Text style={styles.sectionHeader}>Panel de Administración GDD-T2</Text>

        {/* 1. Asignar Paciente a Doctor */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="link" size={18} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Asignar Paciente a Doctor</Text>
          </View>

          <Text style={styles.inputLabel}>Seleccionar Paciente</Text>
          <View style={styles.pickerFake}>
            <ScrollView style={styles.miniList} nestedScrollEnabled>
              {patients.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.miniListItem, assignPatientId === p.id && styles.miniListItemActive]}
                  onPress={() => setAssignPatientId(p.id)}
                >
                  <Text style={styles.miniListItemText}>{p.first_name} {p.last_name} ({p.email})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.inputLabel}>Seleccionar Doctor/Cuidador</Text>
          <View style={styles.pickerFake}>
            <ScrollView style={styles.miniList} nestedScrollEnabled>
              {doctors.map(d => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.miniListItem, assignDoctorId === d.id && styles.miniListItemActive]}
                  onPress={() => setAssignDoctorId(d.id)}
                >
                  <Text style={styles.miniListItemText}>Dr. {d.first_name} {d.last_name} ({d.email})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAssignPatient}>
            <Text style={styles.primaryBtnText}>Asignar Relación</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Cambiar Rol de Usuario */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="swap-horizontal" size={18} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Cambiar Rol de Usuario</Text>
          </View>

          <Text style={styles.inputLabel}>Selecciona el Usuario</Text>
          <View style={styles.pickerFake}>
            <ScrollView style={styles.miniList} nestedScrollEnabled>
              {allUsersList.map(u => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.miniListItem, changeRoleUserId === u.id && styles.miniListItemActive]}
                  onPress={() => setChangeRoleUserId(u.id)}
                >
                  <Text style={styles.miniListItemText}>
                    [{u.role}] {u.first_name} {u.last_name} ({u.email})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.inputLabel}>Nuevo Rol</Text>
          <View style={styles.mealTypesRow}>
            {(['PACIENTE', 'CUIDADOR', 'ADMIN'] as const).map(role => (
              <TouchableOpacity
                key={role}
                style={[styles.mealTypeBtn, changeRoleNewVal === role && styles.mealTypeBtnActive]}
                onPress={() => setChangeRoleNewVal(role)}
              >
                <Text style={[styles.mealTypeBtnText, changeRoleNewVal === role && styles.mealTypeBtnTextActive]}>
                  {role === 'CUIDADOR' ? 'Doctor' : role.charAt(0) + role.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: COLORS.success }]} onPress={handleChangeRole}>
            <Text style={styles.primaryBtnText}>Actualizar Rol</Text>
          </TouchableOpacity>
        </View>

        {/* 3. Lista de Todos los Usuarios */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={18} color={COLORS.accent} />
            <Text style={styles.cardTitle}>Listado de Cuentas registradas</Text>
          </View>
          {allUsersList.map(u => (
            <View key={u.id} style={styles.userListItemCard}>
              <View>
                <Text style={styles.userListItemName}>{u.first_name} {u.last_name}</Text>
                <Text style={styles.userListItemEmail}>{u.email}</Text>
                {u.caregiver_name ? (
                  <Text style={styles.userListCaregiver}>Asignado a: {u.caregiver_name}</Text>
                ) : null}
              </View>
              <View style={[styles.roleBadge, u.role === 'ADMIN' ? styles.badgeAdmin : u.role === 'CUIDADOR' ? styles.badgeDoc : {}]}>
                <Text style={styles.roleBadgeText}>
                  {u.role === 'CUIDADOR' ? 'DOCTOR' : u.role}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Banner Principal de Bienvenida */}
      <LinearGradient colors={[COLORS.accent, COLORS.accentDark]} style={styles.headerBanner}>
        <View style={styles.headerInfo}>
          <Text style={styles.welcomeUser}>¡Hola, {user?.first_name || 'Usuario'}!</Text>
          <Text style={styles.roleLabel}>
            Rol: {user?.role === 'CUIDADOR' ? 'DOCTOR' : user?.role}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out" size={20} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Alertas de error/éxito */}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

              {/* Fecha de Nacimiento */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Fecha de Nacimiento (AAAA-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: 1985-11-20"
                  placeholderTextColor={COLORS.textMuted}
                  value={profileForm.date_of_birth}
                  onChangeText={(text) => setProfileForm({ ...profileForm, date_of_birth: text })}
                />
              </View>

              {/* Género */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Género</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: Masculino, Femenino, Otro"
                  placeholderTextColor={COLORS.textMuted}
                  value={profileForm.gender}
                  onChangeText={(text) => setProfileForm({ ...profileForm, gender: text })}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Peso */}
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Peso Actual (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ej: 78.5"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    value={profileForm.weight_kg}
                    onChangeText={(text) => setProfileForm({ ...profileForm, weight_kg: text })}
                  />
                </View>

                {/* Estatura */}
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Estatura (cm)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ej: 172"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    value={profileForm.height_cm}
                    onChangeText={(text) => setProfileForm({ ...profileForm, height_cm: text })}
                  />
                </View>
              </View>

              {/* Tipo de Diabetes */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Tipo de Diabetes</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: Tipo 2, Tipo 1, Pre-diabetes"
                  placeholderTextColor={COLORS.textMuted}
                  value={profileForm.diabetes_type}
                  onChangeText={(text) => setProfileForm({ ...profileForm, diabetes_type: text })}
                />
              </View>

              {/* Año de Diagnóstico */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Año del Diagnóstico</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: 2018"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={profileForm.diagnosis_year}
                  onChangeText={(text) => setProfileForm({ ...profileForm, diagnosis_year: text })}
                />
              </View>

              {/* Último HbA1c */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Última Glicosilada (HbA1c %)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: 6.8"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={profileForm.last_hba1c}
                  onChangeText={(text) => setProfileForm({ ...profileForm, last_hba1c: text })}
                />
              </View>

              {/* Medicación */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Medicamentos habituales</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Ej: Metformina 850mg (mañana y noche), Insulina 12 UI antes de acostarse"
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  value={profileForm.medications}
                  onChangeText={(text) => setProfileForm({ ...profileForm, medications: text })}
                />
              </View>

              {/* Alergias / Intolerancias */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Alergias o Restricciones alimenticias</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: Intolerancia al gluten, alergia al pescado, ninguna"
                  placeholderTextColor={COLORS.textMuted}
                  value={profileForm.allergies}
                  onChangeText={(text) => setProfileForm({ ...profileForm, allergies: text })}
                />
              </View>

              {/* Nivel de Actividad */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nivel de Actividad Física habitual</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej: Sedentario, Poco Activo, Activo, Muy Activo"
                  placeholderTextColor={COLORS.textMuted}
                  value={profileForm.activity_level}
                  onChangeText={(text) => setProfileForm({ ...profileForm, activity_level: text })}
                />
              </View>

              {/* Historial Médico General / Notas */}
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Otras Comorbilidades / Historial</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Ej: Hipertensión arterial en tratamiento con losartán, dislipidemia..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },

  // Header Banner
  headerBanner: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
  },
  headerInfo: { gap: 4 },
  welcomeUser: { fontSize: 22, fontWeight: '800', color: '#fff' },
  roleLabel: { fontSize: 12, color: COLORS.accentLight, fontWeight: '700', letterSpacing: 1 },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6, textTransform: 'uppercase' },
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
  mealTypeBtnActive: { borderColor: COLORS.accent, backgroundColor: '#1E3655' },
  mealTypeBtnText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  mealTypeBtnTextActive: { color: COLORS.accent },

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
  patientCardItemActive: { borderColor: COLORS.accent, backgroundColor: '#1E3655' },
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
