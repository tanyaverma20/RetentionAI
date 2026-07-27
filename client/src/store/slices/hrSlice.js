import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchHrRecords = createAsyncThunk(
  'hr/fetchRecords',
  async ({ collection, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/hr/${collection}`, { params });
      return { collection, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || `Failed to fetch ${collection} records.`);
    }
  },
);

export const createHrRecord = createAsyncThunk(
  'hr/createRecord',
  async ({ collection, data }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/hr/${collection}`, data);
      return { collection, record: response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || `Failed to create ${collection} record.`);
    }
  },
);

export const updateHrRecord = createAsyncThunk(
  'hr/updateRecord',
  async ({ collection, id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/hr/${collection}/${id}`, data);
      return { collection, record: response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || `Failed to update ${collection} record.`);
    }
  },
);

export const deleteHrRecord = createAsyncThunk(
  'hr/deleteRecord',
  async ({ collection, id }, { rejectWithValue }) => {
    try {
      await api.delete(`/hr/${collection}/${id}`);
      return { collection, id };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || `Failed to delete ${collection} record.`);
    }
  },
);

export const bulkImportHrRecords = createAsyncThunk(
  'hr/bulkImport',
  async ({ collection, csvText, records }, { rejectWithValue }) => {
    try {
      const payload = {};
      if (csvText) payload.csvText = csvText;
      if (records) payload.records = records;
      const response = await api.post(`/hr/${collection}/bulk-import`, payload);
      return { collection, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error?.message || `Failed to import ${collection} records.`);
    }
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const hrSlice = createSlice({
  name: 'hr',
  initialState: {
    records: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    activeCollection: 'attendance',
    loading: false,
    error: null,
    successMessage: null,
    importSummary: null,
  },
  reducers: {
    setActiveCollection(state, action) {
      state.activeCollection = action.payload;
      state.records = [];
      state.total = 0;
      state.page = 1;
      state.importSummary = null;
    },
    setHrPage(state, action) {
      state.page = action.payload;
    },
    clearHrError(state) {
      state.error = null;
    },
    clearHrSuccess(state) {
      state.successMessage = null;
      state.importSummary = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchHrRecords
      .addCase(fetchHrRecords.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHrRecords.fulfilled, (state, action) => {
        state.loading = false;
        state.records = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.totalPages = action.payload.totalPages;
      })
      .addCase(fetchHrRecords.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // createHrRecord
      .addCase(createHrRecord.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createHrRecord.fulfilled, (state) => {
        state.loading = false;
        state.successMessage = 'Record created successfully.';
      })
      .addCase(createHrRecord.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // updateHrRecord
      .addCase(updateHrRecord.fulfilled, (state) => {
        state.loading = false;
        state.successMessage = 'Record updated successfully.';
      })
      // deleteHrRecord
      .addCase(deleteHrRecord.fulfilled, (state, action) => {
        state.records = state.records.filter((r) => (r._id || r.id) !== action.payload.id);
        state.successMessage = 'Record deleted successfully.';
      })
      // bulkImportHrRecords
      .addCase(bulkImportHrRecords.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.importSummary = null;
      })
      .addCase(bulkImportHrRecords.fulfilled, (state, action) => {
        state.loading = false;
        state.importSummary = action.payload.data;
        state.successMessage = `Import completed! Successfully imported ${action.payload.data.importedCount} record(s).`;
      })
      .addCase(bulkImportHrRecords.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setActiveCollection, setHrPage, clearHrError, clearHrSuccess } = hrSlice.actions;
export default hrSlice.reducer;
