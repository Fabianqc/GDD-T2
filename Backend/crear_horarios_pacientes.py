"""
Script para inicializar o actualizar horarios de comida de todos los pacientes.
Uso local:
    python Backend/crear_horarios_pacientes.py
Uso en VPS:
    cd /home/fabian/GDD-T2/Backend
    venv/bin/python crear_horarios_pacientes.py
"""
import sys
import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

try:
    from database import SessionLocal, engine
    import models
    from meal_reminder_service import ensure_meal_reminder_config, format_hhmm, DEFAULT_TIMEZONE
except (ImportError, ValueError):
    from Backend.database import SessionLocal, engine
    from Backend import models
    from Backend.meal_reminder_service import ensure_meal_reminder_config, format_hhmm, DEFAULT_TIMEZONE


def setup_all_patient_schedules():
    db = SessionLocal()
    try:
        print("=" * 70)
        print("  CONFIGURACIÓN DE HORARIOS DE RECORDATORIOS PARA PACIENTES")
        print(f"  Motor de BD: {engine.url}")
        print("=" * 70)

        # 1. Obtener todos los usuarios con rol PACIENTE
        patients = (
            db.query(models.User)
            .filter(models.User.role == models.UserRole.PACIENTE)
            .order_by(models.User.email.asc())
            .all()
        )

        if not patients:
            print("\n[!] No se encontraron usuarios con rol PACIENTE en la base de datos.")
            return

        print(f"\nSe encontraron {len(patients)} paciente(s).\n")

        total_configured = 0

        for patient in patients:
            print(f"-> Paciente: {patient.first_name} {patient.last_name} ({patient.email})")

            # 2. Asegurar que exista perfil de paciente (requerido por Foreign Key)
            profile = (
                db.query(models.PatientProfile)
                .filter(models.PatientProfile.user_id == patient.id)
                .first()
            )
            if not profile:
                profile = models.PatientProfile(
                    user_id=patient.id,
                    date_of_birth=datetime.date(1990, 1, 1),
                )
                db.add(profile)
                db.flush()
                print("   [+] Perfil de paciente creado (era inexistente).")

            # 3. Asegurar configuración de horarios y slots
            config = ensure_meal_reminder_config(
                db=db,
                patient_id=patient.id,
                timezone=DEFAULT_TIMEZONE,
                updated_by=patient.id
            )
            config.enabled = True
            db.commit()
            db.refresh(config)

            # 4. Mostrar estado de los slots
            print(f"   Zona horaria: {config.timezone} | Anticipación: {config.advance_minutes} min | Estado: {'ACTIVADO' if config.enabled else 'DESACTIVADO'}")
            for slot in sorted(config.slots, key=lambda s: s.meal_type.value):
                status_icon = "ON" if slot.enabled else "OFF"
                print(f"     [{status_icon:>3}] {slot.meal_type.value:<10}: {format_hhmm(slot.meal_time)}")

            total_configured += 1
            print()

        print("=" * 70)
        print(f"  [ÉXITO] Horarios configurados y verificados para {total_configured} paciente(s).")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Ocurrió un error al configurar horarios: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    setup_all_patient_schedules()
