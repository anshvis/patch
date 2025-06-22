import { StyleSheet, View, Dimensions, Alert, Text } from "react-native";
import MapView, { Region, Marker, Callout } from "react-native-maps";
import { useEffect, useState, useRef } from "react";
import * as Location from "expo-location";
import { useUser } from "../components/UserContext";
import { FriendWithLocation } from "../components/UserContext";

// API base URL - must match the one used in other components
const API_URL = "http://10.0.0.64:8000";

export default function HomeScreen() {
  const { user, updateUserLocation, getFriendsWithLocations } = useUser();
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [friends, setFriends] = useState<FriendWithLocation[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const mapRef = useRef<MapView>(null);
  const lastLocationRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Debug log for user object
  useEffect(() => {
    console.log("HomeScreen user state:", user);
  }, [user]);

  // Fetch friends when user is available
  useEffect(() => {
    if (user) {
      fetchFriendsWithLocations();
    }
  }, [user]);

  const fetchFriendsWithLocations = async () => {
    if (!user) return;

    try {
      setLoadingFriends(true);
      const friendsWithLocation = await getFriendsWithLocations();
      setFriends(friendsWithLocation);
      console.log(
        `Loaded ${friendsWithLocation.length} friends with location data`
      );
    } catch (error) {
      console.error("Error fetching friends with locations:", error);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  // Get friend's initials for the marker
  const getFriendInitials = (friend: FriendWithLocation) => {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name[0]}${friend.last_name[0]}`;
    } else if (friend.first_name) {
      return friend.first_name[0];
    } else {
      return friend.username[0].toUpperCase();
    }
  };

  // Get friend's display name
  const getFriendDisplayName = (friend: FriendWithLocation) => {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name} ${friend.last_name}`;
    } else if (friend.first_name) {
      return friend.first_name;
    } else {
      return friend.username;
    }
  };

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription;

    const startLocationTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        Alert.alert(
          "Permission Denied",
          "Location permission is required to show your position on the map."
        );
        return;
      }

      let initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(initialLocation);

      // Update the region with the initial location
      const newRegion = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);

      // Save the last location for cleanup
      lastLocationRef.current = {
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
      };

      // Update the user's location in the backend if logged in (ONLY ON INITIAL LOAD)
      if (user) {
        console.log("Updating initial location for user:", user.id);
        try {
          await updateUserLocation(
            initialLocation.coords.latitude,
            initialLocation.coords.longitude
          );
          // After updating our location, fetch friends' locations
          fetchFriendsWithLocations();
        } catch (error) {
          console.error("Error updating initial location:", error);
        }
      } else {
        console.log("No user logged in, skipping location update");
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update if moved by 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);

          const newRegion = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          };
          setRegion(newRegion);

          // Save the last location for cleanup, but don't update the backend
          lastLocationRef.current = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
        }
      );
    };

    startLocationTracking();

    // Set up periodic refresh of friends' locations
    const friendsRefreshInterval = setInterval(() => {
      if (user) {
        fetchFriendsWithLocations();
      }
    }, 60000); // Refresh every minute

    // Cleanup function - update location when component unmounts
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }

      clearInterval(friendsRefreshInterval);

      // Update the user's location one last time when leaving the app
      if (user && lastLocationRef.current) {
        console.log(
          "Updating final location before unmount for user:",
          user.id
        );
        updateUserLocation(
          lastLocationRef.current.latitude,
          lastLocationRef.current.longitude
        ).catch((error) => {
          console.error("Error updating final location:", error);
        });
      }
    };
  }, [user, updateUserLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={true}
      >
        {/* Render friend markers */}
        {friends.map((friend) =>
          friend.latitude && friend.longitude ? (
            <Marker
              key={`friend-${friend.id}`}
              coordinate={{
                latitude: friend.latitude,
                longitude: friend.longitude,
              }}
            >
              <View style={styles.friendMarker}>
                <Text style={styles.friendInitials}>
                  {getFriendInitials(friend)}
                </Text>
              </View>
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    {getFriendDisplayName(friend)}
                  </Text>
                  <Text style={styles.calloutSubtitle}>@{friend.username}</Text>
                </View>
              </Callout>
            </Marker>
          ) : null
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  friendMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4CAF50",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  friendInitials: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  callout: {
    padding: 10,
    width: 150,
  },
  calloutTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
  },
  calloutSubtitle: {
    color: "#666",
  },
});
