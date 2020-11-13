import "phaser";

var cursor;
var playerBlue;
var playerRed;

var ball;

var velocityX = Phaser.Math.Between(-100, 100);
var velocityY = 100;

var scorePlayer = 0;
var scorePc = 0;
var scoreTextPlayer;
var scoreTextPc;
var waitForPlayers = true;
var gameStarted = false;
var firstPlayerId;
var opponentId;
var playersList = {};
var timer;

interface IDemo {
  socket: any;
}

export default class Demo extends Phaser.Scene implements IDemo {
  socket;
  constructor() {
    super("demo");
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
            players[playerId].paddle = playerBlue;
          } else {
            players[playerId].paddle = playerRed;
          }

          if (playerId !== firstPlayerId) {
            opponentId = playerId;
          }
        }

        playersList = players;
      }
    });

    this.socket.on("gameStarted", () => {
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

    this.add.image(400, 200, "ground");

    cursor = this.input.keyboard.createCursorKeys();

    playerBlue = this.physics.add.sprite(780, 200, "player");
    playerBlue.setImmovable(true);
    playerBlue.setCollideWorldBounds(true);

    playerRed = this.physics.add.sprite(20, 200, "pc");
    playerRed.setImmovable(true);
    playerRed.setCollideWorldBounds(true);

    ball = this.physics.add.sprite(400, 200, "ball");

    ball.setCollideWorldBounds(true);
    ball.setBounce(1);

    //in createGame()
    this.physics.add.collider(ball, playerBlue, this.hitPaddle, null, this);
    this.physics.add.collider(ball, playerRed, this.hitPaddle, null, this);

    scoreTextPc = this.add.text(16, 16, "score: 0", {
      fontSize: "16px",
      fill: "#F00",
    });
    scoreTextPlayer = this.add.text(700, 16, "score: 0", {
      fontSize: "16px",
      fill: "#00F",
    });

    clearInterval(timer);
    timer = setInterval(() => this.ballSync(this), 200);
  }

  update() {
    if (!firstPlayerId || !opponentId) {
      return;
    }

    if (!gameStarted && !waitForPlayers) {
      this.reset();
      gameStarted = true;
      return;
    }

    if (cursor.up.isDown) {
      playersList[firstPlayerId].paddle.setVelocityY(-150);
    } else if (cursor.down.isDown) {
      playersList[firstPlayerId].paddle.setVelocityY(150);
    } else {
      playersList[firstPlayerId].paddle.setVelocityY(0);
    }

    if (ball.x == 796) {
      scorePc += 1;
      scoreTextPc.setText("Score: " + scorePc);
      this.reset();
    }

    if (ball.x == 4) {
      scorePlayer += 1;
      scoreTextPlayer.setText("Score: " + scorePlayer);
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
    velocityX = velocityX + 10;
    velocityX = velocityX * -1;
    ball.setVelocityX(velocityX);

    velocityY = ball.body.velocity.y;
    ball.setVelocityY(velocityY);
    this.socket.emit("ballMove", ball.x, ball.y, velocityX, velocityY);
  }

  ballSync(that) {
    that.socket.emit("ballMove", ball.x, ball.y, ball.body.velocity.x, ball.body.velocity.y);
  }

  reset() {
    velocityX = Phaser.Math.Between(100, 200);
    velocityY = Phaser.Math.Between(-100, 100);
    ball.x = 400;
    ball.y = 200;
    playerBlue.x = 780;
    playerBlue.y = 200;
    playerRed.x = 20;
    playerRed.y = 200;
    ball.setVelocityX(velocityX);
    ball.setVelocityY(velocityY);

    this.socket.emit("ballMove", 400, 200, velocityX, velocityY);
  }
}

const config = {
  type: Phaser.AUTO,
  backgroundColor: "#000",
  width: 800,
  height: 400,
  physics: {
    default: "arcade",
  },
  scene: Demo,
};

const game = new Phaser.Game(config);
