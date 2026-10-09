import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import LoginPage from "@/pages/LoginPage";
import BookRidePage from "@/pages/BookRidePage";
import RidesPage from "@/pages/RidesPage";
import DriversPage from "@/pages/DriversPage";
import OverviewPage from "@/pages/OverviewPage";
import ObservabilityPage from "@/pages/ObservabilityPage";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route index element={<BookRidePage />} />
        <Route path="rides" element={<RidesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="observability" element={<ObservabilityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
