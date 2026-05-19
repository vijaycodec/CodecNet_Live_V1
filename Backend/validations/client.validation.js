import Joi from 'joi';

const clientSchema = Joi.object({
  user: Joi.string().required(),

  wazuhCredentials: Joi.object({
    host: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required()
  }).required(),

  indexerCredentials: Joi.object({
    host: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required()
  }).required(),

  is_active: Joi.boolean()
});

export default clientSchema;
