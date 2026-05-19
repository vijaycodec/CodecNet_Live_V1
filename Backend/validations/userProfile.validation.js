import Joi from 'joi';

export const profileUpdateSchema = Joi.object({
  firstName: Joi.string().min(2).max(30).optional(),
  lastName: Joi.string().min(2).max(30).optional(),
  clientName: Joi.string().min(2).max(50).optional(),
  phoneNumber: Joi.string().pattern(/^\d{10}$/).optional(), // adjust regex for your phone format
});