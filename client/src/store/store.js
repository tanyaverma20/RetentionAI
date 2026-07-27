import { configureStore } from '@reduxjs/toolkit';
import analyticsReducer from './slices/analyticsSlice';
import authReducer from './slices/authSlice';
import departmentReducer from './slices/departmentSlice';
import employeeReducer from './slices/employeeSlice';
import hrReducer from './slices/hrSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    department: departmentReducer,
    employee: employeeReducer,
    analytics: analyticsReducer,
    hr: hrReducer,
  },
});
