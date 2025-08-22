import Joi from 'joi';
import { FEATURE_FLAGS } from '@feature-flag/core';

const flagKeySchema = Joi.string()
  .valid(...Object.values(FEATURE_FLAGS))
  .required();

export const evaluationRequestSchema = Joi.object({
  tenantId: Joi.string().min(1).max(100).required(),
  flagKey: flagKeySchema,
  userId: Joi.string().min(1).max(100).optional(),
  environment: Joi.string().valid('development', 'staging', 'production').optional(),
  metadata: Joi.object().optional(),
});

export function validateEvaluationRequest(data: any) {
  return evaluationRequestSchema.validate(data, { abortEarly: false });
}

export const batchEvaluationRequestSchema = Joi.object({
  tenantId: Joi.string().min(1).max(100).required(),
  flagKeys: Joi.array().items(flagKeySchema).min(1).max(50).required(),
  userId: Joi.string().min(1).max(100).optional(),
  environment: Joi.string().valid('development', 'staging', 'production').optional(),
  metadata: Joi.object().optional(),
});

export function validateBatchEvaluationRequest(data: any) {
  return batchEvaluationRequestSchema.validate(data, { abortEarly: false });
}
