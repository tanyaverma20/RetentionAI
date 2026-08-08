import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    // Field names match ai-service/app/explainability/global_explainer.py's
    // compute_global_importance() exactly: featureKey, displayName,
    // meanAbsShap, rank. This schema previously declared `shapValue`,
    // which the ai-service response never sends (it sends `meanAbsShap`) —
    // Mongoose silently drops undeclared fields on subdocuments, so even
    // after fixing the "whole object as features" bug below, a cached
    // read still lost `meanAbsShap`/`rank` on every write, and
    // GlobalFeatureImportanceChart (dataKey="meanAbsShap", sorted by
    // `rank`) would have rendered every bar as empty/unsorted from cache.
    features: [
      {
        featureKey: String,
        displayName: String,
        meanAbsShap: Number,
        rank: Number,
      }
    ],
    // Deterministic, template-based plain-English summary of the ranking
    // above — see ai-service/app/explainability/global_explainer.py's
    // build_global_narrative(). Added alongside a fix for a real bug where
    // this whole document's `features` array was being persisted as
    // [{ _id: <auto> }] (the entire API response object mis-assigned to
    // this field, cast into a 1-element array with none of its real
    // properties) — every cached read silently returned empty data.
    narrative: {
      type: String,
      default: '',
    },
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
