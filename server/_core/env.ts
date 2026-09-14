export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  huggingfaceApiUrl: process.env.HUGGINGFACE_API_URL ?? "https://router.huggingface.co/v1/chat/completions",
  huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY ?? "",
  huggingfaceModel: process.env.HUGGINGFACE_MODEL ?? "Qwen/Qwen3.8-27B",
  openrouterApiUrl: process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions",
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterModel: process.env.OPENROUTER_MODEL ?? "mistralai/mistral-small-3.1-24b-instruct",
};

