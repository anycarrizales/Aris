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
    const text = body?.text?.trim();

    const lowerText = text.toLowerCase();

const physicalViolencePatterns = [
  "me pegó",
  "me pego",
  "me golpeó",
  "me golpeo",
  "me dio una cachetada",
  "me dio una bofetada",
  "me empujó",
  "me empujo",
  "me jaló",
  "me jalo",
  "me agarró del cuello",
  "me agarro del cuello",
  "me lanzó",
  "me lanzo",
  "me aventó",
  "me avento",
  "me tiró al piso",
  "me tiro al piso",
  "me lastimó",
  "me lastimo",
  "me agredió",
  "me agredio",
  "me dio un puñetazo",
  "me dio un golpe",
  "me dio en la cara"
];

if (physicalViolencePatterns.some(pattern => lowerText.includes(pattern))) {
  return res.status(200).json({
    status: "toxic",
    title: "Hay señales de una dinámica gravemente dañina",
    message: `Lo que compartes incluye agresión física. Eso no entra en la categoría de “señales poco claras”.

Aunque después haya disculpas, promesas o explicaciones, que alguien te golpee, te empuje o te lastime físicamente es una señal grave y debe tomarse en serio.

No estás exagerando. Y no necesitas minimizar lo ocurrido para que tu dolor sea válido.`,
    recommendation: `Si algo así pasó, no lo normalices. No es culpa tuya por ninguna razón. Busca ayuda profesional y si necesitas comprender mejor estas dinámicas y empezar a recuperar tu claridad, mi libro Manual para reconocer un Idiota puede ayudarte a detectar patrones de manipulación y maltrato con más precisión.`
  });
}

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

    const prompt = `
Eres un analista de comunicación emocional con enfoque en relaciones y experto en comportamientos narcisistas, que sabes reconocer los términos y comportamientos de manipúlación que usan. Vas a analizar lo que le dijo su pareja a esta persona.

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
- es contradictorio en su discurso
- te culpa de todo

warning:
- culpa a la otra persona por sentir
- contradicciones
- exigencias injustas
- control emocional sutil
- manipulación emocional visible
- burla en público

high_warning:
- gaslighting
- hace dudar de la memoria o de la percepción
- hace sentir que el problema siempre es la otra persona
- desgaste emocional fuerte
- humillación

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
        recommendation: `Si en algún momento comienzas a dudar de ti, a sentirte pequeña o a justificar demasiado lo que te duele, vale la pena prestar atención. En mi libro Manual para reconocer un Idiota explico cómo identificar señales sutiles antes de que escalen.`
      },

      neutral: {
        status: "neutral",
        title: "Hay señales ambiguas que conviene observar",
        message: `Lo que describes no es concluyente por sí solo, pero sí puede generar confusión emocional.

A veces la manipulación no empieza de forma evidente. Puede disfrazarse de cariño, de preocupación o de un simple malentendido, y por eso cuesta tanto reconocerla al principio.

Tu incomodidad no es exagerada solo porque todavía no tengas todas las respuestas.`,
        recommendation: `Observa si este tipo de mensajes o actitudes se repiten y si te hacen dudar de tu percepción. Si quieres entender mejor estos primeros indicios, en mi libro Manual para reconocer un Idiota te ayudo a ver lo que al inicio cuesta nombrar.`
      },

      warning_soft: {
        status: "warning_soft",
        title: "Hay indicios de invalidación emocional",
        message: `Lo que compartes puede ser una forma de invalidación emocional.

No siempre el maltrato comienza con violencia evidente. Muchas veces empieza haciendo que dudes de lo que sientes, de lo que recuerdas o de si tienes derecho a molestarte.

Si notas que te explicas demasiado, que minimizas tu malestar o que terminas pensando que todo es culpa tuya, esa señal merece atención.`,
        recommendation: `No estás exagerando. Aprender a detectar estas dinámicas a tiempo puede ahorrarte mucho dolor. En mi libro Manual para reconocer un Idiota explico estos patrones con claridad para ayudarte a identificarlos antes de que escalen.`
      },

      warning: {
        status: "warning",
        title: "Se observan señales de manipulación emocional",
        message: `Aquí ya aparecen señales de manipulación emocional.

Puede manifestarse como culpa, contradicciones, exigencias injustas o comportamientos que te hacen sentir responsable de todo. Estas dinámicas no siempre son escandalosas, pero sí desgastan tu seguridad, tu claridad y tu autoestima con el tiempo.

No es fácil verlo cuando estás dentro de la relación.`,
        recommendation: `Si te sientes confundida, cansada o emocionalmente inestable, eso ya es una señal importante. En mi libro Manual para reconocer un Idiota te explico cómo funcionan estos patrones para que puedas verlos con más claridad y dejar de justificar lo injustificable.`
      },

      high_warning: {
        status: "high_warning",
        title: "Hay señales claras de manipulación emocional",
        message: `Lo que describes muestra señales claras de manipulación emocional.

Este tipo de dinámicas puede hacerte dudar de tu propia realidad, de tu memoria o incluso de tu valor. A veces la manipulación no grita: se instala lentamente hasta que ya no sabes si el problema es la otra persona o si eres tú.

Nada de eso es casual.`,
        recommendation: `Si te sientes así, no estás sola. Entender lo que está pasando es el primer paso para recuperar tu claridad. En mi libro Manual para reconocer un Idiota te explico exactamente cómo operan estos patrones y cómo empezar a verlos sin culpa ni confusión.`
      },

      toxic: {
        status: "toxic",
        title: "Hay señales de una dinámica emocionalmente dañina",
        message: `Lo que compartes muestra señales de una dinámica emocionalmente dañina.

Cuando aparece el miedo, la presión, la coerción o la sensación de no poder decir "no" con seguridad, ya no estamos hablando solo de diferencias o conflictos normales dentro de una relación. Estamos frente a algo que puede afectar profundamente tu bienestar emocional.

Tu cuerpo suele notarlo antes que tu mente. Por eso la incomodidad importa.`,
        recommendation: `No necesitas tener pruebas perfectas para validar lo que sientes. No estás sola. Si necesitas comprender mejor lo que estás viviendo y empezar a recuperar claridad, mi libro Manual para reconocer un Idiota puede orientarte a detectar estas formas de manipulación y maltrato emocional con más precisión.`
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
