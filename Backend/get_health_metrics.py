"""
Script de Auditoría y Consulta de Indicadores de Salud (Fase 03: Postgame)
Calcula métricas clínicas internacionales según estándares de la American Diabetes Association (ADA):
- Tiempo en Rango (TIR: 70 - 180 mg/dL)
- Coeficiente de Variabilidad Glucémica (CV = SD / Media * 100)
- Tiempo por Debajo del Rango (TBR / Hipoglucemia < 70 mg/dL)
- Tiempo por Encima del Rango (TAR / Hiperglucemia > 180 mg/dL)
- Promedio y Desviación Estándar (SD)
"""

import sys
import os

# Asegurar path de Backend para imports directos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
from report_service import compute_glycemic_metrics, GLUCOSE_LOW, GLUCOSE_HIGH


def print_metrics_summary(title: str, metrics: dict):
    print("=" * 65)
    print(f"  {title.upper()}")
    print("=" * 65)
    print(f"• Total lecturas evaluadas:           {metrics['readings_count']}")
    print(f"• Glucemia Media:                     {metrics['mean']} mg/dL")
    print(f"• Desviación Estándar (SD):           {metrics['std_dev']} mg/dL")
    print("-" * 65)
    
    cv = metrics.get('cv_percent')
    cv_status = "OPTIMO (<= 36%)" if (cv is not None and cv <= 36.0) else "ALTA VARIABILIDAD (> 36%)"
    print(f"• Coeficiente de Variabilidad (CV):   {cv}%  --> [{cv_status}]")
    
    tir = metrics.get('time_in_range_pct')
    tir_status = "OPTIMO (> 70%)" if (tir is not None and tir >= 70.0) else "REQUIERE AJUSTE (< 70%)"
    print(f"• Tiempo en Rango (TIR [70-180]):     {tir}%  --> [{tir_status}]")
    
    hypo = metrics.get('hypo_pct')
    hypo_status = "SEGURO (< 4%)" if (hypo is not None and hypo < 4.0) else "ALERTA (>= 4%)"
    print(f"• Hipoglucemia (< 70 mg/dL):          {hypo}%  --> [{hypo_status}]")
    
    hyper = metrics.get('hyper_pct')
    hyper_status = "CONTROLADO (< 25%)" if (hyper is not None and hyper <= 25.0) else "ELEVADO (> 25%)"
    print(f"• Hiperglucemia (> 180 mg/dL):        {hyper}%  --> [{hyper_status}]")
    print("=" * 65)


def main():
    db = SessionLocal()
    try:
        users = db.query(models.User).filter(models.User.role == models.UserRole.PACIENTE).all()
        all_glucose = db.query(models.GlucoseLog).all()
        
        print("\n" + "#" * 65)
        print("  AUDITORIA CLINICA Y ESTADISTICAS DE SALUD (GDD-T2)")
        print("#" * 65)
        print(f"Pacientes registrados: {len(users)} | Mediciones totales: {len(all_glucose)}\n")
        
        if all_glucose:
            levels = [float(g.glucose_level) for g in all_glucose]
            metrics = compute_glycemic_metrics(levels)
            print_metrics_summary("Métricas Glucémicas Globales del Sistema", metrics)
        else:
            print("No se encontraron registros de glucosa registrados en la base de datos.")
            
        for u in users:
            p_glucose = db.query(models.GlucoseLog).filter(models.GlucoseLog.patient_id == u.id).all()
            if p_glucose:
                p_levels = [float(g.glucose_level) for g in p_glucose]
                p_metrics = compute_glycemic_metrics(p_levels)
                print()
                print_metrics_summary(f"Paciente: {u.first_name} {u.last_name} ({u.email})", p_metrics)
                
    finally:
        db.close()


if __name__ == '__main__':
    main()
