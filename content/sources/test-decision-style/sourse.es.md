Estilo de Decisión: Análisis vs Intuición (ES)
===========================================

Propósito
---------
Un test rápido de autoexploración para Quiz Factory que mapea cómo tomas decisiones: análisis vs intuición, velocidad vs precisión y tu apetito por el riesgo.

No negociables
--------------
- Usar IDs estables para todo lo que se use en scoring o analítica.
- Localizar solo los textos visibles, no los IDs.
- No almacenar respuestas en bruto en analítica ni en base de datos.
- Evitar respuestas de texto libre en el MVP.
- Evitar recoger PII.
- Evitar afirmaciones de diagnóstico médico.

Metadatos internos
-----------------
test_id: decision_style_analytical_intuitive_v1
slug: decision-style-analytical-intuitive
version: 1.0.0
category: decision-making
format_id: universal_human_v1
primary_locale: es
supported_locales: es
estimated_time_min: 5
estimated_time_max: 7
questions_count: 22

Descargo de responsabilidad (de cara al usuario)
-----------------------------------------------
Esto es una herramienta de autoexploración y entretenimiento. No es un diagnóstico médico, psicológico, legal ni financiero.

Concepto
--------
Concepto en 1 párrafo:
Tus mejores decisiones suelen venir de la mezcla correcta entre pensar y sentir. Este test te muestra tu mezcla por defecto, lo rápido que te comprometes y cuánta incertidumbre toleras. La idea no es etiquetarte como "bueno" o "malo". Es ayudarte a ver tus hábitos al decidir, en qué situaciones te funcionan y en cuáles un pequeño ajuste te ahorra tiempo, dinero o arrepentimiento.

Qué mide (1 línea):
Estilo de decisión (Análisis vs Intuición), ritmo (Velocidad vs Precisión) y apetito por el riesgo.

Promesa corta:
En 22 afirmaciones rápidas, obtén tu perfil de decisión y una forma práctica de ajustar velocidad, precisión y riesgo según lo que esté en juego.

Copy UI (pantalla de inicio)
----------------------------
Locale: es
Title: Estilo de Decisión: Análisis vs Intuición
Short description: Descubre cómo decides con incertidumbre: cabeza vs instinto, rápido vs a fondo, seguro vs audaz.
Intro: 22 afirmaciones. Sin trampas. Responde como decides normalmente, sobre todo cuando estás ocupado o bajo presión.
Instructions: Elige la opción que te describe la mayor parte del tiempo. Si dudas entre 2 opciones, marca la que haces un poco más a menudo.

Escalas de respuesta (reutilizables)
-----------------------------------
Scale: likert_5
- option_id: likert_1, score: 1
  labels:
    es: Totalmente en desacuerdo
- option_id: likert_2, score: 2
  labels:
    es: En desacuerdo
- option_id: likert_3, score: 3
  labels:
    es: Ni de acuerdo ni en desacuerdo
- option_id: likert_4, score: 4
  labels:
    es: De acuerdo
- option_id: likert_5, score: 5
  labels:
    es: Totalmente de acuerdo

Banco de preguntas (legible)
----------------------------
QID: q01
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Me incomoda decidir sin al menos unos datos sólidos.
Scoring weights (per scale_id):
  analysis: 2
  precision: 1

QID: q02
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Cuando los datos son confusos, confío más en la intuición que en las hojas de cálculo.
Scoring weights (per scale_id):
  intuition: 2

QID: q03
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Prefiero decidir rápido y ajustar después antes que esperar a tener certeza total.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q04
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: De manera natural convierto una decisión grande en criterios y los pondero.
Scoring weights (per scale_id):
  analysis: 2

QID: q05
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Percibo el "ambiente" (tono, timing, señales sutiles) y me influye al decidir.
Scoring weights (per scale_id):
  intuition: 2

QID: q06
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Reviso los detalles 2 veces porque los pequeños errores me molestan después.
Scoring weights (per scale_id):
  precision: 2

