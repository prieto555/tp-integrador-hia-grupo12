const consultarIA = async (req, res) => {
  const { prompt } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // Asegúrate de que 'url' se declare una sola vez con const y no se modifique después
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    // Ojo aquí: asegúrate de que data tenga la estructura esperada antes de acceder
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const textoRespuesta = data.candidates[0].content.parts[0].text;
      return res.json({ respuesta: textoRespuesta });
    } else {
      console.error("Estructura inesperada de Google:", data);
      return res.status(500).json({ error: "Respuesta inesperada de la IA", detalles: data });
    }

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Error al conectar con el endpoint de Google" });
  }
};

module.exports = { consultarIA };