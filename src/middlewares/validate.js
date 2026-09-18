const validate =
  (schema, target = 'body') =>
  (req, res, next) => {
    try {
      req[target] = schema.parse(req[target]);
      next();
    } catch (error) {
      next(error);
    }
  };

module.exports = validate;