QID: q07
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Puedo tomar una buena decisión con el 70% de la información.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q08
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Me gusta usar modelos simples (pros y contras, puntuación, valor esperado) para elegir.
Scoring weights (per scale_id):
  analysis: 2

QID: q09
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Si mi primera corazonada es fuerte, suelo actuar.
Scoring weights (per scale_id):
  intuition: 2
  speed: 1

QID: q10
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Antes de elegir, imagino 2-3 maneras en las que podría salir mal.
Scoring weights (per scale_id):
  precision: 2
  analysis: 1

QID: q11
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Prefiero hacer una prueba pequeña a discutir sin fin.
Scoring weights (per scale_id):
  speed: 2
  analysis: 1

QID: q12
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Para mí importa más acertar que ir rápido.
Scoring weights (per scale_id):
  precision: 2

QID: q13
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Me siento cómodo asumiendo un riesgo calculado si la ganancia potencial es grande.
Scoring weights (per scale_id):
  risk: 1
  analysis: 1

QID: q14
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Si aparece nueva evidencia, cambio de opinión rápido.
Scoring weights (per scale_id):
  analysis: 1
  speed: 1

QID: q15
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Pido una segunda opinión para detectar puntos ciegos.
Scoring weights (per scale_id):
  precision: 1

QID: q16
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Confío en patrones de mi experiencia aunque no los pueda explicar bien.
Scoring weights (per scale_id):
  intuition: 2

QID: q17
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Bajo presión de tiempo, mantengo la calma y aun así decido.
Scoring weights (per scale_id):
  speed: 2
  risk: 1

QID: q18
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Puedo tolerar la incertidumbre sin correr a cerrarla.
Scoring weights (per scale_id):
  precision: 2

QID: q19
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Me influyen más los números y pronósticos que las historias y anécdotas.
Scoring weights (per scale_id):
  analysis: 2

QID: q20
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Uso reglas prácticas (atajos mentales) para decidir rápido.
Scoring weights (per scale_id):
  speed: 2
  intuition: 1

QID: q21
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: No me gusta elegir sin una definición clara de "éxito".
Scoring weights (per scale_id):
  analysis: 2
  precision: 1

QID: q22
Type: likert_5
Required: true
Scale: likert_5
Prompt:
- es: Tiendo a elegir la opción más audaz por encima de la más segura.
Scoring weights (per scale_id):
  risk: 1
  speed: 1

Modelo de scoring
-----------------
Model C: Híbrido (multi-escala + perfil determinista)

1) Calcular las escalas
- scale_scores[scale_id] = suma(option_score * peso) en todas las preguntas.

Scale IDs usados en scoring:
- analysis
- intuition
- speed
- precision
- risk

2) Calcular ejes (determinista)
- style_axis = scale_scores[analysis] - scale_scores[intuition]
- pace_axis = scale_scores[speed] - scale_scores[precision]

3) Dial de riesgo (derivado del score de riesgo)
- risk_score = scale_scores[risk]
- risk_cautious: 5-12 (incluye límites)
- risk_balanced: 13-18 (incluye límites)
- risk_bold: 19-25 (incluye límites)

4) band_id del perfil (4 perfiles)
- strategist: style_axis >= 0 AND pace_axis < 0
- rapid_analyst: style_axis >= 0 AND pace_axis >= 0
- reflective_visionary: style_axis < 0 AND pace_axis < 0
- instinct_sprinter: style_axis < 0 AND pace_axis >= 0

5) top_traits (3 IDs, determinista)
- dominant_style_trait = analysis si scale_scores[analysis] >= scale_scores[intuition], si no intuition
- dominant_pace_trait = speed si scale_scores[speed] >= scale_scores[precision], si no precision
- risk_tilt_trait = uno de: risk_cautious | risk_balanced | risk_bold
- top_traits = [dominant_style_trait, dominant_pace_trait, risk_tilt_trait]

