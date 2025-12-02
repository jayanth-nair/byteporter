import { render, screen } from '@testing-library/react';
import App from './App';

// Mock axios to prevent network requests and ESM issues
jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { exists: true } })),
  post: jest.fn(),
}));

// Mock react-router-dom to avoid ESM resolution issues in Jest
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: () => <div>Route</div>,
  Link: ({ children }) => <a href="/">{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
}), { virtual: true });

// Mock contexts
jest.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: null, token: null, logout: jest.fn() }),
}));

jest.mock('./context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
  ThemeProvider: ({ children }) => <div>{children}</div>,
}));

test('renders BytePorter header', async () => {
  render(<App />);
  const headerElement = await screen.findByText(/BytePorter/i);
  expect(headerElement).toBeInTheDocument();
});
