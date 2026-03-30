export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { text } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        status: "neutral",
        title: "Error de configuración",
        message: "Falta la API key en el servidor.",
        recommendation: "Configura OPENAI_API_KEY en Vercel."
      });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        status: "neutral",
        title: "Texto inválido",
        message: "No se recibió un texto válido para analizar.",
        recommendation: "Escribe un mensaje antes de analizar."
      });
    }

    const prompt = `
Eres un analista de comunicación emocional.

Evalúa si el texto contiene manipulación emocional, gaslighting o invalidación.

Responde SOLO en JSON con este formato:
{
  "status": "warning | neutral | safe",
  "title": "título breve",
  "message": "explicación clara",
  "recommendation": "qué hacer"
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
        title: "Error en el análisis",
        message: data?.error?.message || "No se pudo analizar el texto.",
        recommendation: "Intenta nuevamente en unos segundos."
      });
    }

    const raw =
      data.output?.[0]?.content?.[0]?.text ||
      data.output_text ||
      "";

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        status: "neutral",
        title: "Resultado orientativo",
        message: raw || "No se pudo interpretar el análisis.",
        recommendation: "Toma esto como una orientación inicial."
      };
    }

    return res.status(200).json(parsed);

  } catch (error) {
    return res.status(500).json({
      status: "neutral",
      title: "Error inesperado",
      message: error.message || "Ocurrió un error al analizar.",
      recommendation: "Intenta nuevamente."
    });
  }
}
