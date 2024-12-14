export const CONFIG = {
  API: {
    ENDPOINT: 'https://api.openai.com/v1/chat/completions',
    MODEL: 'gpt-3.5-turbo'
  },
  STORAGE_KEYS: {
    API_KEY: 'openaiKey',
    SETTINGS: 'settings'
  },
  COMMANDS: {
    FILL: 'remplir',
    EXTRACT: 'extraire'
  }
};

export const MESSAGES = {
  ERRORS: {
    NO_API_KEY: 'Clé API OpenAI non configurée',
    INVALID_COMMAND: 'Commande non reconnue',
    NO_FIELDS_FILLED: 'Aucun champ n\'a pu être rempli',
    API_ERROR: 'Erreur API OpenAI',
    INVALID_RESPONSE: 'Format de réponse invalide de l\'API'
  },
  SUCCESS: {
    FORM_FILLED: 'Formulaire rempli avec succès',
    SETTINGS_SAVED: 'Paramètres sauvegardés avec succès'
  }
}; 