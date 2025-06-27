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
  last_location_update?: string;
  profile_picture?: string;
  discovery_radius?: number;
}

export interface FriendWithLocation {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  latitude?: number;
  longitude?: number;
  last_location_update?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  updateUserLocation: (latitude: number, longitude: number) => Promise<void>;
  checkContacts: (phoneNumbers: string[]) => Promise<any>;
  getFriendsWithLocations: () => Promise<FriendWithLocation[]>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// API base URL - must match the one used in other components
const API_URL = "http://10.0.0.64:8000";

// Minimum time between location updates (in milliseconds)
const MIN_UPDATE_INTERVAL = 30000; // 30 seconds

// Normalize phone number to match backend format
const normalizePhoneNumber = (phone: string): string => {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Format as E.164 standard: +[country code][number]
  // For simplicity, assuming US/Canada numbers if no country code
  if (!digits.startsWith("1") && digits.length === 10) {
    return "+1" + digits;
  }

  return "+" + digits;
};

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

  // Function to get friends with their locations
  const getFriendsWithLocations = async (): Promise<FriendWithLocation[]> => {
    if (!user) return [];

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/friends`);

      if (response.ok) {
        const data = await response.json();
        // Filter friends that have location data
        const friendsWithLocation = data.filter(
          (friend: FriendWithLocation) =>
            friend.latitude !== null && friend.longitude !== null
        );
        return friendsWithLocation;
      } else {
        console.error("Failed to fetch friends:", response.status);
        return [];
      }
    } catch (error) {
      console.error("Error fetching friends with locations:", error);
      return [];
    }
  };

  // Function to check contacts
  const checkContacts = async (phoneNumbers: string[]) => {
    try {
      // Log the original phone numbers
      console.log(
        "Original phone numbers:",
        JSON.stringify(phoneNumbers, null, 2)
      );

      // Ensure all phone numbers are normalized
      const normalizedPhoneNumbers = phoneNumbers.map((phone) => {
        const normalized = normalizePhoneNumber(phone);
        console.log(`Normalizing: ${phone} -> ${normalized}`);
        return normalized;
      });

      console.log(
        `Checking ${normalizedPhoneNumbers.length} contacts against the server`
      );
      console.log(
        "Normalized phone numbers:",
        JSON.stringify(normalizedPhoneNumbers, null, 2)
      );

      const response = await fetch(`${API_URL}/users/contacts/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_numbers: normalizedPhoneNumbers,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Server response:", JSON.stringify(result, null, 2));
        return result;
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
      value={{
        user,
        setUser,
        updateUserLocation,
        checkContacts,
        getFriendsWithLocations,
      }}
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
