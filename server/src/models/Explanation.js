import mongoose from 'mongoose';

const explanationSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    // Optional back-reference. An explanation is generated from the live SHAP
    // computation, which carries its own riskScore/riskLevel — it does not
    // depend on a stored Prediction document existing. Marking this required
    // made every explanation unsaveable whenever /predict/batch hadn't been run
    // first, and (because explainService inserts with `ordered: false`) the
    // whole batch was dropped silently instead of erroring.
    predictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prediction',
      default: null,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    topPositiveFactors: [
      {
        feature: String,
        displayName: String,
        // Mixed, not Number — raw feature values are legitimately strings
        // for categorical features (department, gender, designation, work
        // location), not just numeric ones.
        value: mongoose.Schema.Types.Mixed,
        formattedValue: String,
        shapValue: Number,
      }
    ],
    topNegativeFactors: [
      {
        feature: String,
        displayName: String,
        value: mongoose.Schema.Types.Mixed,
        formattedValue: String,
        shapValue: Number,
      }
    ],
    shapValues: {
      type: Map,
      of: Number,
    },
    summary: {
      type: String,
    },
    baseValue: {
      type: Number,
    },
    riskScore: {
      type: Number,
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
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

// Matches the two "latest explanation for this employee" lookups in
// explainService.js (the cache check in explainSingle and
// getStoredExplanation), both of which do
// `findOne({ employeeId }).sort({ generatedAt: -1 })` — the same query
// shape Decision.js/EmployeeIntelligence.js already index for their own
// insert-per-generation history pattern.
explanationSchema.index({ employeeId: 1, generatedAt: -1 });

const Explanation = mongoose.model('Explanation', explanationSchema);

export default Explanation;
