const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Hidden by default
    },
    name: {
      type: String,
      maxLength: 100,
    },
  },
  { timestamps: true }
);

// Static helper to hash passwords
userSchema.statics.hashPassword = async function (password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Strip passwordHash and versionKey from JSON responses
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
