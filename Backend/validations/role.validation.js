import Joi from 'joi';

export const roleSchema = Joi.object({
  name: Joi.string().required(),
  permissions: Joi.array().items(Joi.string())
});a