import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import { SonnerToaster } from "@/components/ui/sonner";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ActiveRide from "./pages/ActiveRide";
import RideRequest from "./pages/RideRequest";
import History from "./pages/History";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const App = () => (
  <>
    <SonnerToaster />
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          
          <Route element={<ProtectedRoute />}>

            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="/ride-request" element={<RideRequest />} />
            <Route path="/ride/:id" element={<ActiveRide />} />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </>
);

export default App;
