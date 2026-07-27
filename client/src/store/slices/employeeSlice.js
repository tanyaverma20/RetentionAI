import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import employeeService from '../../services/employeeService';

export const fetchEmployees = createAsyncThunk(
  'employee/fetchEmployees',
  async (params, { rejectWithValue }) => {
    try {
      return await employeeService.listEmployees(params);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch employees.');
    }
  },
);

export const fetchEmployeeProfile = createAsyncThunk(
  'employee/fetchEmployeeProfile',
  async (id, { rejectWithValue }) => {
    try {
      return await employeeService.getEmployeeProfile(id);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch employee profile.');
    }
  },
);

export const createEmployee = createAsyncThunk(
  'employee/createEmployee',
  async (data, { rejectWithValue }) => {
    try {
      return await employeeService.createEmployee(data);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to create employee.');
    }
  },
);

export const updateEmployee = createAsyncThunk(
  'employee/updateEmployee',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await employeeService.updateEmployee(id, data);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to update employee.');
    }
  },
);

export const softDeleteEmployee = createAsyncThunk(
  'employee/softDeleteEmployee',
  async (id, { rejectWithValue }) => {
    try {
      return await employeeService.softDeleteEmployee(id);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to delete employee.');
    }
  },
);

export const restoreEmployee = createAsyncThunk(
  'employee/restoreEmployee',
  async (id, { rejectWithValue }) => {
    try {
      return await employeeService.restoreEmployee(id);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to restore employee.');
    }
  },
);

export const bulkImportEmployees = createAsyncThunk(
  'employee/bulkImportEmployees',
  async (payload, { rejectWithValue }) => {
    try {
      return await employeeService.bulkImport(payload);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to bulk import employees.');
    }
  },
);

export const fetchEmployee360 = createAsyncThunk(
  'employee/fetchEmployee360',
  async (id, { rejectWithValue }) => {
    try {
      return await employeeService.getEmployee360(id);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch 360 profile.');
    }
  },
);

const employeeSlice = createSlice({
  name: 'employee',
  initialState: {
    employees: [],
    totalItems: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    currentEmployee: null,
    employee360: null,
    filters: {
      search: '',
      departmentId: '',
      designation: '',
      status: '',
      includeDeleted: false,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    loading: false,
    error: null,
    successMessage: null,
    importSummary: null,
  },
  reducers: {
    setFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1;
    },
    resetFilters: (state) => {
      state.filters = {
        search: '',
        departmentId: '',
        designation: '',
        status: '',
        includeDeleted: false,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      state.page = 1;
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    clearEmployeeError: (state) => {
      state.error = null;
    },
    clearEmployeeSuccess: (state) => {
      state.successMessage = null;
      state.importSummary = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchEmployees
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.employees = action.payload.items;
        state.totalItems = action.payload.totalItems;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchEmployeeProfile
      .addCase(fetchEmployeeProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployeeProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.currentEmployee = action.payload;
      })
      .addCase(fetchEmployeeProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // createEmployee
      .addCase(createEmployee.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createEmployee.fulfilled, (state, action) => {
        state.loading = false;
        state.employees.unshift(action.payload);
        state.totalItems += 1;
        state.successMessage = 'Employee created successfully!';
      })
      .addCase(createEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // updateEmployee
      .addCase(updateEmployee.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.employees.findIndex((e) => (e._id || e.id) === (action.payload._id || action.payload.id));
        if (index !== -1) {
          state.employees[index] = action.payload;
        }
        if (state.currentEmployee && (state.currentEmployee._id || state.currentEmployee.id) === (action.payload._id || action.payload.id)) {
          state.currentEmployee = action.payload;
        }
        state.successMessage = 'Employee updated successfully!';
      })
      .addCase(updateEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // softDeleteEmployee
      .addCase(softDeleteEmployee.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.employees.findIndex((e) => (e._id || e.id) === (action.payload._id || action.payload.id));
        if (index !== -1) {
          if (!state.filters.includeDeleted) {
            state.employees.splice(index, 1);
            state.totalItems -= 1;
          } else {
            state.employees[index] = action.payload;
          }
        }
        state.successMessage = 'Employee soft-deleted successfully!';
      })
      .addCase(softDeleteEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // restoreEmployee
      .addCase(restoreEmployee.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.employees.findIndex((e) => (e._id || e.id) === (action.payload._id || action.payload.id));
        if (index !== -1) {
          state.employees[index] = action.payload;
        }
        state.successMessage = 'Employee restored successfully!';
      })
      .addCase(restoreEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // bulkImportEmployees
      .addCase(bulkImportEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bulkImportEmployees.fulfilled, (state, action) => {
        state.loading = false;
        state.importSummary = action.payload;
        state.successMessage = `Import completed! Successfully imported ${action.payload.importedCount} employee(s).`;
      })
      .addCase(bulkImportEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchEmployee360
      .addCase(fetchEmployee360.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.employee360 = null;
      })
      .addCase(fetchEmployee360.fulfilled, (state, action) => {
        state.loading = false;
        state.employee360 = action.payload;
        state.currentEmployee = action.payload.employee;
      })
      .addCase(fetchEmployee360.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setFilter, resetFilters, setPage, clearEmployeeError, clearEmployeeSuccess } = employeeSlice.actions;
export default employeeSlice.reducer;
