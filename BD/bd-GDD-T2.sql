-- ==========================================
-- 1. CREACIÓN DE TIPOS ENUMERADOS (ENUMS)
-- ==========================================

CREATE TYPE user_role AS ENUM ('PACIENTE', 'CUIDADOR', 'ADMIN');
CREATE TYPE glycemic_context AS ENUM ('AYUNAS', 'ANTES_COMIDA', 'DESPUES_COMIDA', 'MADRUGADA');
CREATE TYPE meal_type AS ENUM ('DESAYUNO', 'ALMUERZO', 'CENA', 'MERIENDA');
CREATE TYPE alert_type AS ENUM ('ALTO_RIESGO', 'BAJA_ADHERENCIA', 'RECORDATORIO');

-- ==========================================
-- 2. TABLAS INDEPENDIENTES (Catálogos y Usuarios base)
-- ==========================================

-- Tabla base de usuarios para la autenticación y control de roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'PACIENTE',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Catálogo de alimentos para el Motor de IA
CREATE TABLE foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    glycemic_index DECIMAL(5,2) NOT NULL,
    glycemic_load DECIMAL(5,2) NOT NULL,
    calories_per_100g DECIMAL(5,2) NOT NULL,
    carbs_per_100g DECIMAL(5,2) NOT NULL
);

-- ==========================================
-- 3. TABLAS DEPENDIENTES NIVEL 1
-- ==========================================

-- Perfil extendido exclusivo para los pacientes
CREATE TABLE patient_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    caregiver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    date_of_birth DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. TABLAS DEPENDIENTES NIVEL 2 (Registros ligados al paciente)
-- ==========================================

-- Módulo: Datos Antropométricos (Para cálculo de IMC y déficit calórico)
CREATE TABLE anthropometric_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patient_profiles(user_id) ON DELETE CASCADE,
    weight_kg DECIMAL(5,2) NOT NULL,
    height_cm DECIMAL(5,2) NOT NULL,
    bmi DECIMAL(5,2), 
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Módulo: Registro Integral - Glucemia
CREATE TABLE glucose_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patient_profiles(user_id) ON DELETE CASCADE,
    glucose_level DECIMAL(5,2) NOT NULL, 
    context glycemic_context NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Módulo: Registro Integral - Medicación
CREATE TABLE medication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patient_profiles(user_id) ON DELETE CASCADE,
    medication_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Módulo: Registro Integral - Actividad Física
CREATE TABLE physical_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patient_profiles(user_id) ON DELETE CASCADE,
    activity_type VARCHAR(150) NOT NULL,
    duration_minutes INT NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Módulo: Registro Integral - Ingesta de Alimentos (Relaciona paciente y alimento)
CREATE TABLE intake_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patient_profiles(user_id) ON DELETE CASCADE,
    food_id UUID REFERENCES foods(id) ON DELETE RESTRICT,
    meal_type meal_type NOT NULL,
    portion_size_g DECIMAL(6,2) NOT NULL,
    consumed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Módulo: Alertas y Feedback Predictivo
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patient_profiles(user_id) ON DELETE CASCADE,
    type alert_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);