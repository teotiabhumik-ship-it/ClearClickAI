import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { RouteManager } from './components/RouteManager';
import { AnalysePage } from './pages/AnalysePage';
import { MethodologyPage } from './pages/MethodologyPage';
import { AboutPage } from './pages/AboutPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <RouteManager />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<AnalysePage />} />
            <Route path="methodology" element={<MethodologyPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};
