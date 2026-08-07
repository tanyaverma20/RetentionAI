import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    features: [
      {
        featureKey: String,
        displayName: String,
        shapValue: Number,
      }
    ],
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const GlobalFeatureImportance = mongoose.model('GlobalFeatureImportance', schema);
