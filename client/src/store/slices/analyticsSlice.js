import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import analyticsService from '../../services/analyticsService';

export const fetchDashboardSummary = createAsyncThunk(
  'analytics/fetchDashboardSummary',
  async (params, { rejectWithValue }) => {
    try {
      return await analyticsService.getDashboardSummary(params);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch dashboard summary metrics.',
      );
    }
  },
);

export const fetchKpis = createAsyncThunk(
  'analytics/fetchKpis',
  async (params, { rejectWithValue }) => {
    try {
      return await analyticsService.getKpis(params);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch KPI metrics.',
      );
    }
  },
);

export const fetchDepartmentStats = createAsyncThunk(
  'analytics/fetchDepartmentStats',
  async (params, { rejectWithValue }) => {
    try {
      return await analyticsService.getDepartmentStats(params);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch department statistics.',
      );
    }
  },
);

export const fetchMonthlyTrends = createAsyncThunk(
  'analytics/fetchMonthlyTrends',
  async (params, { rejectWithValue }) => {
    try {
      return await analyticsService.getMonthlyTrends(params);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch monthly trends.',
      );
    }
  },
);

export const fetchAiFeatureImportance = createAsyncThunk(
  'analytics/fetchAiFeatureImportance',
  async (params, { rejectWithValue }) => {
    try {
      return await analyticsService.getAiFeatureImportance(params);
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error?.message || 'Failed to fetch AI feature importance.',
      );
    }
  },
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    kpis: null,
    departmentStats: [],
    demographics: {
      byDepartment: [],
      byGender: [],
      byEmploymentType: [],
      experienceDistribution: [],
    },
    monthlyTrends: [],
    insights: {
      recentHires: [],
      recentlyAdded: [],
      upcomingAnniversaries: [],
      upcomingBirthdays: [],
    },
    advancedCharts: {
      performanceDistribution: [],
      leaveStatistics: [],
      advancedTrends: [],
    },
    userScope: null,
    filters: {
      departmentId: '',
      employmentType: '',
      startDate: '',
      endDate: '',
      search: '',
    },
    aiGlobalImportance: null,
    aiLoading: false,
    aiError: null,
    loading: false,
    error: null,
  },
  reducers: {
    setAnalyticsFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetAnalyticsFilters: (state) => {
      state.filters = {
        departmentId: '',
        employmentType: '',
        startDate: '',
        endDate: '',
        search: '',
      };
    },
    clearAnalyticsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchDashboardSummary
      .addCase(fetchDashboardSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.kpis = action.payload.kpis;
        state.departmentStats = action.payload.departmentStats;
        state.demographics = action.payload.demographics;
        state.monthlyTrends = action.payload.monthlyTrends;
        state.insights = action.payload.insights;
        state.advancedCharts = action.payload.advancedCharts;
        state.userScope = action.payload.userScope;
      })
      .addCase(fetchDashboardSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchKpis
      .addCase(fetchKpis.fulfilled, (state, action) => {
        state.kpis = action.payload;
      })
      // fetchDepartmentStats
      .addCase(fetchDepartmentStats.fulfilled, (state, action) => {
        state.departmentStats = action.payload;
      })
      // fetchAiFeatureImportance
      .addCase(fetchAiFeatureImportance.pending, (state) => {
        state.aiLoading = true;
        state.aiError = null;
      })
      .addCase(fetchAiFeatureImportance.fulfilled, (state, action) => {
        state.aiLoading = false;
        state.aiGlobalImportance = action.payload;
      })
      .addCase(fetchAiFeatureImportance.rejected, (state, action) => {
        state.aiLoading = false;
        state.aiError = action.payload;
      });
  },
});

export const { setAnalyticsFilter, resetAnalyticsFilters, clearAnalyticsError } = analyticsSlice.actions;
export default analyticsSlice.reducer;
