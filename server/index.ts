var express = require("express");
var app = express();
var server = require("http").Server(app);
var io = require("socket.io").listen(server);
var players = {};
var playersArray = [];

app.use(express.static("./dist"));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

io.on("connection", function (socket) {
  console.log("a user connected");
  playersArray.push(socket.id);

  // create a new player and add it to our players object
  players[socket.id] = {
    playerId: socket.id,
  };

  console.log(playersArray);
  for (let i = 0; i < playersArray.length; i++) {
    players[playersArray[i]].color = i === 1 ? "blue" : "red";
  }

  // send the id back to the client
  socket.emit("playerCreated", socket.id);

  // send the players object to the new player
  io.emit("currentPlayers", players);

  // update all other players of the new player
  socket.broadcast.emit("newPlayer", socket.id);

  socket.on("disconnect", function () {
    console.log("user disconnected");
    // remove this player from our players object
    delete players[socket.id];
    const idx = playersArray.findIndex((player) => player === socket.id);
    playersArray = [
      ...playersArray.slice(0, idx),
      ...playersArray.slice(idx + 1, playersArray.length),
    ];
    // emit a message to all players to remove this player
    io.emit("disconnect", socket.id);

    console.log('total players: ', playersArray.length)
  });

  socket.on("gameStart", () => {
    console.log("start game");
    // emit a message to all players to remove this player
    io.emit("gameStarted");
  });

  socket.on("playerMove", function (yValue) {
    // emit a message to other players about the player that moved
    socket.broadcast.emit("playerMoved", yValue);
  });

  socket.on("ballMove", function (posX, posY, velocityX, velocityY) {
    // emit a message to other players about the ball move
    socket.broadcast.emit("ballMoved", posX, posY, velocityX, velocityY);
  });
});

server.listen(8081, function () {
  console.log(`Listening on ${server.address().port}`);
});
