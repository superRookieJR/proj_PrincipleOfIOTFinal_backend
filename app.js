require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const http = require("http");
const { Server } = require("socket.io");

// Initialize SQLite Database
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) console.error("Error opening database:", err.message);
  else {
    console.log("Connected to SQLite database.");
    
    // Ensure tables exist
    db.run(
      "CREATE TABLE IF NOT EXISTS sensor (name TEXT PRIMARY KEY, value TEXT)",
      (err) => {
        if (err) console.error("Error creating sensor table:", err.message);
      }
    );

    db.run(
      "CREATE TABLE IF NOT EXISTS equipment (name TEXT PRIMARY KEY, value TEXT)",
      (err) => {
        if (err) console.error("Error creating equipment table:", err.message);
      }
    );
  }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Handle WebSocket connections
io.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});

// API Route for Test alive
app.get("/", (req, res) => {
  res.json({
    message: "This is API for IOT Final Project in Computer Science, KMITL",
  });
});

function updateDatabase(req, res, sqlCommand, mode) {
  try {
    const { name, value } = req.body;

    if (!name || !value) {
      return res
        .status(400)
        .json({ success: false, error: "Name and value are required." });
    }

    db.run(sqlCommand, [name, value], function (err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      // Emit event to all connected clients
      io.emit(`${mode}Updated`, { name, value });

      // Fetch updated table data and log it
      db.all(`SELECT * FROM ${mode}`, (err, rows) => {
        if (err) {
          console.error("Error executing query:", err);
          return;
        }
        console.log(`Updated ${mode} Table:`, rows);
      });

      res.json({ success: true, data: { name, value } });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// API Routes to Update Sensor and Equipment
app.post("/update/sensor", (req, res) =>
  updateDatabase(
    req,
    res,
    `INSERT INTO sensor (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
    "sensor"
  )
);

app.post("/update/equipment", (req, res) =>
  updateDatabase(
    req,
    res,
    `INSERT INTO equipment (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
    "equipment"
  )
);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));