require("dotenv").config();
const express = require("express");
const path = require("path");
const connectDB = require("./src/config/database"); // Import the database connection function

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const routes = require("./src/routes/index");

// Connect to MongoDB
connectDB(); // Use the correct function name

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "src/public")));

// Set view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));

// Routes
app.use("/", routes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
