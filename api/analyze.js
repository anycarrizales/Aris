export default async function handler(req, res) {
  try {
    return res.status(200).json({
      ok: true,
      method: req.method,
      hasKey: !!process.env.OPENAI_API_KEY
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
}
