import "phaser";
import InputTextPlugin from "phaser3-rex-plugins/plugins/inputtext-plugin.js";
import Menu from "./menu";

const PADDLE_SPEED = 300;
const BALL_SPEED_INCREMENTS = 50;
const SYNC_FREQ = 200;
const SYNC_MARGIN = 200;
const POINT_EDGE = 4;
const PADDLE_POS = 20;
const BALL_MAX_SPEED = 500;

var cursor;
var playerBlue;
var playerRed;

var ball;

var velocityX;
var velocityY;

var scorePlayerBlue = 0;
var scorePlayerRed = 0;
var waitForPlayers = true;
var gameRunning = false;
var firstPlayerId;
var opponentId;
var playersList = {};
var userName;

var latency;
var syncTimer;
var resetTimeout;

var waitMessage;
var countdownTimerTimeout;
var countdownTimerCount = 3;
var countdownTimerText;
var playerNameRed;
var playerNameBlue;
var scoreTextPlayerRed;
var scoreTextPlayerBlue;

interface IPong {
  socket: any;
  userName: string;
}

export default class Pong extends Phaser.Scene implements IPong {
  socket;
  userName;
  constructor() {
    super("pong");
  }

  init(data) {
    userName = data.userName;
  }

  preload() {
    this.load.image("ground", "assets/ground.png");
    this.load.image("player", "assets/player.png");
    this.load.image("pc", "assets/pc.png");
    this.load.image("ball", "assets/ball.png");
  }

  create() {
    playerNameRed = this.add.text(16, 16, "PLAYER 1", {
      fontFamily: "Roboto, sans-serif",
      fontSize: "16px",
      fill: "#FFF",
    });

    playerNameBlue = this.add
      .text(this.game.canvas.width - 16, 16, "PLAYER 2", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "16px",
        fill: "#FFF",
      })
      .setOrigin(1, 0);

