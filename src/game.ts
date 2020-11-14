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
var scoreTextPlayerBlue;
var scoreTextPlayerRed;
var waitForPlayers = true;
var gameStarted = false;
var firstPlayerId;
var opponentId;
var playersList = {};
var timer;
var latency;

interface IPong {
  socket: any;
}

export default class Pong extends Phaser.Scene implements IPong {
  socket;
  constructor() {
    super("pong");
  }

  init(data) {
    console.log(data)
  }

  preload() {
    this.load.image("ground", "assets/ground.png");
    this.load.image("player", "assets/player.png");
    this.load.image("pc", "assets/pc.png");
    this.load.image("ball", "assets/ball.png");
  }

  create() {
    this.socket = io();

    this.socket.on("currentPlayers", function (players) {
      if (Object.keys(players).length !== 2) {
        waitForPlayers = true;
        console.log("WAITING FOR OPPONENT");
      } else {
        waitForPlayers = false;

        for (const playerId of Object.keys(players)) {
          if (players[playerId].color === "blue") {
            players[playerId].color = "blue";
            players[playerId].paddle = playerBlue;
          } else {
            players[playerId].color = "red";
            players[playerId].paddle = playerRed;
          }

          if (playerId !== firstPlayerId) {
            opponentId = playerId;
          }
        }

        playersList = players;
      }
    });

    this.socket.on("pong", function (ms) {
      latency = ms;
      console.log(ms);
    });

    this.socket.on("gameStarted", (vX, vY) => {
      velocityX = vX;
      velocityY = vY;
      ball.x = this.game.canvas.width / 2;
      ball.y = this.game.canvas.height / 2;
      playerBlue.x = this.game.canvas.width - PADDLE_POS;
      playerBlue.y = this.game.canvas.height / 2;
      playerRed.x = PADDLE_POS;
      playerRed.y = this.game.canvas.height / 2;
      ball.setVelocityX(vX);
      ball.setVelocityY(vY);

      gameStarted = true;
    });

    this.socket.on("playerCreated", function (playerId) {
      firstPlayerId = playerId;
    });

    this.socket.on("playerMoved", function (paddleY) {
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

    scoreTextPlayerRed = this.add.text(16, 16, "score: 0", {
      fontSize: "16px",
      fill: "#FFF",
    });
    scoreTextPlayerBlue = this.add
      .text(this.game.canvas.width - 16, 16, "score: 0", {
        fontSize: "16px",
        fill: "#FFF",
      })
      .setOrigin(1, 0);
  }

  update() {
    if (!firstPlayerId || !opponentId) {
      return;
    }

    if (!gameStarted && !waitForPlayers) {
      this.reset();
      clearInterval(timer);
      if (playersList[firstPlayerId].color === "red") {
        timer = setInterval(() => this.ballSync(this), SYNC_FREQ);
      }
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
      scoreTextPlayerRed.setText("Score: " + scorePlayerRed);
      this.reset();
    }

    if (ball.x == POINT_EDGE) {
      scorePlayerBlue += 1;
      scoreTextPlayerBlue.setText("Score: " + scorePlayerBlue);
      this.reset();
    }

    if (
      gameStarted &&
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

  reset() {
    this.socket.emit("startParams");
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
