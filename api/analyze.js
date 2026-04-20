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
        message: "No se encontró OPENAI_API_KEY.",
        recommendation: "Agrega tu API Key en tu entorno."
      });
    }

    if (!text || text.length < 5) {
      return res.status(400).json({
        status: "neutral",
        title: "Texto inválido",
        message: "Escribe algo más claro para analizar.",
        recommendation: "Describe mejor lo que pasó."
      });
    }

    const lowerText = text.toLowerCase();

    // 🔥 DETECTOR DE VIOLENCIA MEJORADO
    function detectarViolencia(texto) {
      const t = texto.toLowerCase();

      const patrones = [
        "me pegó","me pego","me golpeó","me golpeo",
        "me empujó","me empujo",
        "me jaló","me jalo",
        "me agarró","me agarro",
        "me sujetó","me sujeto",
        "me apretó","me apreto",
        "me aventó","me avento",
        "me tiró","me tiro",
        "me dio una cachetada","me dio una bofetada",
        "me dio un golpe","me dio en la cara",
        "me lastimó","me lastimo",
        "me agredió","me agredio",
        "me tiró","me tiro"
      ];

      return patrones.some(p => t.includes(p));
    }

    // 🚨 RESPUESTA DIRECTA SI HAY VIOLENCIA
    if (detectarViolencia(text)) {
      return res.status(200).json({
        status: "toxic",
        title: "Esto no es una señal confusa",
        message: `Lo que describes incluye agresión física.

No importa si fue “sin querer” o si después hubo disculpas.

Alguien que te golpea, te empuja o te lastima cruza un límite serio.

El amor no incluye daño físico.

Y algo importante: cuando esto pasa, muchas personas tienden a minimizarlo para poder sostener la relación. Eso no lo hace menos grave.`,
        recommendation: `Esto merece ser tomado en serio.

Si quieres, cuéntame qué pasó antes o después. Ahí suelen aparecer patrones que explican mejor toda la dinámica.`
      });
    }

    // 💬 MODO CHAT (CONVERSACIÓN REAL)
    if (!firstAnalysis) {
      const chatPrompt = `
Estás hablando con una persona que está intentando entender su relación.

Historial:
${history.map(h => `Usuario: ${h.user}\nAsistente: ${h.assistant}`).join("\n")}

Nuevo mensaje:
"${text}"

Responde como un humano real:
- cercano
- claro
- directo pero empático
- puedes hacer preguntas
- no repitas estructuras anteriores
- ayuda a profundizar
- genera confianza

Evita:
- lenguaje técnico
- sonar como terapeuta frío
- repetir análisis anteriores
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
        "No pude responder ahora.";

      return res.status(200).json({ message: reply });
    }

    // 🧠 CLASIFICACIÓN INICIAL
    const prompt = `
Analiza este mensaje dentro de una relación.

Clasifica en uno de estos niveles:
safe, neutral, warning_soft, warning, high_warning, toxic

Reglas:
- Si hay manipulación → mínimo warning
- Si hay confusión emocional → warning_soft
- Si hay control o culpa → warning
- Si hay gaslighting → high_warning
- Si hay daño emocional fuerte → toxic
- No suavices

Responde SOLO JSON:
{ "level": "..." }

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
        title: "No hay señales claras de daño",
        message: "Esto no muestra señales preocupantes claras.",
        recommendation: "Observa cómo te sientes en general eso es lo más importante. ¿Algo más te preocupa?."
      },
      neutral: {
        status: "neutral",
        title: "Puede generar confusión",
        message: "Esto puede generar duda emocional.",
        recommendation: "Mira el contexto completo. ¿Qué más te dice?"
      },
      warning_soft: {
        status: "warning_soft",
        title: "Hay algo que incomoda",
        message: "Aquí ya aparece cierta invalidación.",
        recommendation: "Vale la pena observarlo. ¿Crees que es culpa tuya?"
      },
      warning: {
        status: "warning",
        title: "Empiezan señales de manipulación",
        message: "Aquí ya hay señales de manipulación emocional.",
        recommendation: "No lo ignores. No siempre hay buen intención. ¿Hay otra actitud que te causa duda?"
      },
      high_warning: {
        status: "high_warning",
        title: "Manipulación clara",
        message: "Esto puede hacerte dudar de ti misma.",
        recommendation: "Esto no es menor. ¿Tienes otro ejemplo?"
      },
      toxic: {
        status: "toxic",
        title: "Dinámica dañina",
        message: "Esto ya afecta tu bienestar emocional.",
        recommendation: "Esto es serio. ¿Quieres compartir algo más conmigo?"
      }
    };

    const base = responses[level] || responses.neutral;

    // 🔥 PERSONALIZACIÓN PRO (ENGAGEMENT REAL)
    const personalizationPrompt = `
Una persona escribió:
"${text}"

Nivel detectado: ${level}

Reescribe este mensaje para que:
- sea más personal
- más directo
- más emocional
- haga que la persona quiera seguir hablando

Mensaje base:
${base.message}
`;

    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: personalizationPrompt
      })
    });

    const aiData = await aiResponse.json();

    const personalized =
      aiData.output_text ||
      base.message;

    return res.status(200).json({
      status: base.status,
      title: base.title,
      message: personalized,
      recommendation: base.recommendation
    });

  } catch (error) {
    return res.status(500).json({
      status: "neutral",
      title: "Error",
      message: "No se pudo analizar.",
      recommendation: "Intenta otra vez."
    });
  }
}
