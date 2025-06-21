import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useRef,
} from "react";

export interface User {
  id: number;
  username: string;
  phone_number: string;
  first_name?: string;
  last_name?: string;
  hometown: string;
  interests: string[];
  job: string;
  links: { [key: string]: string };
  school: string;
  latitude?: number;
  longitude?: number;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  updateUserLocation: (latitude: number, longitude: number) => Promise<void>;
  checkContacts: (phoneNumbers: string[]) => Promise<any>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// API base URL - must match the one used in other components
const API_URL = "http://10.0.0.64:8000";

// Minimum time between location updates (in milliseconds)
const MIN_UPDATE_INTERVAL = 30000; // 30 seconds

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Function to update user location with throttling
  const updateUserLocation = async (latitude: number, longitude: number) => {
    if (!user) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    // Skip update if it's too soon after the last one, unless it's the first update
    if (
      lastUpdateTimeRef.current > 0 &&
      timeSinceLastUpdate < MIN_UPDATE_INTERVAL
    ) {
      console.log(
        `Skipping location update, too soon (${timeSinceLastUpdate}ms since last update)`
      );
      return;
    }

    try {
      console.log(`Updating location for user ${user.id}:`, {
        latitude,
        longitude,
      });

      const response = await fetch(`${API_URL}/users/${user.id}/location`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude,
          longitude,
        }),
      });

      console.log("Location update response status:", response.status);

      if (response.ok) {
        // Update last update time on successful update
        lastUpdateTimeRef.current = now;

        setUser({
          ...user,
          latitude,
          longitude,
        });
        console.log("Location updated successfully");
      } else {
        const errorText = await response.text();
        console.error("Failed to update location:", response.status, errorText);
      }
    } catch (error) {
      console.error("Failed to update location:", error);
    }
  };

  // Function to check contacts
  const checkContacts = async (phoneNumbers: string[]) => {
    try {
      const response = await fetch(`${API_URL}/users/contacts/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_numbers: phoneNumbers,
        }),
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error("Failed to check contacts:", response.status);
        return {};
      }
    } catch (error) {
      console.error("Error checking contacts:", error);
      return {};
    }
  };

  return (
    <UserContext.Provider
      value={{ user, setUser, updateUserLocation, checkContacts }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
