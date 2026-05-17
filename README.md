# GDD-T2 — Gestión Dietética para Diabetes Tipo 2 🩺🥗

¡Bienvenido al repositorio oficial del proyecto **GDD-T2**! Este sistema consta de un backend rápido y seguro en **FastAPI** y una aplicación móvil y web premium construida en **Expo / React Native**.

Este documento contiene las instrucciones detalladas paso a paso para configurar e iniciar ambos proyectos en tu entorno local.

---

## 🚀 Cómo iniciar el BACKEND (FastAPI)

El backend implementa autenticación segura con JWT, rotación de Refresh Tokens (`Rotate Token Strategy`) y soporte multiplataforma.

### 📋 Requisitos Previos
* Python 3.11 o superior (Totalmente optimizado para Python 3.14).
* Un entorno virtual de Python instalado (`venv`).

### ⚙️ Configuración Inicial

1. **Abre tu terminal** y navega al directorio del backend:
   ```cmd
   cd /d d:\proyectos\GDD-T2\Backend
   ```

2. **Crea el archivo de configuración `.env`** si no existe y verifica las variables:
   * `DATABASE_URL` = URL de tu PostgreSQL local.
   * `SECRET_KEY` = Tu clave secreta para firmar los JWT.

3. **Activa el entorno virtual e instala las dependencias**:
   ```cmd
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
   > **Nota de compatibilidad en Windows + Python 3.14**: Las librerías de encriptación y validación se han configurado con versiones exactas para evitar fallos de compilación en compiladores de C/Rust locales.

### ▶️ Ejecución del Servidor

Ejecuta el siguiente comando según la terminal de tu preferencia:

* **Desde Símbolo del Sistema (CMD):**
  ```cmd
  cd /d d:\proyectos\GDD-T2
  Backend\venv\Scripts\python.exe -m uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload
  ```

* **Desde PowerShell:**
  ```powershell
  cd d:\proyectos\GDD-T2
  .\Backend\venv\Scripts\python.exe -m uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload
  ```

* **Acceso local**: 
  * Servidor base: `http://localhost:8000`
  * Documentación Swagger interactiva: **[http://localhost:8000/docs](http://localhost:8000/docs)**

> 💡 **Fallback Inteligente de Desarrollo**: Si tu servicio local de PostgreSQL no está activo o sus credenciales son incorrectas, la aplicación **iniciará automáticamente una base de datos SQLite local (`gdd_t2.db`)** para que no te bloquees y puedas probar el sistema completo al instante.

---

## 📱 Cómo iniciar el FRONTEND (Expo / React Native)

El frontend contiene la interfaz de usuario premium para el login, el validador interactivo de contraseñas y la navegación segura basada en roles.

### 📋 Requisitos Previos
* Node.js (v18 o superior recomendado).
* Gestor de paquetes `npm`.

### ⚙️ Configuración Inicial

1. **Abre una nueva terminal** y ve a la carpeta del frontend:
   ```cmd
   cd /d d:\proyectos\GDD-T2\Frontend
   ```

2. **Instala las dependencias necesarias** (si no lo has hecho ya):
   ```cmd
   npm install
   ```

### ▶️ Ejecución de la App

Inicia el servidor Metro Bundler de Expo ejecutando:

```cmd
cd /d d:\proyectos\GDD-T2\Frontend
npm start
```

### 🌐 Cómo probar la App:
* **Web**: Cuando cargue la consola de Metro, presiona la tecla **`w`** para abrir de inmediato la aplicación web premium en tu navegador.
* **Celular**: Escanea el código QR que se muestra en la terminal usando la app gratuita **Expo Go** en tu smartphone (Android o iOS).

> 🔐 **Tecnología de Almacenamiento**: La app detecta automáticamente la plataforma. Usa `localStorage` de alto rendimiento cuando se ejecuta en navegadores web y el llavero cifrado de hardware seguro (`SecureStore`) cuando se compila en dispositivos móviles Android o iOS.
