import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import departmentService from '../../services/departmentService';

export const fetchDepartments = createAsyncThunk(
  'department/fetchDepartments',
  async (params, { rejectWithValue }) => {
    try {
      return await departmentService.listDepartments(params);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch departments.');
    }
  },
);

export const fetchDepartmentById = createAsyncThunk(
  'department/fetchDepartmentById',
  async (id, { rejectWithValue }) => {
    try {
      return await departmentService.getDepartment(id);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to fetch department.');
    }
  },
);

export const createDepartment = createAsyncThunk(
  'department/createDepartment',
  async (data, { rejectWithValue }) => {
    try {
      return await departmentService.createDepartment(data);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to create department.');
    }
  },
);

export const updateDepartment = createAsyncThunk(
  'department/updateDepartment',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      return await departmentService.updateDepartment(id, data);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to update department.');
    }
  },
);

export const deleteDepartment = createAsyncThunk(
  'department/deleteDepartment',
  async (id, { rejectWithValue }) => {
    try {
      await departmentService.deleteDepartment(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to delete department.');
    }
  },
);

export const deleteAllDepartments = createAsyncThunk(
  'department/deleteAllDepartments',
  async (_, { rejectWithValue }) => {
    try {
      return await departmentService.deleteAllDepartments();
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to delete all departments.');
    }
  },
);

export const assignDepartmentManager = createAsyncThunk(
  'department/assignDepartmentManager',
  async ({ departmentId, managerId }, { rejectWithValue }) => {
    try {
      return await departmentService.assignManager(departmentId, managerId);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Failed to assign manager.');
    }
  },
);

export const bulkUploadDepartments = createAsyncThunk(
  'department/bulkUploadDepartments',
  async (formData, { rejectWithValue }) => {
    try {
      return await departmentService.bulkUploadDepartments(formData);
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || 'Bulk upload failed.');
    }
  }
);

const departmentSlice = createSlice({
  name: 'department',
  initialState: {
    departments: [],
    currentDepartment: null,
    loading: false,
    error: null,
    successMessage: null,
  },
  reducers: {
    clearDepartmentError: (state) => {
      state.error = null;
    },
    clearDepartmentSuccess: (state) => {
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchDepartments
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false;
        state.departments = action.payload;
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchDepartmentById
      .addCase(fetchDepartmentById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDepartmentById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentDepartment = action.payload;
      })
      .addCase(fetchDepartmentById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // createDepartment
      .addCase(createDepartment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDepartment.fulfilled, (state, action) => {
        state.loading = false;
        state.departments.push(action.payload);
        state.successMessage = 'Department created successfully!';
      })
      .addCase(createDepartment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // updateDepartment
      .addCase(updateDepartment.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.departments.findIndex((d) => (d._id || d.id) === (action.payload._id || action.payload.id));
        if (index !== -1) {
          state.departments[index] = action.payload;
        }
        if (state.currentDepartment && (state.currentDepartment._id || state.currentDepartment.id) === (action.payload._id || action.payload.id)) {
          state.currentDepartment = action.payload;
        }
        state.successMessage = 'Department updated successfully!';
      })
      .addCase(updateDepartment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // deleteDepartment
      .addCase(deleteDepartment.fulfilled, (state, action) => {
        state.loading = false;
        state.departments = state.departments.filter((d) => (d._id || d.id) !== action.payload);
        state.successMessage = 'Department deleted successfully!';
      })
      .addCase(deleteDepartment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // deleteAllDepartments — only removes the ones the backend actually
      // deleted; departments it skipped (still have active employees) stay
      // in state, since they were reported in action.payload.skipped, not deleted.
      .addCase(deleteAllDepartments.fulfilled, (state, action) => {
        state.loading = false;
        const skippedIds = new Set((action.payload?.skipped || []).map((d) => d.id));
        state.departments = state.departments.filter((d) => skippedIds.has(d._id || d.id));
        const { deletedCount = 0, skippedCount = 0 } = action.payload || {};
        state.successMessage = skippedCount > 0
          ? `Deleted ${deletedCount} department(s). ${skippedCount} skipped (still has active employees).`
          : `Deleted ${deletedCount} department(s).`;
      })
      .addCase(deleteAllDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // bulkUploadDepartments
      .addCase(bulkUploadDepartments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(bulkUploadDepartments.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = `Successfully imported ${action.payload.insertedCount} departments.`;
        if (action.payload.errors && action.payload.errors.length > 0) {
           state.error = `Import finished with warnings/errors: ${action.payload.errors.join(' | ')}`;
        }
      })
      .addCase(bulkUploadDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearDepartmentError, clearDepartmentSuccess } = departmentSlice.actions;
export default departmentSlice.reducer;
