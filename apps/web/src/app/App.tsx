import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './AppShell';
import { ThemeProvider } from './ThemeProvider';
import { RouteFallback } from '../components/RouteFallback';
import { AppErrorBoundary } from './AppErrorBoundary';
import { ApiProblem } from '../api/client';

const ChooseCityRoute = lazy(() => import('../routes/ChooseCityRoute'));
const EventDetailRoute = lazy(() => import('../routes/EventDetailRoute'));
const ExploreRoute = lazy(() => import('../routes/ExploreRoute'));
const SavedRoute = lazy(() => import('../routes/SavedRoute'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiProblem && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 60_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<ChooseCityRoute />} />
                  <Route path="bengaluru" element={<ExploreRoute city="bengaluru" />} />
                  <Route path="varanasi" element={<ExploreRoute city="varanasi" />} />
                  <Route path="events/:occurrenceId/:slug?" element={<EventDetailRoute />} />
                  <Route path="saved" element={<SavedRoute />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AppErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
