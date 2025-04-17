import { Scene } from 'phaser';
import { MainMenuButton } from '../components';
import { TextInput } from '../components/TextInput';
import { mainmenu_background, title } from '../assets/images';

export class MainMenu extends Scene {
  private messageText!: Phaser.GameObjects.Text;
  private textInput!: TextInput;
  private errorText!: Phaser.GameObjects.Text;
  private backgroundImage!: Phaser.GameObjects.Image;
  private titleImage!: Phaser.GameObjects.Image;

  private timeElapsed: number = 0; // Record time for calculating fluctuations

  constructor() {
    super('MainMenu');
  }

  preload() {
    console.log('Background Image Path:', mainmenu_background);
    this.load.image('background', mainmenu_background);
    this.load.image('title', title);

    this.load.once('complete', () => {
      console.log('All assets loaded successfully');
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error(`Failed to load: ${file.key}`);
    });
  }

  create() {
    const { centerX, centerY } = this.cameras.main;

    console.log('MainMenu Scene created');

    // Setting the background image
    this.backgroundImage = this.add.image(centerX, centerY, 'background');
    this.backgroundImage.setDisplaySize(this.cameras.main.width, this.cameras.main.height);

    // Add header image to the top half of the page
    this.titleImage = this.add.image(centerX, centerY - 130, 'title');
    this.titleImage.setScale(0.85);

    // Add reminder text
    this.messageText = this.add.text(centerX, centerY + 20, 'Enter OpenAI API Key to Start the Game', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Creating Input Boxes
    this.textInput = new TextInput(this, centerX, centerY + 60, 400, 50, 20, 0x444444, '#ffffff', '#007bff');

    // Create error message text
    this.errorText = this.add.text(centerX, centerY + 180, '', {
      fontSize: '20px',
      color: '#ff0000',
    }).setOrigin(0.5).setDepth(1002).setVisible(false);

    // Create Button
    new MainMenuButton(
      this,
      centerX, centerY + 125,
      200, 50,
      'Start Game',
      () => { this.verifyApiKeyAndStartGame(); }
    );
  }

  update(time: number, delta: number) {
    this.timeElapsed += delta * 0.005; // Control of fluctuation speed

    // Tilt-rotate left and right (slight oscillation)
    const rotationAngle = Math.sin(this.timeElapsed) * 5; // -5° ~ 5°
    this.titleImage.setRotation(Phaser.Math.DegToRad(rotationAngle)); // Convert to radians

    // up and down (slight wave)
    const yOffset = Math.cos(this.timeElapsed * 0.8) * 5; // 5px float up and down

    // apply transformation
    this.titleImage.y = this.cameras.main.centerY - 140 + yOffset;
  }

  private async verifyApiKeyAndStartGame() {
    const apiKey = this.textInput.getText().trim();
    if (this.isValidApiKey(apiKey)) {
      const isValid = await this.verifyApiKey(apiKey);
      if (isValid) {
        localStorage.setItem('openai-api-key', apiKey);
        console.log('API Key is valid. Starting game...');
        window.location.reload();
        // this.scene.start('level2');
      } else {
        this.showErrorMessage('Invalid OpenAI API key.');
      }
    } else {
      this.showErrorMessage('Invalid API key format.');
    }
  }

  private isValidApiKey(apiKey: string): boolean {
    return apiKey.startsWith('sk-');
  }

  private async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch (error) {
      console.error('Error verifying API key:', error);
      return false;
    }
  }

  private showErrorMessage(message: string) {
    this.errorText.setText(message);
    this.errorText.setVisible(true);
  }
}
