import { Employee } from '../models/Employee.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

export async function globalSearch(request, response, next) {
  try {
    const { q, limit = 10 } = request.query;

    if (!q || q.length < 2) {
      return sendSuccess(response, 200, { results: [] }, request.requestId);
    }

    const searchRegex = new RegExp(q, 'i');

    const results = await Employee.find({
      isDeleted: false,
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { employeeCode: searchRegex },
        { designation: searchRegex },
        { email: searchRegex },
        { status: searchRegex }
      ]
    })
      .populate('departmentId', 'name code')
      .populate('managerId', 'firstName lastName')
      .limit(Number(limit))
      .lean();

    const formattedResults = results.map(emp => ({
      _id: emp._id,
      name: `${emp.firstName} ${emp.lastName}`,
      employeeCode: emp.employeeCode,
      department: emp.departmentId?.name || 'Unassigned',
      designation: emp.designation,
      email: emp.email,
      status: emp.status,
      manager: emp.managerId ? `${emp.managerId.firstName} ${emp.managerId.lastName}` : 'None',
      profilePicture: emp.profilePicture
    }));

    return sendSuccess(response, 200, { results: formattedResults }, request.requestId);
  } catch (error) {
    return next(error);
  }
}
