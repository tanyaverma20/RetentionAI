import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import authReducer from '../store/slices/authSlice';

function renderWithStore(preloadedState = {}) {
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
        ...preloadedState,
      },
    },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe('Login Component Unit & Integration Tests', () => {
  it('renders login form with all inputs and submit controls', () => {
    renderWithStore();

    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/user@example\.test/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Fill Demo Credentials \(Admin\)/i }),
    ).toBeInTheDocument();
  });

  it('validates empty inputs on submit and displays validation error messages', async () => {
    renderWithStore();

    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Email address is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    });
  });

  it('validates email format and displays error for malformed email', async () => {
    renderWithStore();

    const emailInput = screen.getByPlaceholderText(/user@example\.test/i);
    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i });

    fireEvent.change(emailInput, { target: { value: 'invalid-email-format' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass#123' } });
    fireEvent.submit(submitBtn.closest('form'));

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('renders API error message banner when error is present in Redux state', () => {
    renderWithStore({ error: 'Invalid email or password credentials provided.' });

    expect(
      screen.getByText('Invalid email or password credentials provided.'),
    ).toBeInTheDocument();
  });

  it('displays loading state and disables submit button when authentication is in flight', () => {
    renderWithStore({ isLoading: true });

    const submitBtn = screen.getByRole('button', { name: /Authenticating\.\.\./i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });

  it('populates demo credentials when Admin Demo button is clicked', () => {
    renderWithStore();

    const demoBtn = screen.getByRole('button', { name: /Fill Demo Credentials \(Admin\)/i });
    fireEvent.click(demoBtn);

    const emailInput = screen.getByPlaceholderText(/user@example\.test/i);
    const passwordInput = screen.getByPlaceholderText('••••••••••••');

    expect(emailInput.value).toBe('admin@example.test');
    expect(passwordInput.value).toBe('Admin#12345');
  });
});
