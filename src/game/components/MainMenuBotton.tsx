import Phaser from 'phaser';

export class MainMenuButton {
  private buttonBackground: Phaser.GameObjects.Rectangle;
  private buttonText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    callback: () => void,
    options?: {
      fill?: number;
      hoverFill?: number;
      fontSize?: string;
    },
  ) {
    const fill = options?.fill ?? 0xff7f2a;
    const hoverFill = options?.hoverFill ?? 0x00ff00;

    // Creating a Button Background
    this.buttonBackground = scene.add
      .rectangle(x, y, width, height, fill)
      .setInteractive()
      .setOrigin(0.5, 0.5)
      .setDepth(1000);

    // Creating text on buttons
    this.buttonText = scene.add.text(x, y, text, {
      fontSize: options?.fontSize ?? '24px',
      color: '#ffffff',
      align: 'center',
    })
      .setOrigin(0.5, 0.5)
      .setDepth(1001);

    // Setting the button click event
    this.buttonBackground.on('pointerdown', callback);

    // Mouse hover effect
    this.buttonBackground.on('pointerover', () => {
      this.buttonBackground.setFillStyle(hoverFill);
    });

    this.buttonBackground.on('pointerout', () => {
      this.buttonBackground.setFillStyle(fill);
    });
  }
}
