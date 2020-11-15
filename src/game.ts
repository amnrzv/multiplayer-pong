import "phaser";
import InputTextPlugin from "phaser3-rex-plugins/plugins/inputtext-plugin.js";
import Menu from "./menu";

const PADDLE_SPEED = 300;
const BALL_SPEED_INCREMENTS = 50;
const SYNC_FREQ = 800;
const SYNC_MARGIN = 200;
const POINT_EDGE = 4;
const PADDLE_POS = 50;
const BALL_MAX_SPEED = 500;
const MAX_POINTS = 10;

let cursor;
let playerBlue;
let playerRed;
let ball;

let velocityX;
let velocityY;

let scorePlayerBlue = 0;
let scorePlayerRed = 0;
let waitForPlayers = true;
let gameRunning = false;
let firstPlayerId;
let opponentId;
let playersList = {};
let userName;

let latency;
let syncTimer;
let gameStartTimeout;

let waitMessage;

let countdownTimerTimeout;
let countdownTimerCount = 3;
let countdownTimerText;

let playerNameRed;
let playerNameBlue;
let scoreTextPlayerRed;
let scoreTextPlayerBlue;

let restartGameBtn;
let restartGameText;

interface IPong {
  socket: any;
}

export default class Pong extends Phaser.Scene implements IPong {
  socket;
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
    const centerX = this.game.canvas.width / 2;
    playerNameRed = this.add.text(40, 16, "PLAYER 1", {
      fontFamily: "Roboto, sans-serif",
      fontSize: "24px",
      fill: "#FFF",
    });

