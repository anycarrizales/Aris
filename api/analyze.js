export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "neutral",
      title: "Método no permitido",
      message: "Esta ruta solo acepta POST.",
      recommendation: "Envía el texto desde el formulario."
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const text = body?.text;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        status: "neutral",
        title: "Falta configuración",
        message: "No se encontró OPENAI_API_KEY en Vercel.",
        recommendation: "Agrega la variable en Settings > Environment Variables."
      });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        status: "neutral",
        title: "Texto inválido",
        message: "No se recibió un texto válido para analizar.",
        recommendation: "Pega una conversación antes de analizar."
      });
    }

    const prompt = `
Eres un analista de comunicación emocional.

Evalúa si el texto contiene:
- manipulación emocional
- invalidación emocional
- culpa inducida
- gaslighting
- control disfrazado de calma o amor

No diagnostiques personas.
No afirmes abuso como certeza por un solo mensaje.
Habla con claridad, empatía y firmeza.

Responde SOLO con JSON válido en este formato exacto:
{
  "status": "warning | neutral | safe",
  "title": "título breve",
  "message": "explicación breve y clara",
  "recommendation": "recomendación emocional concreta"
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
      parsed = {
        status: "neutral",
        title: "Resultado orientativo",
        message: raw || "No se pudo interpretar la respuesta del análisis.",
        recommendation: "Intenta nuevamente o revisa el prompt."
      };
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({
      status: "neutral",
      title: "Error inesperado",
      message: error.message || "Ocurrió un error interno.",
      recommendation: "Intenta nuevamente en unos segundos."
    });
  }
}
