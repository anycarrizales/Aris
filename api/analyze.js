import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const text = body?.text;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Texto inválido" });
    }

    const prompt = `
Eres un analista de comunicación emocional orientado a educación y prevención.

Analiza el siguiente mensaje o diálogo y evalúa si contiene:
- manipulación emocional
- invalidación emocional
- culpa inducida
- gaslighting
- control disfrazado de calma o amor

No diagnostiques personas.
No afirmes abuso como certeza por un solo mensaje.
Habla con claridad, empatía y firmeza.

Devuelve JSON exacto con este formato:
{
  "status": "warning | neutral | safe",
  "title": "título breve",
  "message": "explicación breve en lenguaje claro",
  "recommendation": "una recomendación emocional concreta"
}

Texto:
"""${text}"""
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt
    });

    const raw = response.output_text;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        status: "neutral",
        title: "Resultado orientativo",
        message: raw,
        recommendation: "Toma este análisis como una orientación inicial."
      };
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error("ERROR EN /api/analyze:", error);

    return res.status(500).json({
      error: error?.message || "Error interno al analizar el texto"
    });
  }
}
