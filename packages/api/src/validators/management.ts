import Joi from 'joi';
import { FEATURE_FLAGS } from '@feature-flag/core';

const flagKeySchema = Joi.string().valid(...Object.values(FEATURE_FLAGS)).required();

export const flagRequestSchema = Joi.object({
  flagKey: flagKeySchema,
  description: Joi.string().min(1).max(500).required(),
  defaultEnabled: Joi.boolean().default(false),
  owner: Joi.string().min(1).max(100).optional(),
  expiresAt: Joi.string().isoDate().optional(),
});

export function validateFlagRequest(data: any) {
  return flagRequestSchema.validate(data, { abortEarly: false });
}

export const flagUpdateSchema = Joi.object({
  description: Joi.string().min(1).max(500).optional(),
  defaultEnabled: Joi.boolean().optional(),
  owner: Joi.string().min(1).max(100).optional(),
  expiresAt: Joi.string().isoDate().optional(),
}).min(1); // 最低1つのフィールドが必要

export function validateFlagUpdate(data: any) {
  return flagUpdateSchema.validate(data, { abortEarly: false });
}

export const tenantOverrideRequestSchema = Joi.object({
  enabled: Joi.boolean().required(),
  updatedBy: Joi.string().min(1).max(100).required(),
});

export function validateTenantOverrideRequest(data: any) {
  return tenantOverrideRequestSchema.validate(data, { abortEarly: false });
}

export const killSwitchRequestSchema = Joi.object({
  flagKey: flagKeySchema.optional(),
  reason: Joi.string().min(1).max(500).required(),
  activatedBy: Joi.string().min(1).max(100).required(),
});

export function validateKillSwitchRequest(data: any) {
  return killSwitchRequestSchema.validate(data, { abortEarly: false });
}

export const killSwitchDeactivateSchema = Joi.object({
  flagKey: flagKeySchema.optional(),
  deactivatedBy: Joi.string().min(1).max(100).required(),
});

export function validateKillSwitchDeactivate(data: any) {
  return killSwitchDeactivateSchema.validate(data, { abortEarly: false });
}