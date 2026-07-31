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

const Explanation = mongoose.model('Explanation', explanationSchema);

export default Explanation;