    playerNameBlue = this.add
      .text(this.game.canvas.width - 40, 16, "PLAYER 2", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "24px",
        fill: "#FFF",
      })
      .setOrigin(1, 0);

    scoreTextPlayerRed = this.add.text(250, 16, `0/${MAX_POINTS}`, {
      fontFamily: "Roboto, sans-serif",
      fontSize: "24px",
      fill: "#FFF",
    });

    scoreTextPlayerBlue = this.add
      .text(this.game.canvas.width - 250, 16, `0/${MAX_POINTS}`, {
        fontFamily: "Roboto, sans-serif",
        fontSize: "24px",
        fill: "#FFF",
      })
      .setOrigin(1, 0);

    waitMessage = this.add
      .text(centerX, this.game.canvas.height / 2 - 80, "", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "40px",
        fill: "#FF0",
      })
      .setOrigin(0.5);

    countdownTimerText = this.add
      .text(centerX, this.game.canvas.height / 2 - 80, "", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "56px",
        fill: "#FF0",
      })
      .setOrigin(0.5);

    restartGameBtn = this.add
      .rectangle(centerX, 300, 400, 60, 0x84b82f)
      .setOrigin(0.5)
      .setInteractive({ cursor: "pointer" })
      .setVisible(false)
      .setDepth(5);

    restartGameText = this.add
      .text(centerX, 300, "PLAY AGAIN", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "24px",
        fill: "#000",
        fontStyle: "normal",
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(6);

    restartGameBtn.on("pointerover", () => {
      restartGameBtn.setFillStyle(0x70982d);
    });

    restartGameBtn.on("pointerout", () => {
      restartGameBtn.setFillStyle(0x84b82f);
    });

    restartGameBtn.on("pointerup", () => {
      this.restartGame();
    });

    this.socket = io({ query: `name=${userName}` });

    this.socket.on("currentPlayers", (players) => {
      if (Object.keys(players).length !== 2) {
        waitForPlayers = true;
        waitMessage.setText("Waiting for another player");
      } else {
        waitMessage.setText("");
        waitForPlayers = false;
        for (const playerId of Object.keys(players)) {
          if (players[playerId].color === "blue") {
            players[playerId].color = "blue";
            players[playerId].paddle = playerBlue;
            playerNameBlue.setText(players[playerId].userName);
            scorePlayerBlue = players[playerId].score;
          } else {
            players[playerId].color = "red";
            players[playerId].paddle = playerRed;
            playerNameRed.setText(players[playerId].userName);
            scorePlayerRed = players[playerId].score;
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
      clearTimeout(gameStartTimeout);
      clearInterval(syncTimer);
      waitMessage.setText("Room is full!");
    });

    this.socket.on("pong", (ms) => {
      latency = ms;
      console.info("PING: ", ms);
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

    this.socket.on("winner", (playerId) => {
      gameRunning = false;
      waitForPlayers = true;
      this.resetAllPos();
      clearInterval(countdownTimerTimeout);
      clearTimeout(gameStartTimeout);
      clearInterval(syncTimer);
      countdownTimerText.setVisible(false);
      waitMessage.setText(`${playersList[playerId].userName} won 🎉`);

      restartGameBtn.setVisible(true);
      restartGameText.setVisible(true);
    });

    this.socket.on("allReadyForRestart", () => {
      waitMessage.setText("");

      if (playersList[firstPlayerId].color === "red") {
        this.startGame();
      }
    });

    this.socket.on("pointSync", (players) => {
      for (const playerId of Object.keys(players)) {
        if (players[playerId].color === "blue") {
          scorePlayerBlue = players[playerId].score;
          scoreTextPlayerBlue.setText(`${scorePlayerBlue}/${MAX_POINTS}`);
        } else {
          scorePlayerRed = players[playerId].score;
          scoreTextPlayerRed.setText(`${scorePlayerRed}/${MAX_POINTS}`);
        }
      }

      gameRunning = false;
      this.resetAllPos();
      clearInterval(countdownTimerTimeout);
      this.runCountdown();
    });

    this.socket.on("disconnect", () => {
      gameRunning = false;
      waitForPlayers = true;
      this.resetAllPos();
      clearInterval(countdownTimerTimeout);
      clearTimeout(gameStartTimeout);
      clearInterval(syncTimer);
      waitMessage.setText("Opponent has disconnected");
      countdownTimerText.setVisible(false);

      restartGameBtn.setVisible(false);
      restartGameText.setVisible(false);
    });

    this.socket.on("playerMoved", (paddleY) => {
      playersList[opponentId].paddle.y = paddleY;
    });

    this.socket.on("ballMoved", (pX, pY, vX, vY) => {
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
      centerX,
      this.game.canvas.height / 2,
      "ball"
    );

    ball.setCollideWorldBounds(true);
    ball.setBounce(1);

    //in createGame()
    this.physics.add.collider(ball, playerBlue, this.hitPaddleRed, null, this);
    this.physics.add.collider(ball, playerRed, this.hitPaddleBlue, null, this);
  }

  update() {
    if (!firstPlayerId || !opponentId) {
      return;
    }

    if (!gameRunning && !waitForPlayers) {
      this.startGame();
      return;
    }

    if (gameRunning) {
      if (cursor.up.isDown) {
        playersList[firstPlayerId].paddle.setVelocityY(-PADDLE_SPEED);
      } else if (cursor.down.isDown) {
        playersList[firstPlayerId].paddle.setVelocityY(PADDLE_SPEED);
      } else {
        playersList[firstPlayerId].paddle.setVelocityY(0);
      }
    }

    if (ball.x == this.game.canvas.width - POINT_EDGE) {
      if (playersList[firstPlayerId].color === "blue") {
        scorePlayerRed += 1;
        this.pointScored();
        this.socket.emit("pointScored", {
          color: "red",
          score: scorePlayerRed,
        });

        if (scorePlayerRed >= MAX_POINTS) {
          this.socket.emit("gameOver", {
            winner: firstPlayerId,
          });
        }
      }
    }

    if (ball.x == POINT_EDGE) {
      if (playersList[firstPlayerId].color === "red") {
        scorePlayerBlue += 1;
        this.pointScored();
        this.socket.emit("pointScored", {
          color: "blue",
          score: scorePlayerBlue,
        });

        if (scorePlayerBlue >= MAX_POINTS) {
          this.socket.emit("gameOver", {
            winner: firstPlayerId,
          });
        }
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

  hitPaddleRed() {
    this.hitPaddle();
    if (playersList[firstPlayerId].color === "red") {
      this.socket.emit("ballMove", ball.x, ball.y, velocityX, velocityY);
    }
  }

  hitPaddleBlue() {
    this.hitPaddle();
    if (playersList[firstPlayerId].color === "blue") {
      this.socket.emit("ballMove", ball.x, ball.y, velocityX, velocityY);
    }
  }

  hitPaddle() {
    velocityX = velocityX + Math.sign(velocityX) * BALL_SPEED_INCREMENTS;
    if (Math.abs(velocityX) > BALL_MAX_SPEED) {
      velocityX = Math.sign(velocityX) * BALL_MAX_SPEED;
    }

    velocityX = velocityX * -1;
    ball.setVelocityX(velocityX);

    velocityY = ball.body.velocity.y;
    ball.setVelocityY(velocityY);
  }

  ballSync(that) {
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
    if (playersList[firstPlayerId].color === "red") {
      clearTimeout(gameStartTimeout);
      gameStartTimeout = setTimeout(() => {
        gameRunning = true;
        this.socket.emit("startParams");
      }, 3000);
    }
  }

  restartGame() {
    scorePlayerBlue = 0;
    scorePlayerRed = 0;

    scoreTextPlayerBlue.setText(`0/${MAX_POINTS}`);
    scoreTextPlayerRed.setText(`0/${MAX_POINTS}`);

    restartGameBtn.setVisible(false);
    restartGameText.setVisible(false);
    waitForPlayers = true;

    waitMessage.setText("Waiting for opponent");
    this.socket.emit("restartGame", { playerId: firstPlayerId });
  }

  startGame() {
    gameRunning = true;
    this.resetAllPos();
    clearInterval(countdownTimerTimeout);
    this.runCountdown();

    if (playersList[firstPlayerId].color === "red") {
      clearTimeout(gameStartTimeout);
      gameStartTimeout = setTimeout(() => {
        this.socket.emit("startParams");
      }, 3000);
    }
  }

  runCountdown() {
    countdownTimerText.setVisible(true);
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
