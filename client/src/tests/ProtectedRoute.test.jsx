import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import authReducer from '../store/slices/authSlice';

function renderProtectedRoute(authState = {}, allowedRoles = null) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
        error: null,
        ...authState,
      },
    },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page Mock</div>} />
          <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
            <Route path="/protected" element={<div>Protected Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('ProtectedRoute Component Routing & RBAC Tests', () => {
  it('redirects unauthenticated users to /login', () => {
    renderProtectedRoute({ isAuthenticated: false, user: null });

    expect(screen.getByText('Login Page Mock')).toBeInTheDocument();
    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
  });

  it('renders loading spinner when auth is initializing', () => {
    const { container } = renderProtectedRoute({ isInitializing: true });

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
  });

  it('allows access to protected route when user is authenticated with no role restriction', () => {
    renderProtectedRoute({
      isAuthenticated: true,
      user: { id: 'u1', name: 'John Doe', role: 'EMPLOYEE' },
    });

    expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
  });

  it('allows access when user role matches allowedRoles restriction', () => {
    renderProtectedRoute(
      {
        isAuthenticated: true,
        user: { id: 'u2', name: 'Admin Jane', role: 'ADMIN' },
      },
      ['ADMIN', 'HR_MANAGER'],
    );

    expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
  });

  it('displays 403 Access Denied when user role is not in allowedRoles', () => {
    renderProtectedRoute(
      {
        isAuthenticated: true,
        user: { id: 'u3', name: 'Bob Employee', role: 'EMPLOYEE' },
      },
      ['ADMIN', 'HR_MANAGER'],
    );

    expect(screen.getByText(/Access Denied \(403\)/i)).toBeInTheDocument();
    expect(screen.getByText('EMPLOYEE')).toBeInTheDocument();
    expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
  });
});
