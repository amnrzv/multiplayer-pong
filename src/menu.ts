export default class Menu extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  preload() {
    this.load.plugin(
      "rexinputtextplugin",
      "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexinputtextplugin.min.js",
      true
    );
  }

  create() {
    const centerX = this.cameras.main.worldView.x + this.cameras.main.width / 2;

    this.add
      .text(centerX, 80, "COSMOS PONG", {
        fontFamily: "'Ropa Sans', sans-serif",
        fontSize: "48px",
        fill: "#FFF",
        fontStyle: "normal",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, 180, "Enter Name", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "24px",
        fill: "#FFF",
        fontStyle: "normal",
      })
      .setOrigin(0.5);

    const userName = this.add
      // @ts-ignore
      .rexInputText(centerX, 250, 400, 60, {
        type: "text",
        fontSize: "24px",
        backgroundColor: "white",
        fontFamily: "Roboto, sans-serif",
        color: "black",
        align: "center",
        spellCheck: false,
        autoComplete: false
      })
      .setOrigin(0.5);

    const startGameBtn = this.add
      .rectangle(centerX, 350, 400, 60, 0x84b82f)
      .setOrigin(0.5)
      .setInteractive({ cursor: "pointer" });

    this.add
      .text(centerX, 350, "START GAME", {
        fontFamily: "Roboto, sans-serif",
        fontSize: "24px",
        fill: "#000",
        fontStyle: "normal",
      })
      .setOrigin(0.5);

    userName.on('submit', (e) => {
        console.log('here', e)
    })

    startGameBtn.on("pointerover", () => {
      startGameBtn.setFillStyle(0x84b82f, 0.8);
    });

    startGameBtn.on("pointerout", () => {
      startGameBtn.setFillStyle(0x84b82f, 1);
    });

    startGameBtn.on("pointerup", () => {
      this.scene.start("pong", { userName: userName.text });
    });
  }
}
