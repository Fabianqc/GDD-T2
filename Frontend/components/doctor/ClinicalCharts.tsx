import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Rect, Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import type { DailyNutritionPoint, GlucoseSeriesPoint } from '../../types/clinicalReport';

type ChartColors = {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  seriesPrimary: string;
  seriesSecondary: string;
  seriesWarn: string;
  referenceBand: string;
  text: string;
  textMuted: string;
};

interface GlucoseChartProps {
  data: GlucoseSeriesPoint[];
  colors: ChartColors;
  width?: number;
  height?: number;
  targetMin?: number;
  targetMax?: number;
}

export function GlucoseTrendChart({
  data,
  colors,
  width = 320,
  height = 180,
  targetMin = 70,
  targetMax = 180,
}: GlucoseChartProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const points = useMemo(() => {
    if (!data.length) return [];
    const values = data.map((d) => d.glucose_level);
    const minY = Math.min(targetMin - 20, ...values, 40);
    const maxY = Math.max(targetMax + 20, ...values, 220);
    return data.map((d, i) => {
      const x = pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = pad.top + ((maxY - d.glucose_level) / (maxY - minY || 1)) * innerH;
      return { ...d, x, y, minY, maxY };
    });
  }, [data, innerH, innerW, targetMax, targetMin]);

  if (!data.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Sin mediciones de glucemia en el período.</Text>
      </View>
    );
  }

  const minY = points[0].minY;
  const maxY = points[0].maxY;
  const yScale = (v: number) => pad.top + ((maxY - v) / (maxY - minY || 1)) * innerH;
  const bandTop = yScale(targetMax);
  const bandBottom = yScale(targetMin);
  const poly = points.map((p) => `${p.x},${p.y}`).join(' ');
  const sel = selected != null ? points[selected] : null;

  return (
    <View>
      <Svg width={width} height={height}>
        <Rect
          x={pad.left}
          y={bandTop}
          width={innerW}
          height={Math.max(2, bandBottom - bandTop)}
          fill={colors.referenceBand}
        />
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * t;
          const val = Math.round(maxY - t * (maxY - minY));
          return (
            <React.Fragment key={`g-${t}`}>
              <Line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke={colors.grid} strokeWidth={1} />
              <SvgText x={4} y={y + 3} fill={colors.axis} fontSize="9">{val}</SvgText>
            </React.Fragment>
          );
        })}
        <Polyline points={poly} fill="none" stroke={colors.seriesPrimary} strokeWidth={2.5} />
        {points.map((p, idx) => (
          <Circle
            key={p.id || idx}
            cx={p.x}
            cy={p.y}
            r={selected === idx ? 6 : 4}
            fill={
              p.glucose_level < targetMin
                ? colors.seriesWarn
                : p.glucose_level > targetMax
                  ? '#EF4444'
                  : colors.seriesPrimary
            }
            onPress={() => setSelected(idx)}
          />
        ))}
      </Svg>
      {sel && (
        <View
          style={{
            marginTop: 6,
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            borderRadius: 10,
            padding: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>
            {sel.glucose_level} mg/dL · {sel.context}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            {(sel.recorded_at || '').replace('T', ' ').slice(0, 16)}
          </Text>
        </View>
      )}
      {!sel && (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
          Toca un punto para ver detalle. Banda verde: 70–180 mg/dL.
        </Text>
      )}
    </View>
  );
}

interface CalorieChartProps {
  data: DailyNutritionPoint[];
  tdee: number | null;
  colors: ChartColors;
  width?: number;
  height?: number;
}

export function CalorieBalanceChart({
  data,
  tdee,
  colors,
  width = 320,
  height = 180,
}: CalorieChartProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const pad = { top: 16, right: 12, bottom: 34, left: 36 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const series = useMemo(() => data.filter((d) => d.intake_count > 0).slice(-14), [data]);
  const maxVal = Math.max(tdee || 0, ...series.map((d) => d.total_calories), 1);

  if (!series.length) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Sin comidas con calorías en el período.</Text>
      </View>
    );
  }

  const barW = Math.max(8, innerW / series.length - 6);
  const sel = selected != null ? series[selected] : null;

  return (
    <View>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((t) => {
          const y = pad.top + innerH * (1 - t);
          const val = Math.round(maxVal * t);
          return (
            <React.Fragment key={`c-${t}`}>
              <Line x1={pad.left} y1={y} x2={pad.left + innerW} y2={y} stroke={colors.grid} strokeWidth={1} />
              <SvgText x={4} y={y + 3} fill={colors.axis} fontSize="9">{val}</SvgText>
            </React.Fragment>
          );
        })}
        {tdee != null && (
          <Line
            x1={pad.left}
            y1={pad.top + ((maxVal - tdee) / maxVal) * innerH}
            x2={pad.left + innerW}
            y2={pad.top + ((maxVal - tdee) / maxVal) * innerH}
            stroke={colors.seriesWarn}
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}
        {series.map((d, idx) => {
          const h = (d.total_calories / maxVal) * innerH;
          const x = pad.left + idx * (innerW / series.length) + 3;
          const y = pad.top + innerH - h;
          const over = tdee != null && d.total_calories > tdee;
          return (
            <Pressable key={d.date} onPress={() => setSelected(idx)}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, h)}
                rx={3}
                fill={over ? colors.seriesWarn : colors.seriesSecondary}
                onPress={() => setSelected(idx)}
              />
            </Pressable>
          );
        })}
      </Svg>
      {sel && (
        <View
          style={{
            marginTop: 6,
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            borderRadius: 10,
            padding: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12 }}>
            {sel.date}: {Math.round(sel.total_calories)} kcal · {sel.total_carbs_g}g CH
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
            {tdee != null
              ? `Objetivo estimado ${Math.round(tdee)} kcal · balance ${Math.round(sel.total_calories - tdee)}`
              : 'Sin TDEE estimado (faltan datos de perfil)'}
          </Text>
        </View>
      )}
      {!sel && (
        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
          Barras = calorías del día. Línea punteada = TDEE estimado.
        </Text>
      )}
    </View>
  );
}
