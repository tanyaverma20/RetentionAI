import { Attendance } from '../models/Attendance.js';
import { Performance } from '../models/Performance.js';
import { Survey } from '../models/Survey.js';
import { EmployeeFeedback } from '../models/EmployeeFeedback.js';
import { ManagerNote } from '../models/ManagerNote.js';
import { TrainingHistory } from '../models/TrainingHistory.js';
import { PromotionHistory } from '../models/PromotionHistory.js';

class HrRepository {
  getModel(collectionName) {
    switch (collectionName) {
      case 'attendance':
        return Attendance;
      case 'performance':
        return Performance;
      case 'surveys':
        return Survey;
      case 'feedback':
        return EmployeeFeedback;
      case 'notes':
        return ManagerNote;
      case 'training':
        return TrainingHistory;
      case 'promotions':
        return PromotionHistory;
      default:
        throw new Error('Invalid collection name');
    }
  }

  async create(collectionName, data) {
    const Model = this.getModel(collectionName);
    const record = new Model(data);
    return record.save();
  }

  async findById(collectionName, organizationId, id) {
    const Model = this.getModel(collectionName);
    return Model.findOne({ _id: id, organizationId });
  }

  async update(collectionName, organizationId, id, data) {
    const Model = this.getModel(collectionName);
    return Model.findOneAndUpdate({ _id: id, organizationId }, data, { new: true, runValidators: true });
  }

  async delete(collectionName, organizationId, id) {
    const Model = this.getModel(collectionName);
    return Model.findOneAndDelete({ _id: id, organizationId });
  }

  async findMany(collectionName, organizationId, query = {}, options = {}) {
    const Model = this.getModel(collectionName);
    const { page = 1, limit = 10, sort = '-createdAt' } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Model.find({ organizationId, ...query })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments({ organizationId, ...query }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

export const hrRepository = new HrRepository();
