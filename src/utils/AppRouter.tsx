import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "../pages/LandingPage";
import SearchPage from "../pages/SearchPage";
import CollectionPage from "../pages/CollectionPage";
import DashboardPage from "../pages/DashboardPage";
import Navbar from "../components/Navbar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const AppRouter: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />*
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default AppRouter;