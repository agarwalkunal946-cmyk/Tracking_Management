export const schemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(_document, result) {
      result.id = result._id.toString();
      delete result._id;
      delete result.__v;
      return result;
    }
  },
  toObject: { virtuals: true }
};
