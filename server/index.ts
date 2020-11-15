const express = require("express");
const path = require("path");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server, { pingInterval: 1000 });
const playersWithRooms = {};
const playersRoomMap = {};
const BALL_SPEED_X_MIN = 180;
const BALL_SPEED_X_MAX = 240;
const BALL_SPEED_Y_MIN = 60;
const BALL_SPEED_Y_MAX = 90;

app.use(express.static("./dist"));

app.get("/:path", (req, res) => {
  res.sendFile("index.html", { root: path.join(__dirname, "../dist") });
});

io.on("connection", (socket) => {
  const roomId = new URL(socket.request.headers.referer).pathname.slice(1);
  playersRoomMap[socket.id] = roomId;

  socket.join(roomId);

  if (roomId && !playersWithRooms[roomId]) {
    playersWithRooms[roomId] = {};
  }

  // create a new player and add it to our players object
  if (roomId) {
    playersWithRooms[roomId][socket.id] = {
      playerId: socket.id,
      userName: socket.handshake.query.name,
    };
  }

  if (roomId.length === 0 || Object.keys(playersWithRooms[roomId]).length > 2) {
    delete playersWithRooms[roomId][socket.id];
    socket.emit("roomFull");
    socket.disconnect();
  }

  let playersInThisRoom = Object.keys(playersWithRooms[roomId]);

  for (let i = 0; i < playersInThisRoom.length; i++) {
    const playerId = playersInThisRoom[i];
    playersWithRooms[roomId][playerId].color = i === 1 ? "blue" : "red";
    playersWithRooms[roomId][playerId].score = 0;
  }

  // send the id back to the client
  socket.emit("playerCreated", socket.id);

  // send the players object to the new player
  io.in(roomId).emit("currentPlayers", playersWithRooms[roomId]);

  // update all other players of the new player
  socket.to(roomId).emit("newPlayer", socket.id);

  socket.on("pointScored", ({ color, score }) => {
    playersInThisRoom = Object.keys(playersWithRooms[roomId]);

    for (let i = 0; i < playersInThisRoom.length; i++) {
      const playerId = playersInThisRoom[i];
      if (playersWithRooms[roomId][playerId].color === color) {
        playersWithRooms[roomId][playerId].score = score;
      }
    }

    io.in(roomId).emit("pointSync", playersWithRooms[roomId]);
  });

  socket.on("gameOver", ({ winner }) => {
    playersInThisRoom = Object.keys(playersWithRooms[roomId]);

    playersInThisRoom.forEach((id) => {
      playersWithRooms[roomId][id].score = 0;
      playersWithRooms[roomId][id].restart = false;
    });
    io.in(roomId).emit("winner", winner);
  });

  socket.on("restartGame", ({ playerId }) => {
    playersInThisRoom = Object.keys(playersWithRooms[roomId]);
    playersWithRooms[roomId][playerId].restart = true;

    console.log(playersInThisRoom);
    console.log(playersWithRooms[roomId]);
    const allReady = playersInThisRoom.every(
      (id) => playersWithRooms[roomId][id].restart
    );
    console.log("ALL READY -", allReady);
    if (allReady) {
      io.in(roomId).emit("allReadyForRestart");
    }
  });

  socket.on("startParams", () => {
    const directionX = Math.random() < 0.5 ? 1 : -1;
    const directionY = Math.random() < 0.5 ? 1 : -1;
    const velocityX =
      directionX * (BALL_SPEED_X_MIN + BALL_SPEED_X_MAX * Math.random());
    const velocityY =
      directionY * (BALL_SPEED_Y_MIN + BALL_SPEED_Y_MAX * Math.random());
    io.in(roomId).emit("gameStarted", velocityX, velocityY);
  });

  socket.on("playerMove", (yValue) => {
    // emit a message to other players about the player that moved
    socket.to(roomId).emit("playerMoved", yValue);
  });

  socket.on("ballMove", (posX, posY, velocityX, velocityY) => {
    // emit a message to other players about the ball move
    socket.to(roomId).emit("ballMoved", posX, posY, velocityX, velocityY);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    // remove this player from our players object
    delete playersWithRooms[roomId][socket.id];

    // emit a message to all players to remove this player
    io.in(roomId).emit("disconnect", socket.id);
  });
});

const port = process.env.PORT || 8081;
server.listen(port, () => {
  console.log(`Listening on ${server.address().port}`);
});
