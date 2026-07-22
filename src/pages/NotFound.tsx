import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Car } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary shadow-soft">
          <Car className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-display font-bold mb-4">404</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Oops! This route doesn't exist.
        </p>
        <Link 
          to="/dashboard" 
          className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