Escalas
-------
- scale_id: analysis
  Display name:
    es: Análisis
  Definition:
    es: Prefieres hechos, estructura y trade-offs explícitos. Te da seguridad que el razonamiento sea visible.

- scale_id: intuition
  Display name:
    es: Intuición
  Definition:
    es: Confías en patrones y contexto. Captas señales que otros no ven, aunque cueste explicarlo.

- scale_id: speed
  Display name:
    es: Velocidad
  Definition:
    es: Te mueves rápido, decides con información imperfecta y corriges sobre la marcha.

- scale_id: precision
  Display name:
    es: Precisión
  Definition:
    es: Bajas el ritmo, verificas detalles y priorizas acertar. Prefieres menos errores a cerrar rápido.

- scale_id: risk
  Display name:
    es: Apetito por el riesgo
  Definition:
    es: Tu comodidad con la incertidumbre y el posible coste. Más alto significa más disposición a apostar por el upside.

Rasgos derivados (para TOP3)
----------------------------
- trait_id: risk_cautious
  Display name:
    es: Prudente
  Definition:
    es: Tiendes a apostar seguro y a protegerte del downside.

- trait_id: risk_balanced
  Display name:
    es: Equilibrado
  Definition:
    es: Tomas riesgos cuando valen la pena, pero no los buscas por deporte.

- trait_id: risk_bold
  Display name:
    es: Audaz
  Definition:
    es: Te sientes cómodo con apuestas grandes y ambigüedad, sobre todo si el upside es claro.

Perfiles (bands)
----------------
- band_id: strategist
  Display name:
    es: Estratega
  One-liner:
    es: Análisis + Precisión. Ganas dejando la decisión limpia y luego ejecutando con confianza.

- band_id: rapid_analyst
  Display name:
    es: Analista Ágil
  One-liner:
    es: Análisis + Velocidad. Ganas moviéndote rápido con un marco y aprendiendo por iteración.

- band_id: reflective_visionary
  Display name:
    es: Visionario Reflexivo
  One-liner:
    es: Intuición + Precisión. Ganas leyendo patrones a fondo y comprobando antes de comprometerte.

- band_id: instinct_sprinter
  Display name:
    es: Sprinter Instintivo
  One-liner:
    es: Intuición + Velocidad. Ganas confiando pronto en la señal y convirtiendo decisiones en acción.

Reglas de desempate
-------------------
Rule 1: Si style_axis == 0, se elige Análisis (style_axis >= 0).
Rule 2: Si pace_axis == 0, se elige Velocidad (pace_axis >= 0).
Rule 3: Si risk_score cae justo en un límite, se aplican los rangos inclusivos (prudente hasta 12, equilibrado hasta 18).

Política de respuestas faltantes
--------------------------------
Todas las preguntas son obligatorias. Si falta alguna respuesta, bloquear el final y pedir completar las que faltan.

Payload derivado (guardar solo esto)
-----------------------------------
No guardar respuestas en bruto. Guardar solo salidas derivadas.

Campos requeridos:
- test_id
- computed_at_utc
- derived:
  - scale_scores: { analysis, intuition, speed, precision, risk }
  - band_id: uno de { strategist, rapid_analyst, reflective_visionary, instinct_sprinter }
  - top_traits: [dominant_style_trait, dominant_pace_trait, risk_tilt_trait]
  - flags: lista opcional
  - meta: objeto opcional (solo agregados seguros)

Extras recomendados (aún seguros):
- derived.meta.style_axis
- derived.meta.pace_axis
- derived.meta.risk_score

Librerías de copy
-----------------
Preview copy library (gratis)

Key: strategist
- es: Decides como Estratega: bajas el ritmo para acertar y luego te comprometes. Tu superpoder es la claridad; tu riesgo es construir un caso perfecto cuando bastaba con un movimiento más pequeño.

Key: rapid_analyst
- es: Eres Analista Ágil: piensas con estructura, pero no te quedas atascado. Tu superpoder es el impulso; tu riesgo es saltarte ese detalle que lo cambiaba todo.

