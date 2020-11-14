const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server, { pingInterval: 1000 });
const playersWithRooms = {};
const playersRoomMap = {};
const BALL_SPEED_X_MIN = 120;
const BALL_SPEED_X_MAX = 240;
const BALL_SPEED_Y_MIN = 30;
const BALL_SPEED_Y_MAX = 60;

app.use(express.static("./dist"));

app.get("/:path", function (req, res) {
  res.sendFile("index.html", { root: path.join(__dirname, "../dist") });
});

io.on("connection", function (socket) {
  const roomId = new URL(socket.request.headers.referer).pathname.slice(1);
  playersRoomMap[socket.id] = roomId
  
  console.log("ROOM", roomId);
  socket.join(roomId);

  if (!playersWithRooms[roomId]) {
    playersWithRooms[roomId] = {};
  }

  if (roomId && !playersWithRooms[roomId]) {
    playersWithRooms[roomId] = {};
  }

  // create a new player and add it to our players object
  if (roomId) {
    playersWithRooms[roomId][socket.id] = { playerId: socket.id };
  }

  for (let i = 0; i < Object.keys(playersWithRooms[roomId]).length; i++) {
    const playerId = Object.keys(playersWithRooms[roomId])[i];
    playersWithRooms[roomId][playerId].color = i === 1 ? "blue" : "red";
  }

  // send the id back to the client
  socket.emit("playerCreated", socket.id);

  // send the players object to the new player
  io.in(roomId).emit("currentPlayers", playersWithRooms[roomId]);

  // update all other players of the new player
  socket.to(roomId).emit("newPlayer", socket.id);

  socket.on("disconnect", function () {
    console.log("user disconnected");
    // remove this player from our players object
    delete playersWithRooms[roomId][socket.id];

    // emit a message to all players to remove this player
    io.in(roomId).emit("disconnect", socket.id);
  });

  socket.on("startParams", () => {
    const directionX = Math.random() < 0.5 ? 1 : -1;
    const directionY = Math.random() < 0.5 ? 1 : -1;
    const velocityX = directionX * (BALL_SPEED_X_MIN + BALL_SPEED_X_MAX * Math.random());
    const velocityY = directionY * (BALL_SPEED_Y_MIN + BALL_SPEED_Y_MAX * Math.random());
    io.in(roomId).emit("gameStarted", velocityX, velocityY);
  });

  socket.on("playerMove", function (yValue) {
    // emit a message to other players about the player that moved
    socket.to(roomId).emit("playerMoved", yValue);
  });

  socket.on("ballMove", function (posX, posY, velocityX, velocityY) {
    // emit a message to other players about the ball move
    socket.to(roomId).emit("ballMoved", posX, posY, velocityX, velocityY);
  });
});

server.listen(8081, function () {
  console.log(`Listening on ${server.address().port}`);
});