    scoreTextPlayerRed = this.add.text(16, 36, "score: 0", {
      fontFamily: "Roboto, sans-serif",
      fontSize: "20px",
      fill: "#FFF",
    });
    scoreTextPlayerBlue = this.add
      .text(this.game.canvas.width - 16, 36, "score: 0", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "20px",
        fill: "#FFF",
      })
      .setOrigin(1, 0);

    waitMessage = this.add
      .text(this.game.canvas.width / 2, this.game.canvas.height / 2 - 80, "", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "40px",
        fill: "#FF0",
      })
      .setOrigin(0.5);

    countdownTimerText = this.add
      .text(this.game.canvas.width / 2, this.game.canvas.height / 2 - 80, "", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "56px",
        fill: "#FF0",
      })
      .setOrigin(0.5);

    this.socket = io({ query: `name=${userName}` });

    this.socket.on("currentPlayers", (players) => {
      if (Object.keys(players).length !== 2) {
        waitForPlayers = true;
        console.log("WAITING FOR OPPONENT");
        waitMessage.setText("Waiting for another player");
      } else {
        waitMessage.setText("");
        waitForPlayers = false;
        for (const playerId of Object.keys(players)) {
          if (players[playerId].color === "blue") {
            players[playerId].color = "blue";
            players[playerId].paddle = playerBlue;
            playerNameBlue.setText(players[playerId].userName);
            scorePlayerBlue = playersList[playerId].score;
          } else {
            players[playerId].color = "red";
            players[playerId].paddle = playerRed;
            playerNameRed.setText(players[playerId].userName);
            scorePlayerRed = playersList[playerId].score;
          }

          if (playerId !== firstPlayerId) {
            opponentId = playerId;
          }
        }
        playersList = players;
      }

      if (firstPlayerId && players[firstPlayerId].color === "red") {
        playerNameRed.setText(userName);
      } else {
        playerNameBlue.setText(userName);
      }
    });

    this.socket.on("roomFull", () => {
      gameRunning = false;
      waitForPlayers = true;
      this.resetAllPos();
      clearInterval(countdownTimerTimeout);
      clearTimeout(resetTimeout);
      clearInterval(syncTimer);
      waitMessage.setText("Room is full!");
    });

    this.socket.on("pong", function (ms) {
      latency = ms;
      console.log(ms);
    });

    this.socket.on("gameStarted", (vX, vY) => {
      velocityX = vX;
      velocityY = vY;
      ball.setVelocityX(vX);
      ball.setVelocityY(vY);

      clearInterval(syncTimer);
      if (playersList[firstPlayerId].color === "red") {
        syncTimer = setInterval(() => this.ballSync(this), SYNC_FREQ);
      }
    });

    this.socket.on("playerCreated", (playerId) => {
      firstPlayerId = playerId;
    });

    this.socket.on("pointSync", (players) => {
      for (const playerId of Object.keys(players)) {
        if (players[playerId].color === "blue") {
          scorePlayerBlue = playersList[playerId].score;
          scoreTextPlayerBlue.setText("Score: " + scorePlayerBlue);
        } else {
          scorePlayerRed = playersList[playerId].score;
          scoreTextPlayerRed.setText("Score: " + scorePlayerRed);
        }
      }

      playersList = players;
    });

    this.socket.on("disconnect", () => {
      gameRunning = false;
      waitForPlayers = true;
      this.resetAllPos();
      clearInterval(countdownTimerTimeout);
      clearTimeout(resetTimeout);
      clearInterval(syncTimer);
      waitMessage.setText("Opponent has disconnected");
      countdownTimerText.setText("");
    });

    this.socket.on("playerMoved", (paddleY) => {
      playersList[opponentId].paddle.y = paddleY;
    });

    this.socket.on("ballMoved", function (pX, pY, vX, vY) {
      ball.x = pX;
      ball.y = pY;
      velocityX = vX;
      velocityY = vY;
      ball.setVelocityX(vX);
      ball.setVelocityY(vY);
    });

    cursor = this.input.keyboard.createCursorKeys();

    playerBlue = this.physics.add.sprite(
      this.game.canvas.width - PADDLE_POS,
      this.game.canvas.height / 2,
      "player"
    );
    playerBlue.setImmovable(true);
    playerBlue.setCollideWorldBounds(true);

    playerRed = this.physics.add.sprite(
      PADDLE_POS,
      this.game.canvas.height / 2,
      "pc"
    );
    playerRed.setImmovable(true);
    playerRed.setCollideWorldBounds(true);

    ball = this.physics.add.sprite(
      this.game.canvas.width / 2,
      this.game.canvas.height / 2,
      "ball"
    );

    ball.setCollideWorldBounds(true);
    ball.setBounce(1);

    //in createGame()
    this.physics.add.collider(ball, playerBlue, this.hitPaddle, null, this);
    this.physics.add.collider(ball, playerRed, this.hitPaddle, null, this);
  }

  update() {
    if (!firstPlayerId || !opponentId) {
      return;
    }

    if (!gameRunning && !waitForPlayers) {
      this.startGame();
      return;
    }

    if (cursor.up.isDown) {
      playersList[firstPlayerId].paddle.setVelocityY(-PADDLE_SPEED);
    } else if (cursor.down.isDown) {
      playersList[firstPlayerId].paddle.setVelocityY(PADDLE_SPEED);
    } else {
      playersList[firstPlayerId].paddle.setVelocityY(0);
    }

    if (ball.x == this.game.canvas.width - POINT_EDGE) {
      scorePlayerRed += 1;

      this.pointScored();
      if (playersList[firstPlayerId].color === "red") {
        this.socket.emit("pointScored", {
          color: "red",
          score: scorePlayerRed,
        });
      }
    }

    if (ball.x == POINT_EDGE) {
      scorePlayerBlue += 1;

      this.pointScored();

      if (playersList[firstPlayerId].color === "blue") {
        this.socket.emit("pointScored", {
          color: "blue",
          score: scorePlayerBlue,
        });
      }
    }

    if (
      gameRunning &&
      playersList[firstPlayerId].paddle.prevY !==
        playersList[firstPlayerId].paddle.y
    ) {
      this.socket.emit("playerMove", playersList[firstPlayerId].paddle.y);
    }

    playersList[firstPlayerId].paddle.prevY =
      playersList[firstPlayerId].paddle.y;
  }

  hitPaddle(ball) {
    velocityX = velocityX + Math.sign(velocityX) * BALL_SPEED_INCREMENTS;
    if (Math.abs(velocityX) > BALL_MAX_SPEED) {
      velocityX = Math.sign(velocityX) * BALL_MAX_SPEED;
    }

    velocityX = velocityX * -1;
    ball.setVelocityX(velocityX);

    velocityY = ball.body.velocity.y;
    ball.setVelocityY(velocityY);
    this.socket.emit("ballMove", ball.x, ball.y, velocityX, velocityY);
  }

  ballSync(that) {
    console.log("BALL SYNC");
    if (ball.x > this.game.canvas.width - SYNC_MARGIN || ball.x < SYNC_MARGIN) {
      return;
    }

    that.socket.emit(
      "ballMove",
      ball.x + (ball.body.velocity.x * latency) / 1000,
      ball.y + (ball.body.velocity.y * latency) / 1000,
      ball.body.velocity.x,
      ball.body.velocity.y
    );
  }

  pointScored() {
    gameRunning = false;
    this.resetAllPos();

    clearTimeout(resetTimeout);
    resetTimeout = setTimeout(() => {
      gameRunning = true;
      this.socket.emit("startParams");
    }, 3000);
  }

  startGame() {
    gameRunning = true;
    this.resetAllPos();
    this.runCountdown();

    clearTimeout(resetTimeout);
    resetTimeout = setTimeout(() => {
      this.socket.emit("startParams");
    }, 3000);
  }

  runCountdown() {
    countdownTimerCount = 3;
    countdownTimerText.setText(countdownTimerCount.toString());

    countdownTimerTimeout = setInterval(() => {
      countdownTimerCount--;
      countdownTimerText.setText(countdownTimerCount.toString());

      if (countdownTimerCount < 1) {
        countdownTimerText.setText("");
        clearInterval(countdownTimerTimeout);
      }
    }, 1000);
  }

  resetAllPos() {
    playerBlue.x = this.game.canvas.width - PADDLE_POS;
    playerBlue.y = this.game.canvas.height / 2;
    playerRed.x = PADDLE_POS;
    playerRed.y = this.game.canvas.height / 2;

    ball.x = this.game.canvas.width / 2;
    ball.y = this.game.canvas.height / 2;

    ball.setVelocityX(0);
    ball.setVelocityY(0);
  }
}

const config = {
  type: Phaser.AUTO,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  scale: {
    parent: "pong-game",
    mode: Phaser.Scale.ScaleModes.FIT,
    width: 1200,
    height: 600,
  },
  backgroundColor: "#1E1A25",
  physics: {
    default: "arcade",
  },
  dom: {
    createContainer: true,
  },
  plugins: {
    global: [
      {
        key: "rexInputTextPlugin",
        plugin: InputTextPlugin,
        start: true,
      },
    ],
  },
  scene: [Menu, Pong],
};

const game = new Phaser.Game(config);
