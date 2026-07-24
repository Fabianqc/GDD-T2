export type ReportPeriodPreset = '7' | '30' | '90' | 'custom';

export interface ReportPeriodInfo {
  period: ReportPeriodPreset | string;
  from_date: string;
  to_date: string;
  days: number;
  label: string;
}

export interface GlycemicMetrics {
  readings_count: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  std_dev: number | null;
  cv_percent: number | null;
  time_in_range_pct: number | null;
  hypo_pct: number | null;
  hyper_pct: number | null;
  target_range: { min: number; max: number };
  source_note?: string;
}

export interface NutritionMetrics {
  intake_count: number;
  days_with_logs: number;
  total_calories: number | null;
  total_carbs_g: number | null;
  avg_daily_calories: number | null;
  avg_daily_carbs_g: number | null;
  weighted_glycemic_index: number | null;
  avg_glycemic_load: number | null;
}

export interface CalorieBalanceMetrics {
  available: boolean;
  bmr: number | null;
  tdee: number | null;
  activity_factor: number | null;
  confidence: 'full' | 'partial' | string;
  missing_fields: string[];
  method?: string;
  avg_daily_intake: number | null;
  balance_kcal: number | null;
  interpretation: string;
}

export interface GlucoseSeriesPoint {
  id: string;
  glucose_level: number;
  context: string;
  recorded_at: string | null;
  date: string | null;
}

export interface DailyNutritionPoint {
  date: string;
  total_calories: number;
  total_carbs_g: number;
  weighted_gi: number | null;
  avg_glycemic_load: number | null;
  intake_count: number;
}

export interface ClinicalReport {
  patient_id: string;
  patient_name: string;
  doctor_name: string;
  generated_at: string;
  period: ReportPeriodInfo;
  profile: Record<string, unknown>;
  metrics: {
    glycemic: GlycemicMetrics;
    nutrition: NutritionMetrics;
    calorie_balance: CalorieBalanceMetrics;
  };
  glucose_series: GlucoseSeriesPoint[];
  daily_nutrition: DailyNutritionPoint[];
  intakes: Array<Record<string, unknown>>;
  anthropometric_logs: Array<Record<string, unknown>>;
  medication_logs: Array<Record<string, unknown>>;
  physical_activity_logs: Array<Record<string, unknown>>;
  notes: string[];
}
