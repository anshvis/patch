import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useUser } from "../components/UserContext";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import * as Location from "expo-location";

// API base URL - must match the one used in other components
const API_URL = "http://10.0.0.64:8000";

interface MutualContact {
  id: number;
  name: string;
  username: string;
}

interface NearbyUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  distance: number;
  phone_number: string;
  profile_picture?: string;
  mutual_contacts: MutualContact[];
}

export default function FindScreen() {
  const { user } = useUser();
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [contactsPermissionGranted, setContactsPermissionGranted] = useState<
    boolean | null
  >(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<
    boolean | null
  >(null);
  const [contactsMap, setContactsMap] = useState<{ [phone: string]: string }>(
    {}
  );

  // Check permissions and load data when component mounts
  useEffect(() => {
    if (user) {
      checkPermissions();
    }
  }, [user]);

  // Check both location and contacts permissions
  const checkPermissions = async () => {
    try {
      // Check contacts permission
      const contactsStatus = await Contacts.getPermissionsAsync();
      setContactsPermissionGranted(contactsStatus.status === "granted");

      // Check location permission
      const locationStatus = await Location.getForegroundPermissionsAsync();
      setLocationPermissionGranted(locationStatus.status === "granted");

      // If both permissions are granted, fetch nearby users
      if (
        contactsStatus.status === "granted" &&
        locationStatus.status === "granted"
      ) {
        fetchNearbyUsers();
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  // Request permissions and load data
  const requestPermissions = async () => {
    setLoading(true);
    try {
      // Request contacts permission if not granted
      if (!contactsPermissionGranted) {
        const contactsStatus = await Contacts.requestPermissionsAsync();
        setContactsPermissionGranted(contactsStatus.status === "granted");
        if (contactsStatus.status !== "granted") {
          Alert.alert(
            "Contacts Permission Required",
            "We need access to your contacts to find nearby friends."
          );
          setLoading(false);
          return;
        }
      }

      // Request location permission if not granted
      if (!locationPermissionGranted) {
        const locationStatus =
          await Location.requestForegroundPermissionsAsync();
        setLocationPermissionGranted(locationStatus.status === "granted");
        if (locationStatus.status !== "granted") {
          Alert.alert(
            "Location Permission Required",
            "We need access to your location to find nearby friends."
          );
          setLoading(false);
          return;
        }
      }

      // If both permissions are granted, update location and fetch nearby users
      if (contactsPermissionGranted && locationPermissionGranted) {
        await updateLocation();
        await fetchNearbyUsers();
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
      Alert.alert("Error", "Failed to get required permissions.");
    } finally {
      setLoading(false);
    }
  };

  // Update user's location
  const updateLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Update user's location on the server
      if (user) {
        const response = await fetch(`${API_URL}/users/${user.id}/location`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }),
        });

        if (!response.ok) {
          console.error("Failed to update location:", await response.text());
        } else {
          console.log("Location updated successfully");
        }
      }
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  // Load contacts and create a map of phone numbers to contact names
  const loadContactsMap = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const phoneToNameMap: { [phone: string]: string } = {};

      data.forEach((contact) => {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          contact.phoneNumbers.forEach((phoneObj) => {
            if (phoneObj.number) {
              phoneToNameMap[phoneObj.number] = contact.name || "Unknown";
            }
          });
        }
      });

      setContactsMap(phoneToNameMap);
      return phoneToNameMap;
    } catch (error) {
      console.error("Error loading contacts map:", error);
      return {};
    }
  };

  // Fetch nearby users who share mutual contacts
  const fetchNearbyUsers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // First load contacts
      const contactsMapData = await loadContactsMap();

      // Extract phone numbers from contacts
      const phoneNumbers = Object.keys(contactsMapData);

      if (phoneNumbers.length === 0) {
        setLoading(false);
        Alert.alert("No Contacts", "No contacts found on your device.");
        return;
      }

      // Call the API to find nearby users who share mutual contacts
      const response = await fetch(
        `${API_URL}/users/${user.id}/nearby-contacts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone_numbers: phoneNumbers,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNearbyUsers(data);

        if (data.length === 0) {
          Alert.alert(
            "No Nearby Mutuals",
            "No users with mutual contacts found nearby."
          );
        }
      } else {
        const errorText = await response.text();
        console.error("Failed to fetch nearby users:", errorText);

        // Check for specific errors
        if (errorText.includes("Location data not available")) {
          Alert.alert(
            "Location Required",
            "Please update your location to find nearby contacts.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Update Location", onPress: updateLocation },
            ]
          );
        } else {
          Alert.alert("Error", "Failed to fetch nearby contacts.");
        }
      }
    } catch (error) {
      console.error("Error fetching nearby users:", error);
      Alert.alert("Error", "Failed to fetch nearby contacts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await updateLocation();
    await fetchNearbyUsers();
    setRefreshing(false);
  };

  // Get a random mutual contact to display
  const getRandomMutual = (mutuals: MutualContact[]) => {
    if (!mutuals || mutuals.length === 0) return "Someone you might know";
    const randomIndex = Math.floor(Math.random() * mutuals.length);
    return mutuals[randomIndex].name;
  };

  // Render a nearby user card
  const renderNearbyUser = (user: NearbyUser) => {
    const displayName =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username;

    // Get a random mutual contact to display
    const mutualName = getRandomMutual(user.mutual_contacts);
    const mutualCount = user.mutual_contacts.length;

    return (
      <View style={styles.userCard} key={user.id}>
        <View style={styles.userHeader}>
          {user.profile_picture ? (
            <Image
              source={{ uri: user.profile_picture }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profileInitials}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.username}>@{user.username}</Text>
          </View>
        </View>

        <View style={styles.userDetails}>
          <Text style={styles.distanceText}>
            <Ionicons name="location" size={16} color="#666" />
            {user.distance} {user.distance === 1 ? "mile" : "miles"} away
          </Text>
          <Text style={styles.connectionText}>
            <Ionicons name="people" size={16} color="#666" />
            Knows {mutualName}{" "}
            {mutualCount > 1 ? `+ ${mutualCount - 1} more` : ""}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => sendFriendRequest(user.id)}
        >
          <Ionicons name="person-add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Friend</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Send a friend request
  const sendFriendRequest = async (friendId: number) => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/friends`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friend_id: friendId }),
      });

      if (response.ok) {
        // Remove the user from the nearby users list
        setNearbyUsers((prev) => prev.filter((u) => u.id !== friendId));

        Alert.alert("Success", "Friend request sent successfully!");
      } else {
        const errorData = await response.text();
        console.error(
          "Failed to send friend request:",
          response.status,
          errorData
        );

        // Check if the error is because friendship already exists
        if (errorData.includes("Friendship already exists")) {
          Alert.alert(
            "Already Friends",
            "You already have a pending or accepted friendship with this user."
          );

          // Remove the user from the nearby users list
          setNearbyUsers((prev) => prev.filter((u) => u.id !== friendId));
        } else {
          Alert.alert(
            "Error",
            "Failed to send friend request. Please try again."
          );
        }
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      Alert.alert("Error", "An error occurred while sending friend request.");
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Please sign in to use this feature.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.title}>Find Nearby Mutuals</Text>

      {(!contactsPermissionGranted || !locationPermissionGranted) && (
        <View style={styles.permissionsContainer}>
          <Text style={styles.permissionsText}>
            We need access to your contacts and location to find nearby friends.
          </Text>
          <TouchableOpacity
            style={styles.permissionsButton}
            onPress={requestPermissions}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.permissionsButtonText}>
                Grant Permissions
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {loading && contactsPermissionGranted && locationPermissionGranted ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Finding nearby mutuals...</Text>
        </View>
      ) : (
        <>
          {nearbyUsers.length > 0
            ? nearbyUsers.map(renderNearbyUser)
            : contactsPermissionGranted &&
              locationPermissionGranted && (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={60} color="#ccc" />
                  <Text style={styles.emptyStateText}>
                    No nearby mutuals found
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    Pull down to refresh and try again
                  </Text>
                </View>
              )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  contentContainer: {
    padding: 20,
    paddingTop: 70,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 20,
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#888",
    textAlign: "center",
    marginTop: 100,
  },
  permissionsContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  permissionsText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 15,
  },
  permissionsButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    width: "80%",
  },
  permissionsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: "#666",
  },
  userDetails: {
    marginBottom: 15,
  },
  distanceText: {
    fontSize: 15,
    color: "#666",
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  connectionText: {
    fontSize: 15,
    color: "#666",
    flexDirection: "row",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#555",
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
  },
});
