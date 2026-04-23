// Bot System Public API

export * from './models/bot.types';
export { BotEngine, createBotUser } from './core/bot-engine';
export { BotManager } from './core/bot-manager';
export {
  saveBotConfig,
  getBotConfig,
  getAllBotConfigs,
  updateBotConfig,
  deleteBotConfig,
  recordActivity,
  getBotActivities,
  getBotMetrics,
  updateBotMetrics,
  incrementBotMetric,
} from './storage/bot-storage';
export {
  generatePost,
  generatePostForCommunity,
  generateRandomPostContent,
} from './generators/post-generator';
export {
  generateComment,
  generateReplyComment,
  shouldGenerateComment,
  generateCommentCount,
} from './generators/comment-generator';
export {
  generateBotName,
  generateUsername,
  generateBio,
} from './generators/name-generator';
export { POST_TEMPLATES, COMMENT_TEMPLATES, HASHTAGS, INTERESTS } from './generators/templates';
