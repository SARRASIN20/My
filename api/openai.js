class OpenAIService {
  constructor() {
    this.API_KEY = 'VOTRE_CLÉ_API';
    this.API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
  }

  async analyzeCommand(userCommand) {
    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "user",
            content: userCommand
          }],
          temperature: 0.7
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      throw new Error('Erreur lors de l\'analyse de la commande');
    }
  }
}

export default new OpenAIService(); 