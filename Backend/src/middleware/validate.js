const ApiError = require('../utils/apiError');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        next(ApiError.badRequest('Validation failed', error.issues));
      } else {
        next(error);
      }
    }
  };
};

module.exports = validate;
