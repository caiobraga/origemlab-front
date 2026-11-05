/** Mensagens padrão (pt-BR) exibidas ao usuário em erros comuns. Detalhes técnicos ficam só no console. */
export const USER_MESSAGES = {
  offline: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  unavailable: "Serviço temporariamente indisponível. Tente novamente em instantes.",
  sessionExpired: "Sua sessão expirou. Entre novamente.",
  generic: "Não foi possível concluir a operação. Tente novamente.",
  badResponse: "O servidor enviou uma resposta inesperada. Tente novamente em instantes.",
  chatUnavailable: "O chat não está disponível no momento. Tente novamente mais tarde.",
  /** Mesmo texto do backend para `{ error: "ai_timeout" }` (HTTP 504). */
  aiTimeout: "A IA demorou mais que o esperado. Tente novamente ou divida o texto em partes menores.",
  slowResponse: "A resposta demorou mais que o esperado. Tente novamente.",
  invalidLogin:
    "Não foi possível entrar. Confira email e senha. Se acabou de se cadastrar, confirme o email primeiro (link na caixa de entrada).",
  emailSendFailed: "Não foi possível enviar o e-mail agora. Tente novamente em instantes.",
} as const;
