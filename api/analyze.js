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

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        status: "neutral",
        title: "Falta configuración",
        message: "No se encontró OPENAI_API_KEY en Vercel.",
        recommendation: "Agrega tu clave de OpenAI."
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
Eres un analista experto en relaciones y manipulación emocional.

Tu objetivo NO es solo analizar, sino generar un pequeño impacto emocional que haga que la persona quiera seguir entendiendo lo que le pasa.

Clasifica el texto en uno de estos niveles:
safe, neutral, warning_soft, warning, high_warning, toxic

Reglas:
- Si hay invalidación → mínimo warning
- Si hay manipulación → mínimo warning
- Si hay desgaste emocional → high_warning
- Si hay miedo o control → toxic

Responde SOLO JSON:
{
  "level": "nivel"
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
        message: `No hay señales claras de manipulación en lo que compartes.

Aun así, algo importante es cómo te hace sentir esto en el tiempo, no solo este momento puntual.`,
        recommendation: `Si quieres, puedes contarme un poco más del contexto. A veces los patrones aparecen cuando ves la historia completa.`
      },

      neutral: {
        status: "neutral",
        title: "Hay señales que pueden generar confusión",
        message: `No es completamente claro, pero sí hay algo que puede generar duda o incomodidad.

Y eso ya es suficiente para prestarle atención.`,
        recommendation: `Si quieres, cuéntame qué pasó antes o después de esto. Ahí suele verse si es algo aislado o parte de un patrón.`
      },

      warning_soft: {
        status: "warning_soft",
        title: "Empiezan a aparecer señales sutiles",
        message: `Aquí ya hay pequeños indicios que pueden hacerte dudar de lo que sientes o piensas.

Ese tipo de dinámicas no suelen ser evidentes al inicio.`,
        recommendation: `Si esto te hace sentir confundida o te lleva a explicarte demasiado, vale la pena mirar más a fondo. Puedes contarme más si quieres.`
      },

      warning: {
        status: "warning",
        title: "Hay señales de manipulación emocional",
        message: `Aquí ya no es solo confusión.

Empiezan a aparecer patrones que pueden hacerte sentir responsable de cosas que no te corresponden.`,
        recommendation: `Si quieres, cuéntame más sobre cómo es la relación en general. A veces esto no es un caso aislado.`
      },

      high_warning: {
        status: "high_warning",
        title: "La dinámica ya es preocupante",
        message: `Lo que describes puede afectar cómo percibes la realidad dentro de la relación.

Eso no pasa de la nada.`,
        recommendation: `Si esto se repite, es importante entender el patrón completo. Puedes contarme más y lo vemos juntas.`
      },

      toxic: {
        status: "toxic",
        title: "Hay señales de una dinámica dañina",
        message: `Esto ya apunta a una dinámica que puede desgastarte emocionalmente.

No suele ser algo aislado.`,
        recommendation: `Si quieres, puedes contarme más sobre lo que has vivido con esta persona. Ahí suele estar la clave para entender todo.`
      }
    };

    const finalResponse = responses[level] || responses.neutral;

    return res.status(200).json(finalResponse);

  } catch (error) {
    return res.status(500).json({
      status: "neutral",
      title: "Error inesperado",
      message: error.message || "Ocurrió un error interno.",
      recommendation: "Intenta nuevamente."
    });
  }
}
