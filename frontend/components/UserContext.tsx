import React, { createContext, useContext, useState, ReactNode } from "react";

export interface User {
  id: number;
  username: string;
  email: string;
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
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// API base URL - must match the one used in other components
const API_URL = "http://10.0.0.64:8000";

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const updateUserLocation = async (latitude: number, longitude: number) => {
    if (!user) return;

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

  return (
    <UserContext.Provider value={{ user, setUser, updateUserLocation }}>
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
