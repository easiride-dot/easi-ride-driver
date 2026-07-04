import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle: string;
  plate_number: string | null;
  status: string;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  driver: Driver | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDriver = async (userId: string) => {
    const { data } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
      
    if (!data) {
      // If the authenticated user is not in the drivers table (e.g. they are a student),
      // we sign them out immediately to prevent them from accessing the driver app.
      await supabase.auth.signOut();
      setDriver(null);
    } else {
      setDriver(data);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchDriver(newSession.user.id);
        } else {
          setDriver(null);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        await fetchDriver(existing.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setDriver(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, driver, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
