import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ClinicalColors, ChartColors } from '../../constants/theme';
import type { ClinicalReport, ReportPeriodPreset } from '../../types/clinicalReport';
import {
  downloadClinicalReport,
  fetchClinicalReport,
  shareOrSaveReportFile,
} from '../../services/clinicalReportService';
import { CalorieBalanceChart, GlucoseTrendChart } from './ClinicalCharts';

type ThemeMode = 'light' | 'dark';

interface Props {
  patientId: string;
  patientName: string;
  theme: ThemeMode;
}

function MetricCard({
  label,
  value,
  hint,
  color,
  bg,
  border,
}: {
  label: string;
  value: string;
  hint?: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <View style={{
      flexGrow: 1,
      minWidth: '45%',
      backgroundColor: bg,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: border,
    }}>
      <Text style={{ fontSize: 10, color: color, fontWeight: '700', marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color }}>{value}</Text>
      {!!hint && <Text style={{ fontSize: 10, color, opacity: 0.75, marginTop: 2 }}>{hint}</Text>}
    </View>
  );
}

export default function DoctorClinicalReports({ patientId, patientName, theme }: Props) {
  const palette = Colors[theme];
  const clinical = ClinicalColors[theme];
  const chart = ChartColors[theme];
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - 64, 360);

  const [period, setPeriod] = useState<ReportPeriodPreset>('30');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [report, setReport] = useState<ClinicalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState('');

  const chartColors = useMemo(() => ({
    grid: chart.grid,
    axis: chart.axis,
    tooltipBg: chart.tooltipBg,
    tooltipBorder: chart.tooltipBorder,
    seriesPrimary: chart.seriesPrimary,
    seriesSecondary: chart.seriesSecondary,
    seriesWarn: chart.seriesWarn,
    referenceBand: chart.referenceBand,
    text: palette.text,
    textMuted: palette.subtext,
  }), [chart, palette]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchClinicalReport(patientId, {
        period,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setReport(data);
    } catch (e: any) {
      setReport(null);
      setError(e?.message || 'No se pudo cargar el reporte clínico.');
    } finally {
      setLoading(false);
    }
  }, [patientId, period, fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExporting(format);
    setError('');
    try {
      const file = await downloadClinicalReport(
        patientId,
        { period, from_date: fromDate || undefined, to_date: toDate || undefined },
        format,
      );
      await shareOrSaveReportFile(file.blob, file.filename, file.mime);
    } catch (e: any) {
      setError(e?.message || 'No se pudo exportar el reporte.');
    } finally {
      setExporting(null);
    }
  };

  const g = report?.metrics.glycemic;
  const n = report?.metrics.nutrition;
  const c = report?.metrics.calorie_balance;

  return (
    <View style={{
      backgroundColor: palette.cardBackground,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: clinical.cardAccent,
      padding: 14,
      marginBottom: 14,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Ionicons name="stats-chart" size={20} color={clinical.cardAccent} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: palette.text }}>
            Reportes Clínicos e Indicadores
          </Text>
          <Text style={{ fontSize: 11, color: palette.subtext }}>
            RF-06 · {patientName} · gráficos y exportación
          </Text>
        </View>
      </View>

      {/* Period selector */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {([
          { key: '7', label: '7 días' },
          { key: '30', label: '30 días' },
          { key: '90', label: '90 días' },
          { key: 'custom', label: 'Personalizado' },
        ] as const).map((opt) => {
          const active = period === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setPeriod(opt.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: active ? palette.primary : palette.cardBorder,
                backgroundColor: active ? (theme === 'dark' ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.1)') : palette.background,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? palette.primary : palette.subtext }}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {period === 'custom' && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: palette.subtext, fontWeight: '700', marginBottom: 4 }}>Desde</Text>
            {Platform.OS === 'web' ? (
              // @ts-ignore web date input
              <input
                type="date"
                value={fromDate}
                onChange={(e: any) => setFromDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${palette.cardBorder}`,
                  background: palette.inputBg,
                  color: palette.text,
                }}
              />
            ) : (
              <TextInput
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.subtext}
                style={{
                  borderWidth: 1,
                  borderColor: palette.cardBorder,
                  backgroundColor: palette.inputBg,
                  color: palette.text,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, color: palette.subtext, fontWeight: '700', marginBottom: 4 }}>Hasta</Text>
            {Platform.OS === 'web' ? (
              // @ts-ignore web date input
              <input
                type="date"
                value={toDate}
                onChange={(e: any) => setToDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${palette.cardBorder}`,
                  background: palette.inputBg,
                  color: palette.text,
                }}
              />
            ) : (
              <TextInput
                value={toDate}
                onChangeText={setToDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.subtext}
                style={{
                  borderWidth: 1,
                  borderColor: palette.cardBorder,
                  backgroundColor: palette.inputBg,
                  color: palette.text,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
            )}
          </View>
          <TouchableOpacity
            onPress={loadReport}
            style={{
              alignSelf: 'flex-end',
              backgroundColor: palette.primary,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Export toolbar */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => handleExport('pdf')}
          disabled={!!exporting || loading}
          style={{
            flex: 1,
            backgroundColor: clinical.cardAccent,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: 'center',
            opacity: exporting ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {exporting === 'pdf' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="document-text" size={16} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Exportar PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleExport('csv')}
          disabled={!!exporting || loading}
          style={{
            flex: 1,
            backgroundColor: palette.purpleAccent,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: 'center',
            opacity: exporting ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {exporting === 'csv' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="download" size={16} color="#fff" />
          )}
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Exportar CSV</Text>
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={{
          backgroundColor: theme === 'dark' ? 'rgba(248,113,113,0.12)' : 'rgba(220,38,38,0.08)',
          borderColor: clinical.incident,
          borderWidth: 1,
          borderRadius: 10,
          padding: 10,
          marginBottom: 10,
        }}>
          <Text style={{ color: clinical.incident, fontSize: 12, fontWeight: '600' }}>{error}</Text>
        </View>
      )}

      {loading && (
        <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
      )}

      {!loading && report && (
        <>
          <Text style={{ fontSize: 11, color: palette.subtext, marginBottom: 10 }}>
            {report.period.label}: {report.period.from_date} → {report.period.to_date}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <MetricCard
              label="PROMEDIO GLUCEMIA"
              value={g?.mean != null ? `${g.mean}` : '—'}
              hint={g?.mean != null ? 'mg/dL' : 'Sin datos'}
              color={palette.text}
              bg={palette.background}
              border={palette.cardBorder}
            />
            <MetricCard
              label="CV / EN RANGO"
              value={g?.cv_percent != null ? `${g.cv_percent}%` : '—'}
              hint={g?.time_in_range_pct != null ? `TIR ${g.time_in_range_pct}%` : undefined}
              color={clinical.glucoseNormal}
              bg={palette.background}
              border={palette.cardBorder}
            />
            <MetricCard
              label="HIPO / ALTA"
              value={`${g?.hypo_pct ?? '—'}% / ${g?.hyper_pct ?? '—'}%`}
              hint={`${g?.readings_count ?? 0} lecturas capilares`}
              color={clinical.glucoseHigh}
              bg={palette.background}
              border={palette.cardBorder}
            />
            <MetricCard
              label="BALANCE KCAL"
              value={c?.balance_kcal != null ? `${Math.round(c.balance_kcal)}` : '—'}
              hint={c?.interpretation || 'Estimación parcial'}
              color={clinical.glucoseElevated}
              bg={palette.background}
              border={palette.cardBorder}
            />
          </View>

          <View style={{
            backgroundColor: palette.background,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            padding: 10,
            marginBottom: 10,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text, marginBottom: 6 }}>
              Variabilidad glucémica
            </Text>
            <GlucoseTrendChart
              data={report.glucose_series}
              colors={chartColors}
              width={chartWidth}
              targetMin={g?.target_range?.min ?? 70}
              targetMax={g?.target_range?.max ?? 180}
            />
            <Text style={{ fontSize: 10, color: palette.subtext, marginTop: 6 }}>
              {g?.source_note || 'Mediciones capilares puntuales (no CGM).'}
            </Text>
          </View>

          <View style={{
            backgroundColor: palette.background,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.cardBorder,
            padding: 10,
            marginBottom: 10,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: palette.text, marginBottom: 6 }}>
              Balance calórico diario
            </Text>
            <CalorieBalanceChart
              data={report.daily_nutrition}
              tdee={c?.tdee ?? null}
              colors={chartColors}
              width={chartWidth}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: palette.subtext }}>
                Ingesta media: {n?.avg_daily_calories != null ? `${Math.round(n.avg_daily_calories)} kcal` : '—'}
              </Text>
              <Text style={{ fontSize: 11, color: palette.subtext }}>
                TDEE: {c?.tdee != null ? `${Math.round(c.tdee)} kcal` : '—'}
              </Text>
              <Text style={{ fontSize: 11, color: palette.subtext }}>
                CH: {n?.total_carbs_g != null ? `${n.total_carbs_g} g` : '—'}
              </Text>
              <Text style={{ fontSize: 11, color: palette.subtext }}>
                IG pond.: {n?.weighted_glycemic_index ?? '—'} · CG: {n?.avg_glycemic_load ?? '—'}
              </Text>
            </View>
          </View>

          {!!report.notes?.length && (
            <View style={{ gap: 4 }}>
              {report.notes.map((note) => (
                <Text key={note} style={{ fontSize: 10, color: palette.subtext }}>
                  • {note}
                </Text>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}
