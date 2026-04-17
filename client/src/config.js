const config = {
  API_URL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || "http://localhost:5000",
  GOOGLE_MAPS_API_KEY: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "",
};

export default config;
