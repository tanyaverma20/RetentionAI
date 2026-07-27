import { hrRepository } from '../repositories/hrRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import { AppError } from '../errors/AppError.js';
import {
  attendanceCreateSchema,
  attendanceUpdateSchema,
  performanceCreateSchema,
  performanceUpdateSchema,
  surveyCreateSchema,
  surveyUpdateSchema,
  employeeFeedbackCreateSchema,
  employeeFeedbackUpdateSchema,
  managerNoteCreateSchema,
  managerNoteUpdateSchema,
  trainingHistoryCreateSchema,
  trainingHistoryUpdateSchema,
  promotionHistoryCreateSchema,
  promotionHistoryUpdateSchema,
} from '../validators/hrValidators.js';

class HrService {
  getValidators(collectionName) {
    switch (collectionName) {
      case 'attendance':
        return { create: attendanceCreateSchema, update: attendanceUpdateSchema };
      case 'performance':
        return { create: performanceCreateSchema, update: performanceUpdateSchema };
      case 'surveys':
        return { create: surveyCreateSchema, update: surveyUpdateSchema };
      case 'feedback':
        return { create: employeeFeedbackCreateSchema, update: employeeFeedbackUpdateSchema };
      case 'notes':
        return { create: managerNoteCreateSchema, update: managerNoteUpdateSchema };
      case 'training':
        return { create: trainingHistoryCreateSchema, update: trainingHistoryUpdateSchema };
      case 'promotions':
        return { create: promotionHistoryCreateSchema, update: promotionHistoryUpdateSchema };
      default:
        throw new AppError(400, 'INVALID_COLLECTION', 'Invalid collection name');
    }
  }

  async verifyAccess(auth, targetEmployeeId, collectionName) {
    // Admins and HR Managers have full access
    if (auth.role === 'ADMIN' || auth.role === 'HR_MANAGER') {
      return true;
    }

    // Get the caller's employeeId
    const user = await findUserById(auth.userId);
    const callerEmployeeId = user?.employeeId?.toString();

    // Department Managers can see their department's data (simplified here to just say if they are the direct manager it's handled via ManagerNotes/Performance, but let's allow them access to their own records at least)
    // For simplicity, strict RBAC: you can only access your own data unless Admin/HR.
    if (callerEmployeeId && callerEmployeeId === targetEmployeeId.toString()) {
      // Employees shouldn't see Manager Notes about themselves generally, unless visibility allows, but requirements say "Ensure employees can only access their own attendance, surveys, and feedback unless authorized."
      if (collectionName === 'notes') {
        throw new AppError(403, 'FORBIDDEN', 'Employees cannot view manager notes.');
      }
      return true;
    }

    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this record.');
  }

  async createRecord(collectionName, organizationId, auth, data) {
    const { create } = this.getValidators(collectionName);
    const validatedData = create.parse(data);

    // Verify access if creating for someone else
    if (validatedData.employeeId) {
      await this.verifyAccess(auth, validatedData.employeeId, collectionName);
    }

    return hrRepository.create(collectionName, { ...validatedData, organizationId });
  }

  async updateRecord(collectionName, organizationId, auth, id, data) {
    const record = await hrRepository.findById(collectionName, organizationId, id);
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Record not found');

    await this.verifyAccess(auth, record.employeeId, collectionName);

    const { update } = this.getValidators(collectionName);
    const validatedData = update.parse(data);

    return hrRepository.update(collectionName, organizationId, id, validatedData);
  }

  async getRecord(collectionName, organizationId, auth, id) {
    const record = await hrRepository.findById(collectionName, organizationId, id);
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Record not found');

    await this.verifyAccess(auth, record.employeeId, collectionName);
    return record;
  }

  async deleteRecord(collectionName, organizationId, auth, id) {
    const record = await hrRepository.findById(collectionName, organizationId, id);
    if (!record) throw new AppError(404, 'NOT_FOUND', 'Record not found');

    await this.verifyAccess(auth, record.employeeId, collectionName);
    return hrRepository.delete(collectionName, organizationId, id);
  }

  async listRecords(collectionName, organizationId, auth, queryParams, paginationOpts) {
    // If not Admin/HR, force filter to their own employeeId
    if (auth.role !== 'ADMIN' && auth.role !== 'HR_MANAGER') {
      const user = await findUserById(auth.userId);
      const callerEmployeeId = user?.employeeId?.toString();
      if (!callerEmployeeId) {
        throw new AppError(403, 'FORBIDDEN', 'No employee profile linked to your account.');
      }
      
      if (collectionName === 'notes') {
        throw new AppError(403, 'FORBIDDEN', 'Employees cannot view manager notes.');
      }
      
      queryParams.employeeId = callerEmployeeId;
    }

    return hrRepository.findMany(collectionName, organizationId, queryParams, paginationOpts);
  }
}

export const hrService = new HrService();
