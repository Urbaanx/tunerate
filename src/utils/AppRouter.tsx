import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "../pages/LandingPage";
import SearchPage from "../pages/SearchPage";
import CollectionPage from "../pages/CollectionPage";
import DashboardPage from "../pages/DashboardPage";
import AlbumDetailsPage from "../pages/AlbumDetailsPage";
import Navbar from "../components/Navbar";
import AuthGuard from "../components/AuthGuard";
import AboutPage from "../pages/AboutPage";
import PrivacyPage from "../pages/PrivacyPage";
import ContactPage from "../pages/ContactPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
      onError: (error) => {
        console.error("Mutation error:", error);
      },
    },
  },
});

const AppRouter: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Navbar />
        <Routes>
          {/* public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="album/:id" element={<AlbumDetailsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* protected routes*/}
          <Route
            path="/collection"
            element={
              <AuthGuard>
                <CollectionPage />
              </AuthGuard>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <DashboardPage />
              </AuthGuard>
            }
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};

export default AppRouter;