Key: reflective_visionary
- es: Eres Visionario Reflexivo: confías en los patrones y luego haces una comprobación rápida antes de comprometerte. Tu superpoder es la profundidad; tu riesgo es dejar la decisión abierta demasiado tiempo.

Key: instinct_sprinter
- es: Eres Sprinter Instintivo: decides rápido y aprendes haciendo. Tu superpoder es la velocidad; tu riesgo es apostar por la primera señal en vez de por la mejor.

Paid copy library (completo)

Key: strategist
es bullets:
- Tu "embudo de decisión" (qué haces primero, segundo, tercero) y cómo recortar tiempo sin recortar calidad.
- Las 3 trampas que te frenan, más contra-movimientos que encajan con tu cabeza.
- Un dial de riesgo personal: cuándo ir a lo seguro, cuándo empujar y cómo poner barandillas.

Key: rapid_analyst
es bullets:
- Cómo mantener la velocidad sin volverte descuidado (tus 2 mejores checks).
- Dónde sueles subestimar el riesgo y cómo verlo temprano.
- 5 guiones de decisión para llamadas de alto impacto, reuniones y negociaciones.

Key: reflective_visionary
es bullets:
- Cómo convertir intuición en razonamiento más claro (para que otros confíen en tus decisiones).
- Dónde el perfeccionismo se disfraza de "pensar un poco más" y cómo cerrar bien.
- Un mapa de riesgo: qué apuestas te convienen y cuáles conviene delegar o proteger.

Key: instinct_sprinter
es bullets:
- Cómo mejorar decisiones de instinto con 2 comprobaciones rápidas (sin perder velocidad).
- En qué situaciones ganas grande y dónde tu estilo puede jugarte en contra.
- Un plan práctico para reducir arrepentimiento manteniendo tu ritmo.

Plantillas de resultados
------------------------
Plantilla de preview (gratis)
Title: Tu Estilo de Decisión: {BAND_NAME}
Body:
Señales clave: {TOP1} + {TOP2}. Tu dial de riesgo está en {TOP3}.

Qué significa hoy:
- Tienes una forma por defecto de decidir que te ahorra energía.
- En la situación equivocada, ese mismo hábito puede generar errores evitables.

Desbloquea el informe completo para obtener tu Playbook de Decisión: tus mejores entornos, tus puntos ciegos y guiones concretos para resultados más rápidos y limpios.

Paywall hook paragraph:
¿Quieres el playbook y no solo la etiqueta? El informe completo muestra cómo decides cuando suben las apuestas, dónde sobrepiensas o dónde te falta checkear, y cómo ajustar tu riesgo para ganar más a menudo.

Estructura del informe de pago
Report title: Tu Playbook de Decisión
Sections:
1) Tu perfil base (cómo piensas, cómo te comprometes)
2) Velocidad vs precisión: tu punto óptimo según lo que esté en juego
3) Dial de riesgo: cuándo apostar, cuándo proteger, cómo poner guardrails
4) Puntos ciegos y trampas habituales (y contra-movimientos)
5) Plan de mejora de 7 días (micro-hábitos + guiones reutilizables)

Copy de paywall
---------------
CTA: Desbloquear mi Playbook completo de Decisión
Bullets:
- Tu perfil explicado con escenarios reales (trabajo, dinero, relaciones)
- Guiones personalizados para decisiones rápidas y de calidad
- Tu dial de riesgo con guardrails (para que lo audaz no se vuelva imprudente)
- Un plan de 7 días para mejorar tus resultados al decidir

Checklist de éxito
------------------
- test_id, slug, version, category, primary_locale presentes.
- Todos los question_id son únicos y estables.
- Todos los textos localizados existen para locale: es.
- El scoring es explícito y determinista.
- El payload derivado excluye respuestas en bruto.
- Existe copy de preview y de pago.
- Sin afirmaciones de diagnóstico ni recolección de PII.
