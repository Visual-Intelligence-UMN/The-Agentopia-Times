import Phaser from 'phaser';

export class TextInput {
  private inputBackground: Phaser.GameObjects.Rectangle;
  private inputText: Phaser.GameObjects.Text;
  private cursorText: Phaser.GameObjects.Text;
  private text: string = ''; // Current input text
  private maxLength: number; // Maximum allowed characters
  private inputWidth: number; // Input box width
  private pasteButton?: Phaser.GameObjects.Text; // Paste button

  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    maxLength: number = 20, // Default max characters
    inputBackgroundColor: number = 0x000000, // Background color
    textColor: string = '#ffffff', // Text color
    cursorColor: string = '#ffffff' // Cursor color
  ) {
    this.maxLength = maxLength;
    this.inputWidth = width;
    const padding = 5; // Left & right padding

    // Create input background
    this.inputBackground = scene.add
      .rectangle(x, y, width, height, inputBackgroundColor)
      .setOrigin(0.5, 0.5)
      .setDepth(1000);

    // Create input text display with padding
    this.inputText = scene.add.text(x - width / 2 + padding, y - 10, this.text, {
      fontSize: '24px',
      color: textColor,
      wordWrap: { width: width - 2 * padding, useAdvancedWrap: false }, // No line breaks
      maxLines: 1 
    }).setDepth(1001);

    // Create blinking cursor
    this.cursorText = scene.add.text(x - width / 2 + padding, y - 10, '|', {
      fontSize: '24px',
      color: cursorColor,
    }).setDepth(1001);

    // Blink cursor every 500ms
    scene.time.addEvent({
      delay: 500,
      callback: () => {
        this.cursorText.setAlpha(this.cursorText.alpha === 1 ? 0 : 1);
      },
      loop: true,
    });

    // Mask input text to stay within box
    let maskGraphics = scene.add.graphics();
    maskGraphics.fillStyle(0x000000, 0); // Transparent mask
    maskGraphics.fillRect(x - width / 2, y - height / 2, width, height);
    const mask = maskGraphics.createGeometryMask(); 
    this.inputText.setMask(mask);

    // Listen for keyboard input
    scene.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Backspace') {
        this.text = this.text.slice(0, -1); // Remove last character
      } else if (event.key.length === 1) {
        this.text += event.key; // Append character
      }

      // Update displayed text
      this.inputText.setText(this.text);

      // Adjust position if text exceeds input box width
      if (this.inputText.width > this.inputWidth - 2 * padding) {
        this.inputText.x = x - this.inputWidth / 2 - (this.inputText.width - (this.inputWidth - 2 * padding));
        this.cursorText.x = this.inputText.x + this.inputText.width - 5;
      } else {
        this.inputText.x = x - this.inputWidth / 2 + padding;
        this.cursorText.x = this.inputText.x + this.inputText.width - 5;
      }
    });

    // Listen for paste (CTRL + V)
    scene.input.keyboard!.on('keydown', async (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        try {
          this.text = this.text.slice(0, -1);
          // console.log("this.text", this.text);
          const clipboardText = await navigator.clipboard.readText();
          this.text += clipboardText;
          this.inputText.setText(this.text);

          // Adjust position if text exceeds input box width
          if (this.inputText.width > this.inputWidth - 2 * padding) {
            this.inputText.x = x - this.inputWidth / 2 - (this.inputText.width - (this.inputWidth - 2 * padding));
            this.cursorText.x = this.inputText.x + this.inputText.width - 5;
          } else {
            this.inputText.x = x - this.inputWidth / 2 + padding;
            this.cursorText.x = this.inputText.x + this.inputText.width - 5;
          }
        } catch (error) {
          // console.error('Unable to read clipboard contents', error);
        }
      }
    });

    // Listen for right-click to show paste button
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && this.inputBackground.getBounds().contains(pointer.x, pointer.y)) {
        pointer.event.preventDefault();
        this.showPasteButton(scene, pointer.x, pointer.y);
      } else if (this.pasteButton) {
        this.pasteButton.setVisible(false);
      }
    });

    // Prevent browser context menu from showing
    window.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
    });
  }

  // Show paste button
  private showPasteButton(scene: Phaser.Scene, x: number, y: number) {
    if (this.pasteButton) {
      this.pasteButton.setVisible(false);
    }

    this.pasteButton = scene.add.text(x + 10, y + 10, 'Paste', {
      fontSize: '20px',
      color: '#000000',
      backgroundColor: '#ffffff', 
      padding: { left: 5, right: 5, top: 3, bottom: 3 },
    }).setDepth(1001).setInteractive();

    // Handle paste button click
    this.pasteButton.on('pointerdown', async () => {
      try {
        const clipboardText = await navigator.clipboard.readText();
        this.text += clipboardText;
        this.inputText.setText(this.text);

        // Adjust position if text exceeds input box width
        if (this.inputText.width > this.inputWidth - 2 * 10) { 
          this.inputText.x = this.inputBackground.x - this.inputWidth / 2 - (this.inputText.width - (this.inputWidth - 2 * 10));
          this.cursorText.x = this.inputText.x + this.inputText.width - 5;
        } else {
          this.inputText.x = this.inputBackground.x - this.inputWidth / 2 + 10;
          this.cursorText.x = this.inputText.x + this.inputText.width - 5;
        }
      } catch (error) {
        // console.error('Unable to read clipboard contents', error);
      }

      this.pasteButton?.setVisible(false);
    });
  }

  // Get current input text
  getText() {
    return this.text;
  }
}
