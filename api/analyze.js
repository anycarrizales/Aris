export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "neutral",
      title: "Método no permitido",
      message: "Esta ruta solo acepta solicitudes POST.",
      recommendation: "Envía el texto desde el formulario."
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const text = body?.message?.trim();
    const history = body?.history || [];
    const firstAnalysis = body?.firstAnalysis ?? true;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        status: "neutral",
        title: "Falta configuración",
        message: "No se encontró OPENAI_API_KEY en Vercel.",
        recommendation: "Agrega tu clave de OpenAI en Settings > Environment Variables y vuelve a desplegar."
      });
    }

    if (!text) {
      return res.status(400).json({
        status: "neutral",
        title: "Texto inválido",
        message: "No se recibió un texto válido para analizar.",
        recommendation: "Pega una conversación o un mensaje antes de analizar."
      });
    }
    const lowerText = text.toLowerCase();

    // 🚨 DETECCIÓN DE VIOLENCIA FÍSICA (PRIORIDAD MÁXIMA)
    const physicalViolencePatterns = [
      "me pegó","me pego","me golpeó","me golpeo","me dio una cachetada",
      "me dio una bofetada","me empujó","me empujo","me jaló","me jalo",
      "me agarró del cuello","me agarro del cuello","me lanzó","me lanzo",
      "me aventó","me avento","me tiró al piso","me tiro al piso",
      "me lastimó","me lastimo","me agredió","me agredio",
      "me dio un puñetazo","me dio un golpe","me dio en la cara"
    ];

    if (physicalViolencePatterns.some(pattern => lowerText.includes(pattern))) {
      return res.status(200).json({
        status: "toxic",
        title: "Hay señales de una dinámica gravemente dañina",
        message: `Lo que compartes incluye agresión física.

Esto no es una señal confusa ni algo menor.

Aunque después haya disculpas o promesas, que alguien te golpee o te lastime físicamente es una línea que no debería cruzarse.

No necesitas justificarlo para que sea grave.

Y algo importante: muchas veces, después de un episodio así, la persona afectada tiende a minimizarlo para poder sostener la relación.`,
        recommendation: `No lo normalices. Esto merece ser tomado en serio.

Si quieres, puedes contarme un poco más sobre lo que pasó antes o después de eso. A veces ahí se ven patrones más claros que ayudan a entender toda la dinámica.`
      });
    }

   // 🔥 MODO CHAT (DESPUÉS DEL PRIMER ANÁLISIS)
    if (!firstAnalysis) {
      const chatPrompt = `
Estás hablando con una persona que está intentando entender su relación.

Contexto:
${history.map(h => `Usuario: ${h.user}\nAsistente: ${h.assistant}`).join("\n")}

Nuevo mensaje:
"${text}"

Responde de forma:
- natural
- empática pero clara
- directa
- sin repetir análisis estructurados
- puedes hacer preguntas
- ayuda a la persona a ver patrones
- genera confianza para que siga hablando

Evita:
- sonar robótico
- repetir frases anteriores
- usar etiquetas como "nivel", "toxicidad", etc

`;

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          input: chatPrompt
        })
      });

      const data = await response.json();

      const reply =
        data.output_text ||
        data.output?.map(item =>
          item.content?.map(c => c.text || "").join(" ")
        ).join(" ") ||
        "No pude responder en este momento.";

      return res.status(200).json({
        message: reply
      });
    }

   // 🔥 MODO ANÁLISIS (PRIMERA VEZ - OPTIMIZADO PARA ENGAGEMENT)

  const prompt = `
Eres un analista de comunicación emocional con enfoque en relaciones y vas a analizar lo que le dijo su pareja a esta persona.

Tu objetivo NO es solo analizar, sino generar un pequeño impacto emocional que haga que la persona quiera seguir entendiendo lo que le pasa.

Clasifica el siguiente texto en UNO de estos 6 niveles, según las señales presentes:

safe:
- tono respetuoso
- no hay culpa, presión, humillación ni invalidación

neutral:
- hay incomodidad o ambigüedad, pero no señales suficientes para hablar de manipulación

warning_soft:
- minimiza emociones
- invalida sutilmente
- hace que la persona se explique de más
- genera confusión leve

warning:
- culpa a la otra persona por sentir
- contradicciones
- exigencias injustas
- control emocional sutil
- manipulación emocional visible

high_warning:
- gaslighting
- hace dudar de la memoria o de la percepción
- hace sentir que el problema siempre es la otra persona
- desgaste emocional fuerte

toxic:
- violencia física o agresión física de cualquier tipo
- miedo
- coerción
- presión
- sometimiento
- amenaza
- imposibilidad de decir "no" con seguridad
- dinámica emocionalmente dañina

Reglas:
- Si hay invalidación clara, no uses "neutral".
- Si hay culpa, manipulación o contradicción repetida, usa mínimo "warning".
- Si hay miedo o presión para someterse, usa "toxic".
- Si el texto menciona golpes, empujones, bofetadas, agresión física o daño corporal, usa siempre "toxic".
- No reduzcas el nivel por disculpas, promesas, arrepentimiento o frases como "fue sin querer" o "me ama".
- No diagnostiques personas.
- Responde SOLO con JSON válido.

Formato exacto:
{
  "level": "safe | neutral | warning_soft | warning | high_warning | toxic"
}

Texto:
"""${text}"""
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        status: "neutral",
        title: "Error en OpenAI",
        message: data?.error?.message || "La API devolvió un error.",
        recommendation: "Revisa la clave, el acceso al modelo o el saldo de tu cuenta."
      });
    }

    const raw =
      data.output_text ||
      data.output?.map(item =>
        item.content?.map(c => c.text || "").join(" ")
      ).join(" ") ||
      "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { level: "neutral" };
    }

    const level = parsed.level || "neutral";

    const responses = {
      safe: {
        status: "safe",
        title: "No se detecta manipulación clara",
        message: `Lo que compartes no muestra señales claras de manipulación emocional.

Aun así, observa cómo te sientes dentro de la relación: si puedes expresarte con libertad, si te sientes respetada y si hay espacio para el diálogo sin miedo.

Las relaciones sanas no son perfectas, pero sí seguras emocionalmente.`,
        recommendation: `Si quieres, puedes contarme un poco más del contexto. A veces los patrones aparecen cuando ves la historia completa.`
      },

      neutral: {
        status: "neutral",
        title: "Hay señales ambiguas que conviene observar",
        message: `Lo que describes no es concluyente por sí solo, pero sí puede generar confusión emocional.

A veces la manipulación no empieza de forma evidente. Puede disfrazarse de cariño, de preocupación o de un simple malentendido, y por eso cuesta tanto reconocerla al principio.

Tu incomodidad no es exagerada solo porque todavía no tengas todas las respuestas.`,
        recommendation: `Si quieres, cuéntame qué pasó antes o después de esto. Ahí suele verse si es algo aislado o parte de un patrón.`
      },

      warning_soft: {
        status: "warning_soft",
        title: "Hay indicios de invalidación emocional",
        message: `Lo que compartes puede ser una forma de invalidación emocional.

No siempre el maltrato comienza con violencia evidente. Muchas veces empieza haciendo que dudes de lo que sientes, de lo que recuerdas o de si tienes derecho a molestarte.

Si notas que te explicas demasiado, que minimizas tu malestar o que terminas pensando que todo es culpa tuya, esa señal merece atención.`,
        recommendation: `Si esto te hace sentir confundida o te lleva a explicarte demasiado, vale la pena mirar más a fondo. Puedes contarme más si quieres.`
      },

      warning: {
        status: "warning",
        title: "Se observan señales de manipulación emocional",
        message: `Aquí ya aparecen señales de manipulación emocional.

Puede manifestarse como culpa, contradicciones, exigencias injustas o comportamientos que te hacen sentir responsable de todo. Estas dinámicas no siempre son escandalosas, pero sí desgastan tu seguridad, tu claridad y tu autoestima con el tiempo.

No es fácil verlo cuando estás dentro de la relación.`,
        recommendation: `Si quieres, cuéntame más sobre cómo es la relación en general. A veces esto no es un caso aislado.`
      },

      high_warning: {
        status: "high_warning",
        title: "Hay señales claras de manipulación emocional",
        message: `Lo que describes muestra señales claras de manipulación emocional.

Este tipo de dinámicas puede hacerte dudar de tu propia realidad, de tu memoria o incluso de tu valor. A veces la manipulación no grita: se instala lentamente hasta que ya no sabes si el problema es la otra persona o si eres tú.

Nada de eso es casual.`,
        recommendation: `Si esto se repite, es importante entender el patrón completo. Puedes contarme más y lo vemos juntas.`
      },

      toxic: {
        status: "toxic",
        title: "Hay señales de una dinámica emocionalmente dañina",
        message: `Lo que compartes muestra señales de una dinámica emocionalmente dañina.

Cuando aparece el miedo, la presión, la coerción o la sensación de no poder decir "no" con seguridad, ya no estamos hablando solo de diferencias o conflictos normales dentro de una relación. Estamos frente a algo que puede afectar profundamente tu bienestar emocional.

Tu cuerpo suele notarlo antes que tu mente. Por eso la incomodidad importa.`,
        recommendation: Si quieres, puedes contarme más sobre lo que has vivido con esta persona. Ahí suele estar la clave para entender todo.`
      }
    };

    const finalResponse = responses[level] || responses.neutral;

    return res.status(200).json(finalResponse);

  } catch (error) {
    return res.status(500).json({
      status: "neutral",
      title: "Error inesperado",
      message: error.message || "Ocurrió un error interno al analizar el texto.",
      recommendation: "Intenta nuevamente en unos segundos."
    });
  }
}
